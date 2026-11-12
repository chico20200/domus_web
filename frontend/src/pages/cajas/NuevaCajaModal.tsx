import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { cajasService } from "../../api/cajas.service"
import type { MiCaja } from "../../api/cajas.types"

/**
 * Crear una caja: hoy solo nombre y descripción. Es la migración visual del formulario que
 * había en la página; el asistente de cinco pasos de §5.1 (qué es una caja, políticas,
 * datos con el ciclo, confirmación y siguientes pasos) lo reemplaza en la Etapa 4.
 */

interface Props {
  onCerrar: () => void
  onCreada: (caja: MiCaja) => void
}

export function NuevaCajaModal({ onCerrar, onCreada }: Props) {
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [errorNombre, setErrorNombre] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function crear() {
    setErrorGeneral("")
    if (!nombre.trim()) return setErrorNombre("Escribe el nombre de la caja")
    setGuardando(true)
    try {
      const { caja } = await cajasService.crear({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
      })
      onCreada({
        id: caja.id,
        nombre: caja.nombre,
        descripcion: caja.descripcion,
        rol: "coordinador",
      })
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo crear la caja")
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Crear una caja"
      descripcion="La caja representa a tu organización. Su información no se comparte con otras cajas, y quien la crea queda como coordinador."
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={crear}
        error={errorGeneral}
        actions={
          <>
            <Button type="submit" label="Crear caja" loading={guardando} />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <TextField
          label="Nombre de la caja"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setErrorNombre("")
          }}
          placeholder="Caja Comunitaria Norte"
          maxLength={80}
          error={errorNombre}
          required
          autoFocus
        />
        <TextField
          label="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Para quién es y qué hace la caja"
          maxLength={160}
          hint="Opcional."
        />
      </Form>
    </Modal>
  )
}
