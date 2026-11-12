import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { SelectField } from "../../components/SelectField"
import { ahorrosService } from "../../api/ahorros.service"
import type { Socio } from "../../api/socios.types"

/** Abre una cuenta de ahorro para un socio de la caja (HU-O02) */

interface Props {
  cajaId: string
  socios: Socio[]
  onCerrar: () => void
  onCreada: (numeroCuenta: string) => void | Promise<void>
}

export function NuevaCuentaModal({ cajaId, socios, onCerrar, onCreada }: Props) {
  const [socioId, setSocioId] = useState("")
  const [errorSocio, setErrorSocio] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function enviar() {
    setErrorGeneral("")
    if (!socioId) return setErrorSocio("Elige el socio dueño de la cuenta")
    setGuardando(true)
    try {
      const res = await ahorrosService.abrirCuenta(cajaId, socioId)
      await onCreada(res.cuenta.numero_cuenta)
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo abrir la cuenta")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Abrir cuenta de ahorro"
      descripcion="La cuenta es la libreta de ahorro de un socio dentro de esta caja. Empieza con saldo $0,00 y un socio puede tener más de una."
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={enviar}
        error={errorGeneral}
        actions={
          <>
            <Button type="submit" label="Abrir cuenta" loading={guardando} />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <SelectField
          label="Socio"
          value={socioId}
          onChange={(e) => {
            setSocioId(e.target.value)
            setErrorSocio("")
          }}
          placeholder="Selecciona un socio…"
          options={socios.map((s) => ({
            value: s.id,
            label: `${s.nombre} ${s.apellido} · ${s.cedula}`,
          }))}
          error={errorSocio}
          hint={
            socios.length === 0
              ? "No hay socios activos. Regístralos primero en Socios."
              : undefined
          }
          required
        />
      </Form>
    </Modal>
  )
}
