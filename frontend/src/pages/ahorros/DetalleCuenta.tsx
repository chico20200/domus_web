import { useCallback, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, History, Undo2 } from "lucide-react"
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

/**
 * Detalle de una cuenta: saldo, estado, depósito y retiro (solo tesorero o coordinador,
 * y solo con la cuenta activa) e historial de movimientos.
 */

interface Props {
  cajaId: string
  cuentaId: string
  puedeOperar: boolean
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
  textoVolver,
  onVolver,
  onCambio,
}: Props) {
  const { toast } = useNotif()
  const cargar = useCallback(() => ahorrosService.getCuenta(cajaId, cuentaId), [cajaId, cuentaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [operacion, setOperacion] = useState<TipoOperacion | null>(null)

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
            La cuenta está {estado.etiqueta.toLowerCase()}: no admite depósitos ni retiros.
          </p>
        )}
      </Panel>

      <Panel titulo="Movimientos" sinRelleno>
        <DataTable<Transaccion>
          descripcion="Depósitos y retiros de la cuenta, del más reciente al más antiguo"
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
              celda: (t) => <span className="whitespace-nowrap">{fecha(t.created_at)}</span>,
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
          onHecho={async () => {
            const tipo = operacion
            setOperacion(null)
            await recargar()
            onCambio()
            toast("exito", tipo === "deposito" ? "Depósito registrado" : "Retiro registrado")
          }}
        />
      )}
    </>
  )
}
