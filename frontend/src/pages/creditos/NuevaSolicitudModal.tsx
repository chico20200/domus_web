import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { SelectField } from "../../components/SelectField"
import { creditosService } from "../../api/creditos.service"
import type { Socio } from "../../api/socios.types"
import { moneda } from "../../lib/format"

/**
 * Solicitud de crédito para un socio de la caja. Queda pendiente hasta que se aprueba.
 * Muestra una estimación con la misma fórmula del backend (interés simple sobre el
 * capital: total = capital × (1 + tasa anual × meses / 12)).
 */

interface Props {
  cajaId: string
  socios: Socio[]
  onCerrar: () => void
  onCreado: () => void | Promise<void>
}

type Errores = Partial<Record<"socio" | "monto" | "tasa" | "plazo", string>>

export function NuevaSolicitudModal({ cajaId, socios, onCerrar, onCreado }: Props) {
  const [socioId, setSocioId] = useState("")
  const [monto, setMonto] = useState("")
  const [tasa, setTasa] = useState("")
  const [plazo, setPlazo] = useState("")
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState("")
  const [guardando, setGuardando] = useState(false)

  const m = Number(monto)
  const t = Number(tasa)
  const p = Number(plazo)
  const estimacion =
    m > 0 && t > 0 && Number.isInteger(p) && p > 0
      ? (() => {
          const total = +(m * (1 + (t / 100) * (p / 12))).toFixed(2)
          return { total, interes: +(total - m).toFixed(2), cuota: +(total / p).toFixed(2) }
        })()
      : null

  function validar(): Errores {
    const e: Errores = {}
    if (!socioId) e.socio = "Elige el socio que recibe el crédito"
    if (!(m > 0)) e.monto = "Indica un monto mayor que 0"
    if (!(t > 0)) e.tasa = "Indica una tasa mayor que 0"
    if (!(Number.isInteger(p) && p > 0)) e.plazo = "Indica un número entero de meses"
    return e
  }

  // Al editar un campo se borra su error; se vuelve a validar al enviar
  function limpiar(campo: keyof Errores) {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function enviar() {
    const e = validar()
    setErrores(e)
    setErrorGeneral("")
    if (Object.keys(e).length > 0) return
    setGuardando(true)
    try {
      await creditosService.crear(cajaId, {
        socio_id: socioId,
        monto_solicitado: m,
        tasa_interes: t,
        plazo_meses: p,
      })
      await onCreado()
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo crear la solicitud")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Nueva solicitud de crédito"
      descripcion="Se otorga solo a socios de esta caja. Queda pendiente hasta que se apruebe y desembolse."
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={enviar}
        error={errorGeneral}
        actions={
          <>
            <Button type="submit" label="Crear solicitud" loading={guardando} />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <SelectField
          label="Socio"
          value={socioId}
          onChange={(e) => {
            setSocioId(e.target.value)
            limpiar("socio")
          }}
          placeholder="Selecciona un socio…"
          options={socios.map((s) => ({
            value: s.id,
            label: `${s.nombre} ${s.apellido} · ${s.cedula}`,
          }))}
          error={errores.socio}
          hint={socios.length === 0 ? "No hay socios activos en esta caja." : undefined}
          required
        />
        <TextField
          label="Monto ($)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            limpiar("monto")
          }}
          placeholder="1000"
          error={errores.monto}
          required
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Tasa anual (%)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={tasa}
            onChange={(e) => {
              setTasa(e.target.value)
              limpiar("tasa")
            }}
            placeholder="12"
            error={errores.tasa}
            required
          />
          <TextField
            label="Plazo (meses)"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={plazo}
            onChange={(e) => {
              setPlazo(e.target.value)
              limpiar("plazo")
            }}
            placeholder="12"
            hint="Número de cuotas mensuales."
            error={errores.plazo}
            required
          />
        </div>

        {estimacion && (
          <dl
            aria-live="polite"
            className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-lg bg-surface-2 p-4 text-sm"
          >
            <dt className="text-secondary">Interés total</dt>
            <dd className="text-right text-primary tabular-nums">{moneda(estimacion.interes)}</dd>
            <dt className="text-secondary">Total a pagar</dt>
            <dd className="text-right text-primary tabular-nums">{moneda(estimacion.total)}</dd>
            <dt className="text-secondary">Cuota mensual aproximada</dt>
            <dd className="text-right font-medium text-primary tabular-nums">
              {moneda(estimacion.cuota)}
            </dd>
          </dl>
        )}
      </Form>
    </Modal>
  )
}
