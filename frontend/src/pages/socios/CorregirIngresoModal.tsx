import { useCallback, useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { TextareaField } from "../../components/TextareaField"
import { LoadingState } from "../../components/LoadingState"
import { sociosService } from "../../api/socios.service"
import { ciclosService } from "../../api/ciclos.service"
import type { CorreccionIngreso, Socio } from "../../api/socios.types"
import { fecha, hoyISO } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"

/**
 * Corregir la fecha de ingreso de un socio (T14). Solo el coordinador. La fecha decide en
 * qué ciclos estuvo el socio y el reparto de intereses, por eso pide un motivo, no toca
 * ciclos cerrados y cada corrección queda registrada. La base aplica las mismas reglas
 * (migración 009); aquí se avisan antes para no esperar al error.
 */

const MINIMO = 10
const MAXIMO = 500

interface Props {
  cajaId: string
  socio: Socio
  onCerrar: () => void
  onCorregido: (fechaNueva: string) => void | Promise<void>
}

type Errores = Partial<Record<"fecha" | "motivo", string>>

export function CorregirIngresoModal({ cajaId, socio, onCerrar, onCorregido }: Props) {
  const cargar = useCallback(async () => {
    const [ciclos, historial] = await Promise.all([
      ciclosService.getCiclos(cajaId),
      sociosService.getCorreccionesIngreso(cajaId, socio.id),
    ])
    // Lo anterior al ciclo en curso está en ciclos cerrados. Sin periodo, no hay límite
    const desde = ciclos.configurado && ciclos.ciclo_actual ? ciclos.ciclo_actual.inicio : null
    return { desde, correcciones: historial.correcciones }
  }, [cajaId, socio.id])
  const { datos, cargando, error: errorCarga, recargar } = useDatos(cargar)

  const [nueva, setNueva] = useState(socio.fecha_ingreso)
  const [motivo, setMotivo] = useState("")
  const [errores, setErrores] = useState<Errores>({})
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  const desde = datos?.desde ?? null
  // La fecha actual ya se usó para repartir un ciclo cerrado: no se corrige
  const bloqueada = desde !== null && socio.fecha_ingreso < desde

  function validar(): Errores {
    const e: Errores = {}
    if (!nueva) e.fecha = "Indica la fecha de ingreso"
    else if (nueva > hoyISO()) e.fecha = "La fecha de ingreso no puede ser futura"
    else if (nueva === socio.fecha_ingreso) e.fecha = "Es la misma fecha que ya tiene"
    else if (desde && nueva < desde) {
      e.fecha = `Esa fecha cae en un ciclo cerrado. Usa una desde el ${fecha(desde)}`
    }
    if (motivo.trim().length < MINIMO) {
      e.motivo = `Escribe el motivo, con al menos ${MINIMO} caracteres`
    }
    return e
  }

  async function corregir() {
    setError("")
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try {
      await sociosService.corregirIngreso(cajaId, socio.id, {
        fecha_ingreso: nueva,
        motivo: motivo.trim(),
      })
      await onCorregido(nueva)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo corregir la fecha")
      setEnviando(false)
    }
  }

  const nombre = `${socio.nombre} ${socio.apellido}`

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Corregir la fecha de ingreso"
      descripcion={nombre}
      cerrarAlClicFuera={false}
    >
      {cargando && <LoadingState texto="Cargando los ciclos de la caja…" />}

      {!cargando && errorCarga && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudo cargar: {errorCarga}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && datos && bloqueada && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-primary">
            La fecha de ingreso de {socio.nombre} es el {fecha(socio.fecha_ingreso)}, en un ciclo ya
            cerrado. Con ella se repartieron los intereses de ese ciclo, así que ya no se corrige.
          </p>
          <Historial correcciones={datos.correcciones} />
          <div>
            <Button label="Cerrar" variant="secondary" onClick={onCerrar} />
          </div>
        </div>
      )}

      {!cargando && datos && !bloqueada && (
        <Form
          onSubmit={corregir}
          error={error}
          actions={
            <>
              <Button type="submit" label="Corregir la fecha" loading={enviando} />
              <Button label="Cancelar" variant="ghost" onClick={onCerrar} disabled={enviando} />
            </>
          }
        >
          <p className="text-sm text-secondary">
            La fecha de ingreso decide en qué ciclos participa {socio.nombre} del reparto de
            intereses. Ahora figura el{" "}
            <strong className="font-medium text-primary">{fecha(socio.fecha_ingreso)}</strong>. La
            corrección queda registrada con el motivo y tu nombre.
          </p>
          <TextField
            label="Fecha de ingreso correcta"
            type="date"
            value={nueva}
            onChange={(e) => {
              setNueva(e.target.value)
              setErrores((x) => ({ ...x, fecha: undefined }))
            }}
            min={desde ?? undefined}
            max={hoyISO()}
            hint={
              desde
                ? `Desde el ${fecha(desde)}, inicio del ciclo en curso: los ciclos cerrados no se tocan.`
                : "La caja aún no tiene periodo configurado, así que no hay ciclos cerrados."
            }
            error={errores.fecha}
            required
          />
          <TextareaField
            label="Motivo"
            name="motivo"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              setErrores((x) => ({ ...x, motivo: undefined }))
            }}
            hint="Por qué se corrige. Por ejemplo: se registró con la fecha del día y entró en marzo."
            error={errores.motivo}
            maxLength={MAXIMO}
            rows={3}
            required
          />
          <Historial correcciones={datos.correcciones} />
        </Form>
      )}
    </Modal>
  )
}

function Historial({ correcciones }: { correcciones: CorreccionIngreso[] }) {
  if (correcciones.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-secondary">Correcciones anteriores</h3>
      <ul className="flex flex-col gap-2">
        {correcciones.map((c) => (
          <li key={c.id} className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="text-primary">
              Del {fecha(c.fecha_anterior)} al {fecha(c.fecha_nueva)}
            </span>
            <span className="text-secondary">{c.motivo}</span>
            <span className="text-xs text-muted">
              {fecha(c.creado_en)}
              {c.corregido_por_nombre ? ` · ${c.corregido_por_nombre}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
