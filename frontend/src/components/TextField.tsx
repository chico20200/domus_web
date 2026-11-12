import { useState, type ChangeEvent, type FocusEvent, type HTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"
import { FieldBase, type FieldBaseProps } from "./FieldBase"

/**
 * Campo de una línea: texto, correo, contraseña, teléfono, número y fecha
 * (especificaciones §3.1, Field).
 *
 * - `name` y `autoComplete` permiten que el navegador autocomplete y guarde contraseñas.
 * - `onBlur` permite validar al salir del campo, no solo al enviar.
 * - `maxLength` e `inputMode` sirven para cédula y teléfono: type="text" con
 *   inputMode="numeric" muestra el teclado numérico sin las flechas de type="number".
 * - En type="date" no se pasa `icon`: el navegador ya pone el suyo a la derecha.
 *   El valor va y viene como "yyyy-MM-dd".
 * - En type="password" va siempre el botón del ojo para mostrar u ocultar lo escrito;
 *   ocupa el lugar del ícono, así que `icon` se ignora.
 */

export type TextFieldType = "text" | "email" | "password" | "tel" | "number" | "date" | "search"

export interface TextFieldProps extends Omit<FieldBaseProps, "children"> {
  type?: TextFieldType
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
  name?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
  maxLength?: number
  /** Para number y date */
  min?: number | string
  max?: number | string
  /** Para number. "0.01" para montos */
  step?: number | string
  autoFocus?: boolean
}

export function TextField({
  type = "text",
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  min,
  max,
  step,
  autoFocus,
  ...base
}: TextFieldProps) {
  const [visible, setVisible] = useState(false)
  const esClave = type === "password"
  const accion = esClave ? (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      disabled={base.disabled}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
      className="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
    >
      {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
    </button>
  ) : undefined

  return (
    <FieldBase {...base} accion={accion}>
      {(control) => (
        <input
          {...control}
          // [&::-ms-reveal]: Edge pone su propio ojo; se oculta para que no salgan dos
          className={esClave ? `${control.className} [&::-ms-reveal]:hidden` : control.className}
          type={esClave && visible ? "text" : type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          min={min}
          max={max}
          step={step}
          autoFocus={autoFocus}
        />
      )}
    </FieldBase>
  )
}
