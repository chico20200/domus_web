import { useCallback, useState } from "react"
import { CircleCheck, TriangleAlert } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Form } from "../../components/Form"
import { TextField } from "../../components/TextField"
import { SelectField } from "../../components/SelectField"
import { LoadingState } from "../../components/LoadingState"
import { Badge } from "../../components/Badge"
import { useNotif } from "../../context/NotifContext"
import { ciclosService } from "../../api/ciclos.service"
import { fecha, hoyISO } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { AYUDA_CICLO, DURACIONES, MESES, OPCIONES_MES } from "../../lib/ciclo"

/**
 * Periodo de la caja: fecha de fundación, mes de inicio y duración de cada ciclo.
 * Solo la ve el coordinador. Sin periodo configurado, Reportes no puede repartir intereses.
 */

export function PeriodoCaja({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()

  const cargarCiclos = useCallback(() => ciclosService.getCiclos(cajaId), [cajaId])
  const { datos: ciclos, cargando, error: errorCarga, recargar } = useDatos(cargarCiclos)
  const [editando, setEditando] = useState(false)

  const [fundacion, setFundacion] = useState("")
  const [mesInicio, setMesInicio] = useState("1")
  const [duracion, setDuracion] = useState("12")
  const [errorFundacion, setErrorFundacion] = useState("")
  const [guardando, setGuardando] = useState(false)

  // Al abrir el formulario se copia la configuración guardada
  function editar() {
    if (ciclos?.config) {
      setFundacion(ciclos.config.fecha_fundacion)
      setMesInicio(String(ciclos.config.mes_inicio_ciclo))
      setDuracion(String(ciclos.config.duracion_ciclo))
    }
    setErrorFundacion("")
    setEditando(true)
  }

  async function guardar() {
    if (!fundacion) {
      setErrorFundacion("Indica la fecha en que se fundó la caja")
      return
    }
    if (fundacion > hoyISO()) {
      setErrorFundacion("La fecha de fundación no puede ser posterior a hoy")
      return
    }
    setGuardando(true)
    try {
      await ciclosService.guardarConfig(cajaId, {
        fecha_fundacion: fundacion,
        mes_inicio_ciclo: Number(mesInicio),
        duracion_ciclo: Number(duracion),
      })
      await recargar()
      setEditando(false)
      toast("exito", "Periodo guardado")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo guardar el periodo")
    } finally {
      setGuardando(false)
    }
  }

  // Si la base tiene una duración que no está en la lista, se agrega para no mostrar otra
  const opcionesDuracion = DURACIONES.some((d) => d.value === duracion)
    ? DURACIONES
    : [...DURACIONES, { value: duracion, label: `${duracion} meses` }]

  const configurado = Boolean(ciclos?.configurado)
  const mostrarFormulario = editando || (ciclos !== null && !configurado)
  const cerrados = ciclos?.ciclos.filter((c) => c.cerrado) ?? []

  return (
    <Panel
      titulo="Periodo de la caja"
      descripcion="Cada ciclo es el tiempo entre dos cortes de cuentas. Al cerrarse un ciclo se reparten los intereses entre los socios. El sistema calcula en qué ciclo está la caja."
    >
      {cargando && <LoadingState texto="Cargando el periodo…" />}

      {!cargando && errorCarga && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudo cargar el periodo de la caja.</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && !errorCarga && !configurado && (
        <div className="flex gap-3 rounded-lg border-l-[3px] border-estado-alerta bg-surface-2 p-4">
          <span className="flex h-5 shrink-0 items-center">
            <TriangleAlert size={16} className="text-estado-alerta" aria-hidden="true" />
          </span>
          <p className="text-sm text-primary">
            <strong className="font-medium">Periodo sin configurar.</strong> La distribución de
            intereses de Reportes no estará disponible hasta que lo guardes.
          </p>
        </div>
      )}

      {/* Resumen del periodo guardado */}
      {!cargando && ciclos?.config && configurado && !editando && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-surface-2 p-4 text-sm">
            <dt className="text-secondary">Fundación</dt>
            <dd className="text-right text-primary">{fecha(ciclos.config.fecha_fundacion)}</dd>
            <dt className="text-secondary">Cada ciclo inicia en</dt>
            <dd className="text-right text-primary">{MESES[ciclos.config.mes_inicio_ciclo - 1]}</dd>
            <dt className="text-secondary">Duración</dt>
            <dd className="text-right text-primary">{ciclos.config.duracion_ciclo} meses</dd>
          </dl>

          {ciclos.ciclo_actual && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">Ciclo actual</p>
                <p className="text-sm font-medium text-primary">
                  Ciclo {ciclos.ciclo_actual.numero} · {ciclos.ciclo_actual.label}
                </p>
              </div>
              <Badge tono="ok" label="En curso" />
            </div>
          )}

          {cerrados.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-secondary">Ciclos cerrados</h3>
              <ul className="flex flex-col gap-1">
                {cerrados.map((c) => (
                  <li
                    key={c.numero}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  >
                    <CircleCheck size={14} className="shrink-0 text-estado-ok" aria-hidden="true" />
                    <span className="text-primary">Ciclo {c.numero}</span>
                    <span className="text-secondary">{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Button label="Cambiar periodo" variant="secondary" onClick={editar} />
          </div>
        </>
      )}

      {!cargando && !errorCarga && mostrarFormulario && (
        <Form
          onSubmit={guardar}
          actions={
            <>
              <Button type="submit" label="Guardar periodo" loading={guardando} />
              {configurado && (
                <Button label="Cancelar" variant="ghost" onClick={() => setEditando(false)} />
              )}
            </>
          }
        >
          <TextField
            label="Fecha de fundación de la caja"
            type="date"
            value={fundacion}
            onChange={(e) => {
              setFundacion(e.target.value)
              setErrorFundacion("")
            }}
            hint={AYUDA_CICLO.fundacion}
            max={hoyISO()}
            error={errorFundacion}
            required
          />
          <SelectField
            label="Mes en que inicia cada ciclo"
            value={mesInicio}
            onChange={(e) => setMesInicio(e.target.value)}
            options={OPCIONES_MES}
            hint={AYUDA_CICLO.mesInicio}
          />
          <SelectField
            label="Duración del ciclo"
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            options={opcionesDuracion}
            hint={AYUDA_CICLO.duracion}
          />
        </Form>
      )}
    </Panel>
  )
}
