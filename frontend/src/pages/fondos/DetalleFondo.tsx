import { useCallback, useState } from "react"
import {
  ArchiveRestore,
  ArchiveX,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Pencil,
  Undo2,
} from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Badge } from "../../components/Badge"
import { DataTable } from "../../components/DataTable"
import { EmptyState } from "../../components/EmptyState"
import { LoadingState } from "../../components/LoadingState"
import { useNotif } from "../../context/NotifContext"
import { fondosService } from "../../api/fondos.service"
import type { MovimientoFondo, TipoMovimientoFondo } from "../../api/fondos.types"
import { fecha, moneda } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { MovimientoFondoModal } from "./MovimientoFondoModal"
import { FondoModal } from "./FondoModal"

/**
 * Un fondo (T19): saldo, depósitos y retiros, editar, cerrar o reabrir, e historial.
 * Cerrar pide saldo 0; un fondo cerrado no recibe movimientos.
 */

interface Props {
  cajaId: string
  fondoId: string
  onVolver: () => void
  /** Avisa a la lista que algo cambió */
  onCambio: () => void
}

export function DetalleFondo({ cajaId, fondoId, onVolver, onCambio }: Props) {
  const { toast, confirm } = useNotif()
  const cargar = useCallback(() => fondosService.getMovimientos(cajaId, fondoId), [cajaId, fondoId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [operacion, setOperacion] = useState<TipoMovimientoFondo | null>(null)
  const [editando, setEditando] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  const volver = (
    <div>
      <Button label="Volver a fondos" variant="ghost" icon={Undo2} onClick={onVolver} />
    </div>
  )

  if (cargando) {
    return (
      <>
        {volver}
        <LoadingState texto="Cargando el fondo…" />
      </>
    )
  }

  if (error || !datos) {
    return (
      <>
        {volver}
        <Panel>
          <p className="text-sm text-secondary">No se pudo cargar el fondo: {error}</p>
          <div>
            <Button label="Reintentar" variant="secondary" onClick={recargar} />
          </div>
        </Panel>
      </>
    )
  }

  const { fondo, movimientos } = datos

  async function actualizar() {
    await recargar()
    onCambio()
  }

  async function cambiarEstado() {
    const cerrar = fondo.activo
    const ok = await confirm({
      titulo: cerrar ? `¿Cerrar ${fondo.nombre}?` : `¿Abrir de nuevo ${fondo.nombre}?`,
      mensaje: cerrar
        ? "Un fondo cerrado no recibe depósitos ni retiros. Su historial se conserva y se puede abrir de nuevo cuando haga falta."
        : "El fondo vuelve a recibir depósitos y retiros.",
      labelOk: cerrar ? "Cerrar fondo" : "Abrir fondo",
      peligroso: cerrar,
    })
    if (!ok) return
    setCambiando(true)
    try {
      await fondosService.cambiarEstado(cajaId, fondo.id, !cerrar)
      await actualizar()
      toast("exito", cerrar ? "Fondo cerrado" : "Fondo abierto de nuevo")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo cambiar el estado del fondo")
    } finally {
      setCambiando(false)
    }
  }

  return (
    <>
      {volver}

      <Panel
        titulo={fondo.nombre}
        descripcion={fondo.descripcion ?? undefined}
        acciones={
          <Badge
            tono={fondo.activo ? "ok" : "neutral"}
            label={fondo.activo ? "Abierto" : "Cerrado"}
          />
        }
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs text-secondary">Saldo del fondo</p>
          <p className="text-2xl font-semibold text-primary tabular-nums">{moneda(fondo.saldo)}</p>
        </div>

        {fondo.activo ? (
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
              disabled={fondo.saldo <= 0}
              onClick={() => setOperacion("retiro")}
            />
          </div>
        ) : (
          <p className="text-sm text-secondary">
            El fondo está cerrado: no admite depósitos ni retiros.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-base pt-6">
          <Button
            label="Editar nombre y descripción"
            variant="ghost"
            icon={Pencil}
            onClick={() => setEditando(true)}
          />
          <Button
            label={fondo.activo ? "Cerrar fondo" : "Abrir de nuevo"}
            variant="ghost"
            icon={fondo.activo ? ArchiveX : ArchiveRestore}
            loading={cambiando}
            disabled={fondo.activo && fondo.saldo > 0}
            onClick={cambiarEstado}
          />
          {fondo.activo && fondo.saldo > 0 && (
            <p className="text-xs text-secondary">Para cerrarlo, primero retira su saldo.</p>
          )}
        </div>
      </Panel>

      <Panel titulo="Movimientos" sinRelleno>
        <DataTable<MovimientoFondo>
          descripcion="Depósitos y retiros del fondo, del más reciente al más antiguo"
          sinMarco
          filas={movimientos}
          claveFila={(m) => m.id}
          vacio={
            <EmptyState
              icono={History}
              titulo="Aún no hay movimientos"
              descripcion={fondo.activo ? "El primer depósito aparecerá aquí." : undefined}
            />
          }
          columnas={[
            {
              clave: "fecha",
              encabezado: "Fecha",
              celda: (m) => <span className="whitespace-nowrap">{fecha(m.fecha)}</span>,
            },
            {
              clave: "movimiento",
              encabezado: "Movimiento",
              celda: (m) => (
                <div className="flex flex-col">
                  <span className="text-primary">
                    {m.tipo === "deposito" ? "Depósito" : "Retiro"}
                  </span>
                  <span className="text-xs text-secondary">{m.descripcion}</span>
                </div>
              ),
            },
            {
              clave: "monto",
              encabezado: "Monto",
              alinear: "derecha",
              celda: (m) =>
                m.tipo === "deposito" ? (
                  <span className="whitespace-nowrap text-estado-ok">+ {moneda(m.monto)}</span>
                ) : (
                  <span className="whitespace-nowrap">− {moneda(m.monto)}</span>
                ),
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alinear: "derecha",
              celda: (m) => <span className="text-secondary">{moneda(m.saldo_posterior)}</span>,
            },
          ]}
        />
      </Panel>

      {operacion && (
        <MovimientoFondoModal
          tipo={operacion}
          cajaId={cajaId}
          fondo={fondo}
          onCerrar={() => setOperacion(null)}
          onHecho={async () => {
            const tipo = operacion
            setOperacion(null)
            await actualizar()
            toast("exito", tipo === "deposito" ? "Depósito registrado" : "Retiro registrado")
          }}
        />
      )}
      {editando && (
        <FondoModal
          cajaId={cajaId}
          fondo={fondo}
          onCerrar={() => setEditando(false)}
          onHecho={async () => {
            setEditando(false)
            await actualizar()
            toast("exito", "Fondo actualizado")
          }}
        />
      )}
    </>
  )
}
