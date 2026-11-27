import { useCallback, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CheckCircle2, CircleDashed, Trash2 } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Modal } from "../../components/Modal"
import { TextField } from "../../components/TextField"
import { LoadingState } from "../../components/LoadingState"
import { useCaja } from "../../context/CajaContext"
import { useNotif } from "../../context/NotifContext"
import { cajasService } from "../../api/cajas.service"
import type { RequisitosEliminarCaja } from "../../api/cajas.types"
import { moneda } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { AYUDA } from "../../lib/ayuda"

/**
 * Eliminar la caja (Etapa 7, T10; especificaciones §12). Solo el coordinador.
 *
 * Proceso fácil por delante y validaciones estrictas por detrás: aquí se ve lo que falta,
 * con un enlace a la página donde se resuelve cada cosa, y el botón se habilita cuando no
 * falta nada. Confirmar pide escribir el nombre de la caja. La base vuelve a comprobarlo
 * todo al eliminarla (migración 024). No se borra nada: la caja queda eliminada, con sus
 * datos, y sus miembros la ven así en Mis cajas (T11).
 */

interface Requisito {
  clave: string
  listo: boolean
  titulo: string
  falta: string
  enlace: { a: string; texto: string }
}

function requisitos(r: RequisitosEliminarCaja): Requisito[] {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  return [
    {
      clave: "socios",
      listo: r.socios_activos === 0,
      titulo: "Sin socios activos",
      falta: `${plural(r.socios_activos, "socio activo", "socios activos")}. Registra la salida de cada uno con su liquidación. Si también eres socio, tu salida se registra al final, cuando seas el último.`,
      enlace: { a: "/socios", texto: "Ir a Socios" },
    },
    {
      clave: "creditos",
      listo: r.creditos === 0,
      titulo: "Sin créditos pendientes ni en curso",
      falta: `${plural(r.creditos, "crédito pendiente o en curso", "créditos pendientes o en curso")}. Se saldan al registrar la salida de su socio; una solicitud sin aprobar se anula con ella.`,
      enlace: { a: "/creditos", texto: "Ir a Créditos" },
    },
    {
      clave: "ahorros",
      listo: r.cuentas_con_saldo === 0,
      titulo: "Sin ahorros",
      falta: `${moneda(r.ahorros)} en ${plural(r.cuentas_con_saldo, "cuenta", "cuentas")}. Se entregan al registrar la salida de su titular.`,
      enlace: { a: "/ahorros", texto: "Ir a Ahorros" },
    },
    {
      clave: "fondos",
      listo: r.fondos_con_saldo === 0,
      titulo: "Fondos de caja en $0",
      falta: `${moneda(r.saldo_fondos)} en ${plural(r.fondos_con_saldo, "fondo", "fondos")}. Registra el retiro de ese dinero, con su motivo.`,
      enlace: { a: "/fondos", texto: "Ir a Fondos" },
    },
  ]
}

export function EliminarCaja({ cajaId, nombreCaja }: { cajaId: string; nombreCaja: string }) {
  const cargar = useCallback(() => cajasService.requisitosEliminar(cajaId), [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [confirmando, setConfirmando] = useState(false)

  const lista = datos ? requisitos(datos) : []
  const faltan = lista.filter((r) => !r.listo).length

  return (
    <Panel
      titulo="Eliminar la caja"
      ayuda={AYUDA.eliminarCaja}
      descripcion="Al final de su vida, cuando todos sus socios salieron con su liquidación. Nadie podrá registrar nada más en ella; sus datos se conservan y sus miembros la verán como caja eliminada."
    >
      {cargando && <LoadingState texto="Revisando lo que falta…" />}

      {!cargando && error && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudo revisar lo que falta: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && datos && (
        <>
          <p className="text-sm text-primary">
            {faltan === 0
              ? "No falta nada: la caja se puede eliminar."
              : `Antes de eliminarla ${faltan === 1 ? "falta una cosa" : `faltan ${faltan} cosas`}:`}
          </p>
          <ul className="flex flex-col divide-y divide-base rounded-lg border border-base">
            {lista.map((r) => (
              <li key={r.clave} className="flex gap-3 px-4 py-3 text-sm">
                {r.listo ? (
                  <CheckCircle2
                    size={18}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-estado-ok"
                  />
                ) : (
                  <CircleDashed
                    size={18}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-estado-alerta"
                  />
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-primary">
                    {r.titulo}
                    <span className="sr-only">{r.listo ? ": listo" : ": falta"}</span>
                  </span>
                  {!r.listo && (
                    <>
                      <span className="text-secondary">{r.falta}</span>
                      <Link
                        to={r.enlace.a}
                        className="w-fit font-medium text-accion-texto underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {r.enlace.texto}
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              label="Eliminar la caja"
              variant="destructive"
              icon={Trash2}
              disabled={!datos.puede_eliminar}
              onClick={() => setConfirmando(true)}
            />
            <Button label="Volver a revisar" variant="ghost" onClick={recargar} />
          </div>
        </>
      )}

      {confirmando && (
        <ConfirmarEliminar
          cajaId={cajaId}
          nombreCaja={nombreCaja}
          onCerrar={() => setConfirmando(false)}
          onRechazada={recargar}
        />
      )}
    </Panel>
  )
}

function ConfirmarEliminar({
  cajaId,
  nombreCaja,
  onCerrar,
  onRechazada,
}: {
  cajaId: string
  nombreCaja: string
  onCerrar: () => void
  onRechazada: () => void
}) {
  const navigate = useNavigate()
  const { salirDeCaja } = useCaja()
  const { toast } = useNotif()
  const [nombre, setNombre] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const coincide = nombre.trim() === nombreCaja.trim()

  async function eliminar() {
    if (!coincide) return
    setError("")
    setEnviando(true)
    try {
      await cajasService.eliminar(cajaId, nombre)
      salirDeCaja()
      toast("exito", `${nombreCaja} quedó eliminada`)
      navigate("/cajas", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la caja")
      setEnviando(false)
      // Algo cambió desde la revisión: la lista de lo que falta se pone al día
      onRechazada()
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`¿Eliminar ${nombreCaja}?`}
      descripcion="Esto no se deshace."
      cerrarAlClicFuera={false}
      acciones={
        <>
          <Button label="Cancelar" variant="ghost" onClick={onCerrar} disabled={enviando} />
          <Button
            label="Eliminar la caja"
            variant="destructive"
            icon={Trash2}
            loading={enviando}
            disabled={!coincide}
            onClick={eliminar}
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-primary">
          <li>
            Nadie podrá registrar nada más en ella, y sus códigos de invitación dejan de servir.
          </li>
          <li>Sus datos se conservan: liquidaciones, movimientos y reportes.</li>
          <li>Sus miembros la verán como caja eliminada y podrán quitarla de su lista.</li>
        </ul>
        <TextField
          label="Para confirmar, escribe el nombre de la caja"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setError("")
          }}
          placeholder={nombreCaja}
          autoComplete="off"
          hint={`Tal como aparece: ${nombreCaja}`}
          error={error}
        />
      </div>
    </Modal>
  )
}
