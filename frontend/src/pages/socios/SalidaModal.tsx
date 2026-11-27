import { useCallback, useState, type ReactNode } from "react"
import { AlertTriangle, Info } from "lucide-react"
import { Modal } from "../../components/Modal"
import { Button } from "../../components/Button"
import { CheckboxField } from "../../components/CheckboxField"
import { LoadingState } from "../../components/LoadingState"
import { ApiError } from "../../api/api.client"
import { salidaService } from "../../api/salida.service"
import type { Liquidacion, LiquidacionGuardada } from "../../api/salida.types"
import type { Socio } from "../../api/socios.types"
import { fecha, moneda } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"

/**
 * Salida de un socio con liquidación (Etapa 7, T6; especificaciones §12). Reemplaza a
 * "Desactivar".
 *
 * Muestra la vista previa: sus ahorros, el interés del ciclo hasta hoy y su deuda (capital
 * pendiente e interés de las cuotas vencidas; el de las que no vencen no se cobra), y lo
 * que se le entrega. Antes de registrar, quien la hace marca que le entregó sus ahorros y
 * el interés. El backend vuelve a calcular todo: si algo cambió mientras se revisaba,
 * responde con la liquidación nueva y aquí se muestra para revisarla otra vez.
 *
 * Con la ficha ya inactiva (o sin permiso para registrar) solo muestra el historial.
 */

interface Props {
  cajaId: string
  socio: Socio
  /** Solo el coordinador registra la salida */
  puedeRegistrar: boolean
  onCerrar: () => void
  onRegistrada: (liquidacion: LiquidacionGuardada) => void | Promise<void>
}

export function SalidaModal({ cajaId, socio, puedeRegistrar, onCerrar, onRegistrada }: Props) {
  const registrar = puedeRegistrar && socio.activo
  const cargar = useCallback(async () => {
    const [vista, historial] = await Promise.all([
      registrar ? salidaService.vistaPrevia(cajaId, socio.id) : Promise.resolve(null),
      salidaService.historial(cajaId, socio.id),
    ])
    return { vista, liquidaciones: historial.liquidaciones }
  }, [cajaId, socio.id, registrar])
  const { datos, cargando, error: errorCarga, recargar } = useDatos(cargar)

  // La liquidación que devolvió el backend cuando cambió mientras se revisaba
  const [nueva, setNueva] = useState<Liquidacion | null>(null)
  const [ahorrosEntregados, setAhorrosEntregados] = useState(false)
  const [interesEntregado, setInteresEntregado] = useState(false)
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  const liq = nueva ?? datos?.vista ?? null
  const nombre = `${socio.nombre} ${socio.apellido}`
  const listo = Boolean(liq?.puede_salir) && ahorrosEntregados && interesEntregado

  async function registrarSalida() {
    if (!liq || !listo) return
    setError("")
    setEnviando(true)
    try {
      const r = await salidaService.registrar(cajaId, socio.id, {
        neto_esperado: liq.neto,
        ahorros_entregados: true,
        interes_entregado: true,
      })
      await onRegistrada(r.liquidacion)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.datos.liquidacion) {
        // Las cifras cambiaron: se muestran las nuevas y se vuelven a confirmar las entregas
        setNueva(err.datos.liquidacion as Liquidacion)
        setAhorrosEntregados(false)
        setInteresEntregado(false)
      }
      setError(err instanceof Error ? err.message : "No se pudo registrar la salida")
      setEnviando(false)
    }
  }

  const acciones = registrar ? (
    <>
      <Button label="Cancelar" variant="ghost" onClick={onCerrar} disabled={enviando} />
      <Button
        label="Registrar la salida"
        variant="destructive"
        loading={enviando}
        disabled={!listo || cargando}
        onClick={registrarSalida}
      />
    </>
  ) : (
    <Button label="Cerrar" variant="secondary" onClick={onCerrar} />
  )

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={registrar ? `Salida de ${nombre}` : `Liquidaciones de ${nombre}`}
      descripcion={
        registrar
          ? "Lo que recibe al salir de la caja. Revisa las cifras antes de entregarle el dinero."
          : "Lo que recibió cada vez que salió de la caja."
      }
      ancho="amplio"
      cerrarAlClicFuera={false}
      acciones={acciones}
    >
      {cargando && <LoadingState texto="Calculando la liquidación…" />}

      {!cargando && errorCarga && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudo cargar: {errorCarga}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && datos && (
        <div className="flex flex-col gap-6">
          {liq && <VistaPrevia liq={liq} />}

          {liq && !liq.puede_salir && (
            <Aviso tono="alerta" titulo="Todavía no puede salir">
              <ul className="flex flex-col gap-1">
                {liq.impedimentos.map((i) => (
                  <li key={i.codigo}>{i.mensaje}</li>
                ))}
              </ul>
            </Aviso>
          )}

          {liq?.puede_salir && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium text-primary">
                Antes de registrar, confirma la entrega
              </legend>
              <CheckboxField
                label={`Le entregué sus ahorros: ${moneda(Math.round((liq.ahorros - liq.deuda) * 100) / 100)}`}
                hint={
                  liq.deuda > 0
                    ? `Sus ahorros (${moneda(liq.ahorros)}) menos su deuda (${moneda(liq.deuda)}).`
                    : undefined
                }
                checked={ahorrosEntregados}
                onChange={(e) => setAhorrosEntregados(e.target.checked)}
                disabled={enviando}
              />
              <CheckboxField
                label={
                  liq.interes
                    ? `Le entregué el interés del ciclo: ${moneda(liq.interes.monto)}`
                    : "No hay interés del ciclo que entregar"
                }
                checked={interesEntregado}
                onChange={(e) => setInteresEntregado(e.target.checked)}
                disabled={enviando}
              />
            </fieldset>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructivo">
              {error}
            </p>
          )}

          <Historial liquidaciones={datos.liquidaciones} sinVista={!liq} />
        </div>
      )}
    </Modal>
  )
}

function VistaPrevia({ liq }: { liq: Liquidacion }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col divide-y divide-base overflow-hidden rounded-xl border border-base">
        <Fila
          titulo="Sus ahorros"
          monto={liq.ahorros}
          detalle={
            liq.cuentas.length === 0
              ? "No tiene cuentas de ahorro."
              : liq.cuentas.map((c) => `${c.numero_cuenta}: ${moneda(c.saldo)}`).join(" · ")
          }
        />
        <Fila
          titulo={
            liq.interes ? `Interés del ciclo ${liq.interes.ciclo.label}` : "Interés del ciclo"
          }
          signo="+"
          monto={liq.interes?.monto ?? 0}
          detalle={
            liq.interes
              ? `Lo que le toca del reparto ${liq.interes.tipo === "equitativa" ? "equitativo" : "diferenciado"} hasta hoy. Queda fijo: lo que se cobre después en este ciclo es para los demás.`
              : "La caja no tiene configurado su periodo: no hay reparto de intereses."
          }
        />
        {liq.creditos.map((cr) => (
          <Fila
            key={cr.id}
            titulo={`Se descuenta el crédito N.º ${cr.numero}`}
            signo="−"
            monto={cr.deuda}
            detalle={[
              `Capital pendiente ${moneda(cr.capital_pendiente)}`,
              cr.interes_vencido > 0
                ? `interés de ${cr.cuotas_vencidas} ${cr.cuotas_vencidas === 1 ? "cuota vencida" : "cuotas vencidas"} ${moneda(cr.interes_vencido)}`
                : null,
              cr.interes_condonado > 0
                ? `no se cobran ${moneda(cr.interes_condonado)} de interés de las cuotas que aún no vencen`
                : null,
            ]
              .filter(Boolean)
              .join("; ")}
          />
        ))}
        <div className="flex items-baseline justify-between gap-4 bg-surface-2 px-4 py-3">
          <dt className="text-sm font-medium text-primary">
            {liq.neto < 0 ? "Le falta para cubrir su deuda" : "Recibe en total"}
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-primary">
            {moneda(Math.abs(liq.neto))}
          </dd>
        </div>
      </dl>

      {liq.solicitudes.length > 0 && (
        <Aviso tono="info">
          {liq.solicitudes.length === 1
            ? `Su solicitud de crédito N.º ${liq.solicitudes[0].numero} (${moneda(liq.solicitudes[0].monto)}), aún sin aprobar, se anula.`
            : `Sus ${liq.solicitudes.length} solicitudes de crédito sin aprobar (${liq.solicitudes.map((s) => `N.º ${s.numero}`).join(", ")}) se anulan.`}
        </Aviso>
      )}
      {liq.puede_salir && (
        <Aviso tono="info">
          Sus cuentas se cierran y su ficha queda inactiva
          {liq.socio.pierde_acceso ? "; también pierde el acceso a la caja en DOMUS" : ""}. Si
          vuelve, se reactiva su ficha
          {liq.socio.pierde_acceso ? " y entra a la caja con un código de invitación" : ""}.
        </Aviso>
      )}
    </div>
  )
}

function Fila({
  titulo,
  monto,
  signo,
  detalle,
}: {
  titulo: string
  monto: number
  signo?: "+" | "−"
  detalle: string
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-primary">{titulo}</dt>
        <dd className="tabular-nums text-primary">
          {signo ? `${signo} ` : ""}
          {moneda(monto)}
        </dd>
      </div>
      <p className="text-xs text-secondary">{detalle}</p>
    </div>
  )
}

function Aviso({
  tono,
  titulo,
  children,
}: {
  tono: "info" | "alerta"
  titulo?: string
  children: ReactNode
}) {
  const Icono = tono === "alerta" ? AlertTriangle : Info
  return (
    <div
      role={tono === "alerta" ? "alert" : undefined}
      className="flex gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-primary"
    >
      <Icono
        size={16}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${tono === "alerta" ? "text-estado-alerta" : "text-secondary"}`}
      />
      <div className="flex flex-col gap-1">
        {titulo && <p className="font-medium">{titulo}</p>}
        {children}
      </div>
    </div>
  )
}

function Historial({
  liquidaciones,
  sinVista,
}: {
  liquidaciones: LiquidacionGuardada[]
  sinVista: boolean
}) {
  if (liquidaciones.length === 0) {
    return sinVista ? (
      <p className="text-sm text-secondary">
        No tiene liquidaciones: su ficha se desactivó sin ahorros ni créditos.
      </p>
    ) : null
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-secondary">
        {sinVista ? "Sus liquidaciones" : "Salidas anteriores"}
      </h3>
      <ul className="flex flex-col gap-2">
        {liquidaciones.map((l) => (
          <li key={l.id} className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-primary">Salió el {fecha(l.fecha)}</span>
              <span className="font-medium tabular-nums text-primary">
                Recibió {moneda(l.neto)}
              </span>
            </div>
            <span className="text-secondary tabular-nums">
              Ahorros {moneda(l.ahorros)} + interés {moneda(l.interes)}
              {l.deuda > 0 ? ` − deuda ${moneda(l.deuda)}` : ""}
              {l.interes_condonado > 0
                ? ` · no se le cobraron ${moneda(l.interes_condonado)} de interés futuro`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
