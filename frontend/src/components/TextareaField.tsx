import type { ChangeEvent, FocusEvent } from "react"
import { FieldBase, type FieldBaseProps } from "./FieldBase"

/**
 * Texto de varias líneas sobre FieldBase (especificaciones §3, Textarea):
 * observaciones, motivos, descripciones.
 *
 * Con `maxLength`, muestra un contador "n / máximo" bajo el campo, a la derecha.
 */

export interface TextareaFieldProps extends Omit<FieldBaseProps, "children" | "icon"> {
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void
  name?: string
  placeholder?: string
  /** Alto inicial en líneas. Por defecto 3; el usuario puede agrandarlo hacia abajo */
  rows?: number
  maxLength?: number
}

export function TextareaField({
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  rows = 3,
  maxLength,
  ...base
}: TextareaFieldProps) {
  return (
    <FieldBase {...base}>
      {(control) => (
        <>
          <textarea
            {...control}
            className={`${control.className} block resize-y`}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            name={name}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
          />
          {maxLength !== undefined && (
            <p className="mt-1 text-right text-xs text-muted">
              {value.length} / {maxLength}
            </p>
          )}
        </>
      )}
    </FieldBase>
  )
}
