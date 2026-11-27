import { useCallback, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, History, Lock, LockOpen, Undo2 } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Badge } from "../../components/Badge"
import { DataTable } from "../../components/DataTable"
import { EmptyState } from "../../components/EmptyState"
import { LoadingState } from "../../components/LoadingState"
import { useNotif } from "../../context/NotifContext"
import { ahorrosService } from "../../api/ahorros.service"
import type { Transaccion } from "../../api/ahorros.types"
import { fecha, moneda } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { nombreSocio } from "../../lib/creditos"
import { estadoCuenta } from "../../lib/ahorros"
import { OperacionModal, type TipoOperacion } from "./OperacionModal"
import { BotonComprobante } from "../../components/BotonComprobante"

/**
 * Detalle de una cuenta: saldo, estado, depósito y retiro (solo tesorero o coordinador,
 * y solo con la cuenta activa) e historial de movimientos. El coordinador además la cierra,
 * con el saldo en 0, y la reabre si el titular sigue activo (Etapa 7, T1). La base revisa
 * las dos reglas otra vez (migraciones 005 y 019).
 */

interface Props {
  cajaId: string
  cuentaId: string
  puedeOperar: boolean
  /** Coordinador: puede cerrar y reabrir la cuenta */
  puedeCambiarEstado?: boolean
  /** Texto del botón de volver: "Volver a cuentas" o "Volver a mis cuentas" */
  textoVolver: string
  onVolver: () => void
  /** Avisa a la lista que el saldo cambió */
  onCambio: () => void
}

export function DetalleCuenta({
  cajaId,
  cuentaId,
  puedeOperar,
  puedeCambiarEstado = false,
  textoVolver,
  onVolver,
  onCambio,
}: Props) {
  const { toast, confirm } = useNotif()
  const cargar = useCallback(() => ahorrosService.getCuenta(cajaId, cuentaId), [cajaId, cuentaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [operacion, setOperacion] = useState<TipoOperacion | null>(null)
  const [cambiando, setCambiando] = useState(false)

  const volver = (
    <div>
      <Button label={textoVolver} variant="ghost" icon={Undo2} onClick={onVolver} />
    </div>
  )

  if (cargando) {
    return (
      <>
        {volver}
        <LoadingState texto="Cargando la cuenta…" />
      </>
    )
  }

  if (error || !datos) {
    return (
      <>
        {volver}
        <Panel>
          <p className="text-sm text-secondary">No se pudo cargar la cuenta: {error}</p>
          <div>
            <Button label="Reintentar" variant="secondary" onClick={recargar} />
          </div>
        </Panel>
      </>
    )
  }

  const { cuenta, transacciones } = datos
  const estado = estadoCuenta(cuenta.estado)
  const titular = nombreSocio(cuenta.socios)
  const operable = puedeOperar && cuenta.estado === "activa"
  const cerrada = cuenta.estado === "cerrada"
  const conSaldo = Number(cuenta.saldo) > 0
  const titularActivo = cuenta.socios?.activo !== false

  async function cambiarEstado(nuevo: "activa" | "cerrada") {
    const ok = await confirm(
      nuevo === "cerrada"
        ? {
            titulo: `¿Cerrar la cuenta ${cuenta.numero_cuenta}?`,
            mensaje: `Ya no admitirá depósitos ni retiros. Sus movimientos se conservan y se puede reabrir mientras la ficha de ${titular} siga activa.`,
            labelOk: "Cerrar cuenta",
            peligroso: true,
          }
        : {
            titulo: `¿Reabrir la cuenta ${cuenta.numero_cuenta}?`,
            mensaje: "Vuelve a admitir depósitos y retiros, con el saldo en $0,00.",
            labelOk: "Reabrir cuenta",
          },
    )
    if (!ok) return
    setCambiando(true)
    try {
      await ahorrosService.cambiarEstado(cajaId, cuenta.id, nuevo)
      await recargar()
      onCambio()
      toast("exito", nuevo === "cerrada" ? "Cuenta cerrada" : "Cuenta reabierta")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo cambiar el estado")
    } finally {
      setCambiando(false)
    }
  }

  return (
    <>
      {volver}

      <Panel
        titulo={`Cuenta ${cuenta.numero_cuenta}`}
        descripcion={`${titular} · abierta el ${fecha(cuenta.fecha_apertura)}`}
        acciones={<Badge tono={estado.tono} label={estado.etiqueta} />}
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs text-secondary">Saldo disponible</p>
          <p className="text-2xl font-semibold text-primary tabular-nums">{moneda(cuenta.saldo)}</p>
        </div>
        {operable && (
          <div className="flex flex-wrap gap-3">
            <Button
              label="Registrar depósito"
              icon={ArrowDownToLine}
              onClick={() => setOperacion("deposito")}
            />
            <Button
              label="Registrar retiro"
              variant="secondary"
              icon={ArrowUpFromLine}
              disabled={Number(cuenta.saldo) <= 0}
              onClick={() => setOperacion("retiro")}
            />
          </div>
        )}
        {puedeOperar && cuenta.estado !== "activa" && (
          <p className="text-sm text-secondary">
            {cerrada && cuenta.fecha_cierre
              ? `Cerrada el ${fecha(cuenta.fecha_cierre)}: no admite depósitos ni retiros.`
              : `La cuenta está ${estado.etiqueta.toLowerCase()}: no admite depósitos ni retiros.`}
          </p>
        )}
        {puedeCambiarEstado && !cerrada && (
          <div className="flex flex-col gap-2 border-t border-base pt-4">
            <div>
              <Button
                label="Cerrar cuenta"
                variant="ghost"
                icon={Lock}
                disabled={conSaldo}
                loading={cambiando}
                onClick={() => cambiarEstado("cerrada")}
              />
            </div>
            {conSaldo && (
              <p className="text-xs text-secondary">
                Para cerrarla, el saldo tiene que estar en $0,00: registra primero el retiro de{" "}
                {moneda(cuenta.saldo)}.
              </p>
            )}
          </div>
        )}
        {puedeCambiarEstado && cerrada && (
          <div className="flex flex-col gap-2">
            {titularActivo ? (
              <div>
                <Button
                  label="Reabrir cuenta"
                  variant="secondary"
                  icon={LockOpen}
                  loading={cambiando}
                  onClick={() => cambiarEstado("activa")}
                />
              </div>
            ) : (
              <p className="text-xs text-secondary">
                La ficha de {titular} está inactiva: para reabrir la cuenta, primero reactívala en
                Socios.
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel titulo="Movimientos" sinRelleno>
        <DataTable<Transaccion>
          descripcion="Depósitos y retiros de la cuenta, del más reciente al más antiguo"
          sinMarco
          filas={transacciones}
          claveFila={(t) => t.id}
          vacio={
            <EmptyState
              icono={History}
              titulo="Aún no hay movimientos"
              descripcion={operable ? "El primer depósito aparecerá aquí." : undefined}
            />
          }
          columnas={[
            {
              clave: "fecha",
              encabezado: "Fecha",
              celda: (t) => <span className="whitespace-nowrap">{fecha(t.fecha)}</span>,
            },
            {
              clave: "movimiento",
              encabezado: "Movimiento",
              celda: (t) => (
                <div className="flex flex-col">
                  <span className="text-primary">
                    {t.tipo === "deposito" ? "Depósito" : "Retiro"}
                  </span>
                  {t.descripcion && <span className="text-xs text-secondary">{t.descripcion}</span>}
                </div>
              ),
            },
            {
              clave: "monto",
              encabezado: "Monto",
              alinear: "derecha",
              celda: (t) =>
                t.tipo === "deposito" ? (
                  <span className="whitespace-nowrap text-estado-ok">+ {moneda(t.monto)}</span>
                ) : (
                  <span className="whitespace-nowrap">− {moneda(t.monto)}</span>
                ),
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alinear: "derecha",
              celda: (t) => <span className="text-secondary">{moneda(t.saldo_posterior)}</span>,
            },
            {
              clave: "comprobante",
              encabezado: "Comprobante",
              celda: (t) => (
                <BotonComprobante
                  destino={{ tipo: "movimiento", cajaId, cuentaId: cuenta.id, id: t.id }}
                  tiene={Boolean(t.comprobante)}
                  puedeAdjuntar={operable}
                  descripcion={`del ${t.tipo === "deposito" ? "depósito" : "retiro"} del ${fecha(t.fecha)}`}
                  onAdjuntado={recargar}
                />
              ),
            },
          ]}
        />
      </Panel>

      {operacion && (
        <OperacionModal
          tipo={operacion}
          cajaId={cajaId}
          cuentaId={cuenta.id}
          numeroCuenta={cuenta.numero_cuenta}
          titular={titular}
          saldo={Number(cuenta.saldo)}
          onCerrar={() => setOperacion(null)}
          onHecho={async (aviso) => {
            const tipo = operacion
            setOperacion(null)
            await recargar()
            onCambio()
            if (aviso) toast("advertencia", aviso)
            else toast("exito", tipo === "deposito" ? "Depósito registrado" : "Retiro registrado")
          }}
        />
      )}
    </>
  )
}
