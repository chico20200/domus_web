import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import type { TipoPago } from "../../api/pagos.types"
import { moneda } from "../../lib/format"
import { TIPO_PAGO } from "../../lib/creditos"

/**
 * Primer paso de un pago desde Pagos: elegir si se cubre la cuota completa, solo el
 * capital o solo el interés. Después viene `ConfirmarPagoModal`, que muestra el desglose
 * exacto de la cuota antes de registrar nada.
 */

interface Props {
  nombreSocio: string
  cuotaMensual: number
  onCerrar: () => void
  onContinuar: (tipo: TipoPago) => void
}

const ORDEN: TipoPago[] = ["completo", "solo_capital", "solo_interes"]

export function ElegirPagoModal({ nombreSocio, cuotaMensual, onCerrar, onContinuar }: Props) {
  const [tipo, setTipo] = useState<TipoPago>("completo")

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Registrar pago"
      descripcion={`Crédito de ${nombreSocio}. Cuota mensual de ${moneda(cuotaMensual)}.`}
    >
      <Form
        onSubmit={() => onContinuar(tipo)}
        actions={
          <>
            <Button type="submit" label="Continuar" />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-primary">Qué se paga</legend>
          {ORDEN.map((t) => {
            const elegido = t === tipo
            return (
              <label
                key={t}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  elegido
                    ? "border-accion-texto bg-surface-2"
                    : "border-control hover:bg-surface-2",
                ].join(" ")}
              >
                <span className="flex h-5 shrink-0 items-center">
                  <input
                    type="radio"
                    name="tipo-pago"
                    value={t}
                    checked={elegido}
                    onChange={() => setTipo(t)}
                    className="h-4 w-4 accent-accion-texto focus-visible:outline-none"
                  />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-primary">{TIPO_PAGO[t].etiqueta}</span>
                  <span className="text-xs text-secondary">{TIPO_PAGO[t].explicacion}</span>
                </span>
              </label>
            )
          })}
        </fieldset>
      </Form>
    </Modal>
  )
}
