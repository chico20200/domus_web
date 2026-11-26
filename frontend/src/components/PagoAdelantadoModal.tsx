import { useState } from "react"
import { Info } from "lucide-react"
import { Modal } from "./Modal"
import { Form } from "./Form"
import { Button } from "./Button"
import { TextField } from "./TextField"
import { CampoComprobante } from "./CampoComprobante"
import type { CuotaAdelantable } from "../api/pagos.types"
import { planAdelanto } from "../lib/adelanto"
import { moneda } from "../lib/format"
import { AYUDA } from "../lib/ayuda"

/**
 * Pago adelantado por monto (T30). El capital se aplica desde la última cuota hacia
 * atrás: las cuotas que cubre enteras quedan pagadas y no cobran interés; la que queda a
 * medias conserva su interés completo. Muestra cuota por cuota cómo quedaría antes de
 * registrarlo.
 */

interface Props {
  maximo: number
  cuotas: CuotaAdelantable[]
  nombreSocio?: string
  procesando?: boolean
  onConfirmar: (monto: number, foto: Blob | null) => void
  onCancelar: () => void
}

export function PagoAdelantadoModal({
  maximo,
  cuotas,
  nombreSocio,
  procesando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const [monto, setMonto] = useState("")
  const [foto, setFoto] = useState<Blob | null>(null)
  const [error, setError] = useState<string>()

  const m = Number(monto)
  const partes = m > 0 ? planAdelanto(cuotas, m) : null
  const condonado = partes ? +partes.reduce((s, p) => s + p.interes_condonado, 0).toFixed(2) : 0

  function enviar() {
    if (!(m > 0)) return setError("Indica un monto mayor que 0")
    if (!/^\d+(\.\d{1,2})?$/.test(monto.trim())) return setError("Usa hasta dos decimales")
    if (m > maximo + 0.001) return setError(`Se pueden adelantar hasta ${moneda(maximo)}`)
    onConfirmar(m, foto)
  }

  return (
    <Modal
      abierto
      onCerrar={onCancelar}
      titulo="Pago adelantado"
      descripcion={nombreSocio}
      ayuda={AYUDA.abonoPrepago}
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={enviar}
        actions={
          <>
            <Button type="submit" label="Registrar pago adelantado" loading={procesando} />
            <Button label="Cancelar" variant="ghost" onClick={onCancelar} />
          </>
        }
      >
        <dl className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 rounded-lg bg-surface-2 p-4 text-sm">
          <dt className="text-secondary">Se puede adelantar hasta</dt>
          <dd className="text-right font-medium text-primary tabular-nums">{moneda(maximo)}</dd>
          <dt className="text-secondary">Cuotas que se pueden adelantar</dt>
          <dd className="text-right text-primary tabular-nums">
            {[...cuotas]
              .reverse()
              .map((c) => c.numero_cuota)
              .join(", ")}
          </dd>
        </dl>

        <TextField
          label="Capital a adelantar ($)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            setError(undefined)
          }}
          placeholder="0.00"
          error={error}
          required
        />

        {partes && (
          <div
            aria-live="polite"
            className="flex flex-col gap-2 rounded-lg border border-base p-4 text-sm"
          >
            <p className="font-medium text-primary">Así quedarían las cuotas</p>
            <ul className="flex flex-col gap-2">
              {partes.map((p) => (
                <li key={p.numero_cuota} className="flex flex-col">
                  <span className="flex justify-between gap-4">
                    <span className="text-primary">Cuota {p.numero_cuota}</span>
                    <span className="text-primary tabular-nums">{moneda(p.capital)}</span>
                  </span>
                  <span className="text-xs text-secondary">
                    {p.interes_condonado > 0
                      ? `Queda pagada; se condonan ${moneda(p.interes_condonado)} de interés`
                      : `Quedan ${moneda(p.resta_capital)} de capital + ${moneda(p.interes)} de interés, en su mes`}
                  </span>
                </li>
              ))}
            </ul>
            {condonado > 0 && (
              <p className="border-t border-base pt-2 text-secondary">
                Interés condonado en total:{" "}
                <span className="text-primary tabular-nums">{moneda(condonado)}</span>
              </p>
            )}
          </div>
        )}

        <CampoComprobante valor={foto} onCambio={setFoto} />

        <p className="flex gap-2 text-xs text-secondary">
          <Info size={14} className="mt-px shrink-0" aria-hidden="true" />
          El capital se aplica desde la última cuota hacia atrás. Las cuotas que se cubren enteras
          no cobran interés; la que queda a medias conserva su interés completo.
        </p>
      </Form>
    </Modal>
  )
}
