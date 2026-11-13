import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { cajasService } from "../../api/cajas.service"
import type { MiCaja } from "../../api/cajas.types"

/** Entrar a una caja con el código de invitación que entrega su coordinador */

interface Props {
  onCerrar: () => void
  onUnido: (caja: MiCaja, socioVinculado: boolean) => void
}

export function UnirseModal({ onCerrar, onUnido }: Props) {
  const [codigo, setCodigo] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  async function unirse() {
    const c = codigo.trim()
    if (!c) return setError("Escribe el código de invitación")
    setEnviando(true)
    setError("")
    try {
      const res = await cajasService.unirse(c)
      onUnido(
        {
          id: res.caja.id,
          nombre: res.caja.nombre,
          descripcion: res.caja.descripcion ?? "",
          rol: res.caja.rol,
        },
        res.socioVinculado,
      )
    } catch (err) {
      // El error del código va en el campo: es lo que hay que corregir
      setError(err instanceof Error ? err.message : "No se pudo usar el código")
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Unirse con un código"
      descripcion="Lo genera el coordinador de la caja a la que vas a entrar, en su Configuración. Sirve una sola vez, dura 7 días y define el rol con el que entras."
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={unirse}
        actions={
          <>
            <Button type="submit" label="Unirse" loading={enviando} />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <TextField
          label="Código de invitación"
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.toUpperCase())
            setError("")
          }}
          placeholder="Ej.: AXBK73P2"
          autoComplete="off"
          maxLength={16}
          error={error}
          required
          autoFocus
        />
      </Form>
    </Modal>
  )
}
