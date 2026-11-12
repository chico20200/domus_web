import type { LucideIcon } from "lucide-react"
import { FieldBase } from "./FieldBase"

/**
 * Campo de texto sobre FieldBase. En T8 pasa a llamarse TextField y este nombre queda
 * como alias.
 */
interface FieldProps {
  label: string
  hint?: string
  error?: string
  disabled?: boolean
  placeholder?: string
  type: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  icon?: LucideIcon
  required?: boolean
}

export function Field({
  label,
  hint,
  error,
  disabled = false,
  placeholder,
  type = "text",
  value,
  onChange,
  icon,
  required = false,
}: FieldProps) {
  return (
    <FieldBase
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      required={required}
      icon={icon}
    >
      {(control) => (
        <input
          {...control}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      )}
    </FieldBase>
  )
}
