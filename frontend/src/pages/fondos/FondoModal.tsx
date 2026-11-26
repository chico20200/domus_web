import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { TextareaField } from "../../components/TextareaField"
import { fondosService } from "../../api/fondos.service"
import type { Fondo } from "../../api/fondos.types"

/**
 * Crear un fondo o cambiar su nombre y descripción (T19). Las mismas reglas que la base:
 * nombre de 3 a 60 caracteres, único en la caja, y descripción de hasta 200.
 */

interface Props {
  cajaId: string
  /** Sin fondo, crea uno nuevo */
  fondo?: Fondo
  onCerrar: () => void
  onHecho: (fondo: Fondo) => void | Promise<void>
}

export function FondoModal({ cajaId, fondo, onCerrar, onHecho }: Props) {
  const [nombre, setNombre] = useState(fondo?.nombre ?? "")
  const [descripcion, setDescripcion] = useState(fondo?.descripcion ?? "")
  const [errorNombre, setErrorNombre] = useState("")
  const [errorGeneral, setErrorGeneral] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setErrorGeneral("")
    const n = nombre.trim()
    if (n.length < 3) return setErrorNombre("Escribe al menos 3 caracteres")
    setGuardando(true)
    try {
      const res = fondo
        ? await fondosService.editar(cajaId, fondo.id, n, descripcion.trim())
        : await fondosService.crear(cajaId, n, descripcion.trim())
      await onHecho(res.fondo)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo guardar el fondo"
      // El nombre repetido se marca en su campo
      if (/nombre/i.test(mensaje)) setErrorNombre(mensaje)
      else setErrorGeneral(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={fondo ? "Editar fondo" : "Nuevo fondo"}
      descripcion={
        fondo
          ? undefined
          : "Dinero de la caja para sus actividades, aparte del que se presta a los socios."
      }
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={guardar}
        error={errorGeneral}
        actions={
          <>
            <Button
              type="submit"
              label={fondo ? "Guardar cambios" : "Crear fondo"}
              loading={guardando}
            />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <TextField
          label="Nombre"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setErrorNombre("")
          }}
          placeholder="Ej.: Fondo social"
          error={errorNombre}
          maxLength={60}
          required
          autoFocus
        />
        <TextareaField
          label="Descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej.: para la fiesta de fin de año y los refrigerios de las asambleas"
          hint="Opcional. Para qué se usa este fondo."
          maxLength={200}
          rows={3}
        />
      </Form>
    </Modal>
  )
}
