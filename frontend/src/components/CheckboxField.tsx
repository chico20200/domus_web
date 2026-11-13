import { useId, type ChangeEvent } from "react"

/**
 * Casilla de verificación con su etiqueta al lado, para aceptar algo (políticas de uso,
 * acuerdo de confidencialidad). Como los demás campos, la ayuda o el error van debajo y
 * se enlazan con aria-describedby; el error usa el color destructivo.
 */

interface CheckboxFieldProps {
  label: string
  checked: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  name?: string
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  error,
  required = false,
  disabled = false,
  name,
}: CheckboxFieldProps) {
  const id = useId()
  const mensajeId = `${id}-mensaje`
  const mensaje = error || hint

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        {/* h-5 = alto de línea de text-sm: la casilla queda centrada con la primera línea */}
        <span className="flex h-5 shrink-0 items-center">
          <input
            id={id}
            type="checkbox"
            name={name}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={mensaje ? mensajeId : undefined}
            className="size-4 cursor-pointer accent-accion-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        </span>
        <label htmlFor={id} className="cursor-pointer text-sm text-primary">
          {label}
          {required && (
            <span className="ml-1 text-destructivo" aria-hidden="true">
              *
            </span>
          )}
        </label>
      </div>
      {mensaje && (
        <p id={mensajeId} className={`pl-7 text-xs ${error ? "text-destructivo" : "text-muted"}`}>
          {mensaje}
        </p>
      )}
    </div>
  )
}
