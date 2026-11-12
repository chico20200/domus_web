import type { ChangeEvent, FocusEvent, HTMLAttributes } from "react"
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
  return (
    <FieldBase {...base}>
      {(control) => (
        <input
          {...control}
          type={type}
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
