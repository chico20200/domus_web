// src/components/AbonoModal.tsx
import { useCallback, useState } from "react"
import { Info } from "lucide-react"
import { Modal } from "./Modal"
import { Form } from "./Form"
import { Button } from "./Button"
import { TextField } from "./TextField"
import { SelectField } from "./SelectField"
import { LoadingState } from "./LoadingState"
import { Badge } from "./Badge"
import { pagosService } from "../api/pagos.service"
import { moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"

/**
 * Abono parcial a la cuota en curso, con motivo obligatorio. Se aplica primero al capital
 * y la cuota sigue pendiente hasta cubrirla completa. Muestra cómo se aplicaría el monto
 * antes de registrarlo.
 */

const OTRO = "Otro"
const MOTIVOS = [
  "Dificultad económica temporal",
  "Enfermedad o gasto médico",
  "Pérdida o reducción de ingresos",
  "Emergencia familiar",
  OTRO,
]

interface Props {
  cajaId: string
  creditoId: string
  nombreSocio?: string
  procesando?: boolean
  onConfirmar: (monto: number, motivo: string) => void
  onCancelar: () => void
}

type Errores = Partial<Record<"monto" | "motivo" | "otro", string>>

export function AbonoModal({
  cajaId,
  creditoId,
  nombreSocio,
  procesando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const cargar = useCallback(
    () => pagosService.getProximaCuota(cajaId, creditoId),
    [cajaId, creditoId],
  )
  const { datos: cuota, cargando, error: errorCarga } = useDatos(cargar)

  const [monto, setMonto] = useState("")
  const [motivoSel, setMotivoSel] = useState("")
  const [motivoOtro, setMotivoOtro] = useState("")
  const [errores, setErrores] = useState<Errores>({})

  const pendienteCuota = cuota?.falta_total ?? 0
  const m = Number(monto)

  const simulacion =
    m > 0 && cuota?.pendiente
      ? (() => {
          const capital = Math.min(m, cuota.falta_capital ?? 0)
          const interes = +(m - capital).toFixed(2)
          return {
            capital: +capital.toFixed(2),
            interes: interes > 0 ? interes : 0,
            restante: +(pendienteCuota - m).toFixed(2),
          }
        })()
      : null

  // Al editar un campo se borra su error; se vuelve a validar al enviar
  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  function enviar() {
    const e: Errores = {}
    if (!(m > 0)) e.monto = "Indica un monto mayor que 0"
    else if (m > pendienteCuota + 0.001)
      e.monto = `No puede superar lo pendiente de la cuota (${moneda(pendienteCuota)})`
    if (!motivoSel) e.motivo = "Elige el motivo del abono"
    else if (motivoSel === OTRO && !motivoOtro.trim()) e.otro = "Describe el motivo"
    setErrores(e)
    if (Object.keys(e).length > 0) return
    onConfirmar(m, motivoSel === OTRO ? motivoOtro.trim() : motivoSel)
  }

  const conCuota = !cargando && cuota?.pendiente

  return (
    <Modal
      abierto
      onCerrar={onCancelar}
      titulo="Abono parcial"
      descripcion={nombreSocio}
      cerrarAlClicFuera={false}
    >
      {cargando && <LoadingState texto="Cargando la cuota…" />}

      {!cargando && errorCarga && <p className="text-sm text-destructivo">{errorCarga}</p>}

      {!cargando && cuota && !cuota.pendiente && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">{cuota.mensaje ?? "No hay cuotas pendientes."}</p>
          <div className="flex justify-end">
            <Button label="Cerrar" variant="ghost" onClick={onCancelar} />
          </div>
        </div>
      )}

      {conCuota && (
        <Form
          onSubmit={enviar}
          actions={
            <>
              <Button type="submit" label="Registrar abono" loading={procesando} />
              <Button label="Cancelar" variant="ghost" onClick={onCancelar} />
            </>
          }
        >
          <dl className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 rounded-lg bg-surface-2 p-4 text-sm">
            <dt className="text-secondary">
              Cuota {cuota.numero_cuota} de {cuota.total_cuotas}
            </dt>
            <dd className="text-right">
              {cuota.vencida && <Badge tono="destructivo" label="Vencida" />}
            </dd>
            <dt className="text-secondary">Pendiente de la cuota</dt>
            <dd className="text-right font-medium text-primary tabular-nums">
              {moneda(pendienteCuota)}
            </dd>
          </dl>

          <TextField
            label="Monto a abonar ($)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              limpiar("monto")
            }}
            placeholder="0.00"
            error={errores.monto}
            required
          />

          {simulacion && (
            <dl
              aria-live="polite"
              className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-lg border border-base p-4 text-sm"
            >
              <dt className="col-span-2 mb-1 font-medium text-primary">Se aplicará así</dt>
              <dt className="text-secondary">A capital</dt>
              <dd className="text-right text-primary tabular-nums">{moneda(simulacion.capital)}</dd>
              {simulacion.interes > 0 && (
                <>
                  <dt className="text-secondary">A interés</dt>
                  <dd className="text-right text-primary tabular-nums">
                    {moneda(simulacion.interes)}
                  </dd>
                </>
              )}
              {simulacion.restante > 0.001 && (
                <div className="col-span-2 mt-1 flex justify-between gap-6 border-t border-base pt-2">
                  <dt className="text-secondary">Quedará pendiente de la cuota</dt>
                  <dd className="text-primary tabular-nums">{moneda(simulacion.restante)}</dd>
                </div>
              )}
            </dl>
          )}

          <SelectField
            label="Motivo del abono"
            value={motivoSel}
            onChange={(e) => {
              setMotivoSel(e.target.value)
              limpiar("motivo")
            }}
            placeholder="Selecciona un motivo…"
            options={MOTIVOS.map((x) => ({ value: x, label: x }))}
            error={errores.motivo}
            required
          />

          {motivoSel === OTRO && (
            <TextField
              label="Describe el motivo"
              value={motivoOtro}
              onChange={(e) => {
                setMotivoOtro(e.target.value)
                limpiar("otro")
              }}
              placeholder="Ej.: retraso en el pago de su empleador"
              error={errores.otro}
              required
            />
          )}

          <p className="flex gap-2 text-xs text-secondary">
            <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
            El abono se aplica primero al capital. La cuota sigue pendiente hasta cubrirla completa.
          </p>
        </Form>
      )}
    </Modal>
  )
}
