import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { fondosService } from "../../api/fondos.service"
import type { Fondo, TipoMovimientoFondo } from "../../api/fondos.types"
import { moneda } from "../../lib/format"

/**
 * Depósito o retiro en un fondo (T19). Igual que en Ahorros, en dos pasos: el monto y para
 * qué es; después un resumen con el saldo que quedará, que hay que confirmar. La
 * descripción es obligatoria: es dinero de todos.
 */

interface Props {
  tipo: TipoMovimientoFondo
  cajaId: string
  fondo: Fondo
  onCerrar: () => void
  onHecho: () => void | Promise<void>
}

const TEXTOS: Record<TipoMovimientoFondo, { titulo: string; verbo: string; ejemplo: string }> = {
  deposito: { titulo: "Registrar depósito", verbo: "Depósito", ejemplo: "Ej.: rifa de noviembre" },
  retiro: {
    titulo: "Registrar retiro",
    verbo: "Retiro",
    ejemplo: "Ej.: refrigerio de la asamblea",
  },
}

export function MovimientoFondoModal({ tipo, cajaId, fondo, onCerrar, onHecho }: Props) {
  const textos = TEXTOS[tipo]
  const saldo = fondo.saldo
  const [monto, setMonto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [errorMonto, setErrorMonto] = useState("")
  const [errorDescripcion, setErrorDescripcion] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const [revisando, setRevisando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const m = Number(monto)
  const saldoDespues = +(tipo === "deposito" ? saldo + m : saldo - m).toFixed(2)

  function revisar() {
    setErrorGeneral("")
    let ok = true
    if (!(m > 0)) {
      setErrorMonto("Indica un monto mayor que 0")
      ok = false
    } else if (!/^\d+([.,]\d{1,2})?$/.test(monto.trim())) {
      setErrorMonto("Usa como máximo dos decimales")
      ok = false
    } else if (tipo === "retiro" && m > saldo) {
      setErrorMonto(`El saldo del fondo es ${moneda(saldo)}`)
      ok = false
    }
    if (descripcion.trim().length < 3) {
      setErrorDescripcion("Escribe para qué es el movimiento")
      ok = false
    }
    if (ok) setRevisando(true)
  }

  async function guardar() {
    setGuardando(true)
    setErrorGeneral("")
    try {
      await fondosService.registrar(cajaId, fondo.id, tipo, m, descripcion.trim())
      await onHecho()
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo registrar el movimiento")
      setRevisando(false)
    } finally {
      setGuardando(false)
    }
  }

  if (revisando) {
    return (
      <Modal
        abierto
        onCerrar={onCerrar}
        titulo={`Revisa el ${textos.verbo.toLowerCase()}`}
        descripcion={fondo.nombre}
        cerrarAlClicFuera={false}
        acciones={
          <>
            <Button
              label="Volver a editar"
              variant="ghost"
              disabled={guardando}
              onClick={() => setRevisando(false)}
            />
            <Button
              label={`Confirmar ${textos.verbo.toLowerCase()}`}
              loading={guardando}
              onClick={guardar}
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
            <div className="col-span-2 flex justify-between gap-6">
              <dt className="text-secondary">Descripción</dt>
              <dd className="text-right text-primary">{descripcion.trim()}</dd>
            </div>
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
      descripcion={`${fondo.nombre}. Saldo actual: ${moneda(saldo)}.`}
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
          onChange={(e) => {
            setDescripcion(e.target.value)
            setErrorDescripcion("")
          }}
          placeholder={textos.ejemplo}
          hint={tipo === "deposito" ? "De dónde viene el dinero." : "En qué se usa el dinero."}
          error={errorDescripcion}
          maxLength={200}
          required
        />
      </Form>
    </Modal>
  )
}
