import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { ahorrosService } from "../../api/ahorros.service"
import { moneda } from "../../lib/format"

/**
 * Depósito o retiro en una cuenta (HU-O03). Dos pasos en el mismo modal: primero el monto
 * y la descripción; después un resumen con el saldo que quedará, que hay que confirmar
 * antes de guardar. Un movimiento registrado no se puede deshacer.
 */

export type TipoOperacion = "deposito" | "retiro"

interface Props {
  tipo: TipoOperacion
  cajaId: string
  cuentaId: string
  numeroCuenta: string
  titular: string
  saldo: number
  onCerrar: () => void
  onHecho: () => void | Promise<void>
}

const TEXTOS: Record<TipoOperacion, { titulo: string; verbo: string; confirmar: string }> = {
  deposito: { titulo: "Registrar depósito", verbo: "Depósito", confirmar: "Confirmar depósito" },
  retiro: { titulo: "Registrar retiro", verbo: "Retiro", confirmar: "Confirmar retiro" },
}

export function OperacionModal({
  tipo,
  cajaId,
  cuentaId,
  numeroCuenta,
  titular,
  saldo,
  onCerrar,
  onHecho,
}: Props) {
  const textos = TEXTOS[tipo]
  const [monto, setMonto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [errorMonto, setErrorMonto] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const [revisando, setRevisando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const m = Number(monto)
  const saldoDespues = +(tipo === "deposito" ? saldo + m : saldo - m).toFixed(2)

  function revisar() {
    setErrorGeneral("")
    if (!(m > 0)) return setErrorMonto("Indica un monto mayor que 0")
    if (!/^\d+([.,]\d{1,2})?$/.test(monto.trim())) {
      return setErrorMonto("Usa como máximo dos decimales")
    }
    if (tipo === "retiro" && m > saldo) {
      return setErrorMonto(`El saldo disponible es ${moneda(saldo)}`)
    }
    setRevisando(true)
  }

  async function guardar() {
    setGuardando(true)
    setErrorGeneral("")
    try {
      const fn = tipo === "deposito" ? ahorrosService.depositar : ahorrosService.retirar
      await fn(cajaId, cuentaId, m, descripcion.trim())
      await onHecho()
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo registrar el movimiento")
      setRevisando(false)
    } finally {
      setGuardando(false)
    }
  }

  const contexto = `${titular} · cuenta ${numeroCuenta}`

  if (revisando) {
    return (
      <Modal
        abierto
        onCerrar={onCerrar}
        titulo={`Revisa el ${textos.verbo.toLowerCase()}`}
        descripcion={contexto}
        cerrarAlClicFuera={false}
        acciones={
          <>
            <Button label={textos.confirmar} loading={guardando} onClick={guardar} />
            <Button
              label="Volver a editar"
              variant="ghost"
              disabled={guardando}
              onClick={() => setRevisando(false)}
            />
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 rounded-lg bg-surface-2 p-4 text-sm">
            <dt className="text-secondary">Saldo actual</dt>
            <dd className="text-right text-primary tabular-nums">{moneda(saldo)}</dd>
            <dt className="text-secondary">{textos.verbo}</dt>
            <dd className="text-right text-primary tabular-nums">
              {tipo === "deposito" ? "+" : "−"} {moneda(m)}
            </dd>
            <div className="col-span-2 flex justify-between gap-6 border-t border-base pt-2">
              <dt className="font-medium text-primary">Saldo después</dt>
              <dd className="font-medium text-primary tabular-nums">{moneda(saldoDespues)}</dd>
            </div>
            {descripcion.trim() && (
              <div className="col-span-2 flex justify-between gap-6">
                <dt className="text-secondary">Descripción</dt>
                <dd className="text-right text-primary">{descripcion.trim()}</dd>
              </div>
            )}
          </dl>
          <p className="text-xs text-secondary">Un movimiento registrado no se puede deshacer.</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={textos.titulo}
      descripcion={`${contexto}. Saldo actual: ${moneda(saldo)}.`}
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={revisar}
        error={errorGeneral}
        actions={
          <>
            <Button type="submit" label="Continuar" />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <TextField
          label="Monto ($)"
          type="number"
          inputMode="decimal"
          min={0}
          max={tipo === "retiro" ? saldo : undefined}
          step="0.01"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value)
            setErrorMonto("")
          }}
          placeholder="0,00"
          hint={tipo === "retiro" ? `Hasta ${moneda(saldo)}.` : undefined}
          error={errorMonto}
          required
          autoFocus
        />
        <TextField
          label="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={tipo === "deposito" ? "Ej.: aporte mensual" : "Ej.: gastos médicos"}
          hint="Opcional. Aparece en el historial de la cuenta."
          maxLength={120}
        />
      </Form>
    </Modal>
  )
}
