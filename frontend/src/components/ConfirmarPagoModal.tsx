// src/components/ConfirmarPagoModal.tsx
import { useCallback } from "react"
import { TriangleAlert } from "lucide-react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { LoadingState } from "./LoadingState"
import { pagosService } from "../api/pagos.service"
import type { TipoPago } from "../api/pagos.types"
import { fecha, moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { TIPO_PAGO } from "../lib/creditos"

/**
 * Confirmación de un pago de cuota (Créditos y Pagos). Pide al backend la próxima cuota
 * y muestra exactamente qué se va a cobrar antes de registrar nada.
 *
 * Se monta solo cuando hay un pago por confirmar; al desmontarse, el foco vuelve al botón
 * que lo abrió.
 */

interface Props {
  cajaId: string
  creditoId: string
  tipo: TipoPago
  nombreSocio?: string
  onConfirmar: () => void
  onCancelar: () => void
  procesando?: boolean
}

export function ConfirmarPagoModal({
  cajaId,
  creditoId,
  tipo,
  nombreSocio,
  onConfirmar,
  onCancelar,
  procesando = false,
}: Props) {
  const cargar = useCallback(
    () => pagosService.getProximaCuota(cajaId, creditoId),
    [cajaId, creditoId],
  )
  const { datos: cuota, cargando, error } = useDatos(cargar)

  const desglose = (() => {
    if (!cuota?.pendiente) return null
    const capital = cuota.falta_capital ?? 0
    const interes = cuota.falta_interes ?? 0
    if (tipo === "solo_capital") return { capital, interes: 0, total: capital }
    if (tipo === "solo_interes") return { capital: 0, interes, total: interes }
    return { capital, interes, total: +(capital + interes).toFixed(2) }
  })()

  // Por ejemplo, pedir solo interés cuando el interés de la cuota ya está pagado
  const nadaQuePagar = desglose !== null && desglose.total <= 0
  const puedePagar = Boolean(cuota?.pendiente && desglose && !nadaQuePagar)
  const vencidas = cuota?.cuotas_vencidas?.length ?? 0

  return (
    <Modal
      abierto
      onCerrar={onCancelar}
      titulo={TIPO_PAGO[tipo].titulo}
      descripcion={TIPO_PAGO[tipo].explicacion}
      acciones={
        <>
          <Button label={puedePagar ? "Cancelar" : "Cerrar"} variant="ghost" onClick={onCancelar} />
          {puedePagar && (
            <Button label="Confirmar pago" loading={procesando} onClick={onConfirmar} />
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {cargando && <LoadingState texto="Calculando la cuota…" />}

        {!cargando && error && <p className="text-sm text-destructivo">{error}</p>}

        {!cargando && cuota && !cuota.pendiente && (
          <p className="text-sm text-secondary">{cuota.mensaje ?? "No hay cuotas pendientes."}</p>
        )}

        {!cargando && cuota?.pendiente && (
          <>
            <p className="text-sm text-secondary">
              {nombreSocio && (
                <>
                  Pago de <strong className="font-medium text-primary">{nombreSocio}</strong>.{" "}
                </>
              )}
              Cuota {cuota.numero_cuota} de {cuota.total_cuotas}
              {cuota.es_ultima && " (la última)"}.
            </p>

            {cuota.vencida && (
              <div className="flex gap-3 rounded-lg border-l-[3px] border-destructivo bg-surface-2 p-3">
                <span className="flex h-5 shrink-0 items-center">
                  <TriangleAlert size={16} className="text-destructivo" aria-hidden="true" />
                </span>
                <p className="text-sm text-primary">
                  Cuota atrasada: venció el {fecha(cuota.fecha_vencimiento)}.
                  {vencidas > 1 && ` Hay ${vencidas} cuotas vencidas en total.`}
                </p>
              </div>
            )}

            {nadaQuePagar && (
              <p className="text-sm text-primary">
                {tipo === "solo_capital"
                  ? `El capital de la cuota ${cuota.numero_cuota} ya está pagado.`
                  : `El interés de la cuota ${cuota.numero_cuota} ya está pagado.`}
              </p>
            )}

            {puedePagar && desglose && (
              <>
                <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-lg bg-surface-2 p-4 text-sm">
                  {desglose.capital > 0 && (
                    <>
                      <dt className="text-secondary">Capital</dt>
                      <dd className="text-right text-primary tabular-nums">
                        {moneda(desglose.capital)}
                      </dd>
                    </>
                  )}
                  {desglose.interes > 0 && (
                    <>
                      <dt className="text-secondary">Interés</dt>
                      <dd className="text-right text-primary tabular-nums">
                        {moneda(desglose.interes)}
                      </dd>
                    </>
                  )}
                  <div className="col-span-2 mt-1 flex justify-between gap-6 border-t border-base pt-2 font-medium text-primary">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{moneda(desglose.total)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted">Un pago registrado no se puede deshacer.</p>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
