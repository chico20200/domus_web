import { useRef, type FormEvent, type ReactNode } from "react"
import { CircleAlert } from "lucide-react"

/**
 * Formulario (especificaciones §5.2 y §5.5).
 *
 * - Envuelve en un <form> real: Enter en cualquier campo envía, y el navegador puede
 *   autocompletar y guardar contraseñas.
 * - Llama a preventDefault: la página no se recarga.
 * - noValidate: la validación la hace la aplicación, no los globos del navegador.
 * - Mientras un envío asíncrono está en curso, ignora envíos repetidos (Enter dos veces).
 * - `error` es el error general del formulario: el que no pertenece a un campo
 *   ("Correo o contraseña incorrectos", un fallo del servidor). Los errores de un campo
 *   van en ese campo. Se anuncia al lector de pantalla.
 *
 * Orden fijo: campos, error general, acciones. El botón que envía lleva type="submit".
 *
 *   <Form onSubmit={guardar} error={errorGeneral}
 *         actions={<><Button type="submit" label="Guardar" loading={guardando} />
 *                    <Button variant="ghost" label="Cancelar" onClick={cerrar} /></>}>
 *     <TextField ... />
 *   </Form>
 */

interface FormProps {
  onSubmit: () => void | Promise<void>
  /** Error general del formulario */
  error?: string
  /**
   * Botones en fila después del error, alineados a la izquierda: el de enviar primero y
   * Cancelar después. En el pie de `Modal`, que alinea a la derecha, es al revés
   */
  actions?: ReactNode
  /** Nombre accesible del formulario, si la página tiene más de uno */
  "aria-label"?: string
  children: ReactNode
}

export function Form({ onSubmit, error, actions, "aria-label": ariaLabel, children }: FormProps) {
  const enviando = useRef(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando.current) return
    enviando.current = true
    try {
      await onSubmit()
    } finally {
      enviando.current = false
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-label={ariaLabel} className="flex flex-col gap-4">
      {children}

      {/* Siempre montado para que el lector de pantalla anuncie el error cuando aparece */}
      <div role="alert" className="empty:hidden">
        {error && (
          <p className="flex items-start gap-2 text-sm text-destructivo">
            {/* h-5 = alto de línea de text-sm: el ícono queda centrado con la primera línea */}
            <span className="flex h-5 shrink-0 items-center">
              <CircleAlert size={16} aria-hidden="true" />
            </span>
            {error}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </form>
  )
}
