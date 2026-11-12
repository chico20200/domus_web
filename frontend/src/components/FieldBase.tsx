import { useId, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * Base común de los campos de formulario (especificaciones §3.1, Field).
 *
 * Pone la etiqueta, el asterisco de obligatorio, la ayuda, el error y el ícono, y le pasa
 * al control (input, select, textarea) las props que lo conectan con todo eso:
 * id asociado a la etiqueta, aria-describedby hacia la ayuda o el error, aria-invalid,
 * y las clases. Los colores salen de los tokens, así que siguen el modo oscuro solos.
 *
 * Uso:
 *   <FieldBase label="Correo" error={error}>
 *     {(control) => <input {...control} type="email" value={v} onChange={...} />}
 *   </FieldBase>
 */

export interface ControlProps {
  id: string
  className: string
  disabled?: boolean
  "aria-required"?: true
  "aria-invalid"?: true
  "aria-describedby"?: string
}

export interface FieldBaseProps {
  label: string
  /**
   * Oculta la etiqueta a la vista; el lector de pantalla la sigue leyendo. Solo para
   * controles cuyo sentido ya da el contexto, como el rol dentro de una fila de miembro
   */
  ocultarEtiqueta?: boolean
  /** Si no se pasa, se genera uno con useId */
  id?: string
  /** Texto de ayuda bajo el campo. Si hay error, se muestra el error en su lugar */
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  /** Ícono decorativo a la derecha del control */
  icon?: LucideIcon
  /**
   * Botón a la derecha del control, en lugar del ícono (por ejemplo, mostrar u ocultar la
   * contraseña). Si se pasa, `icon` se ignora
   */
  accion?: ReactNode
  children: (control: ControlProps) => ReactNode
}

const CONTROL_BASE = [
  "w-full rounded-lg border bg-surface px-3 py-2",
  "text-sm text-primary placeholder:text-muted",
  "outline-none transition-colors",
  "focus:ring-1",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ")

const CONTROL_NORMAL = "border-control focus:border-focus focus:ring-focus"
const CONTROL_ERROR = "border-destructivo focus:border-destructivo focus:ring-destructivo"

export function FieldBase({
  label,
  ocultarEtiqueta = false,
  id,
  hint,
  error,
  required = false,
  disabled = false,
  icon,
  accion,
  children,
}: FieldBaseProps) {
  const Icon = accion ? undefined : icon
  const autoId = useId()
  const controlId = id ?? autoId
  const mensajeId = `${controlId}-mensaje`

  const mensaje = error || hint
  const hayError = Boolean(error)

  const control: ControlProps = {
    id: controlId,
    // pr-9: 12 px de margen + 16 px del ícono + 8 px de separación (excepción documentada en T4).
    // pr-11: el botón de `accion` ocupa 36 px desde el borde derecho
    className: [
      CONTROL_BASE,
      hayError ? CONTROL_ERROR : CONTROL_NORMAL,
      accion ? "pr-11" : Icon ? "pr-9" : "",
    ].join(" "),
    disabled: disabled || undefined,
    "aria-required": required || undefined,
    "aria-invalid": hayError || undefined,
    "aria-describedby": mensaje ? mensajeId : undefined,
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={controlId}
        className={`text-sm font-medium text-primary ${ocultarEtiqueta ? "sr-only" : ""}`}
      >
        {label}
        {required && (
          <span className="ml-1 text-destructivo" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        {children(control)}
        {Icon && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <Icon
              size={16}
              aria-hidden="true"
              className={hayError ? "text-destructivo" : "text-muted"}
            />
          </span>
        )}
        {accion && <div className="absolute inset-y-0 right-1 flex items-center">{accion}</div>}
      </div>

      {mensaje && (
        <p id={mensajeId} className={`text-xs ${hayError ? "text-destructivo" : "text-muted"}`}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
