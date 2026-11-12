import type { ChangeEvent, FocusEvent } from "react"
import { ChevronDown } from "lucide-react"
import { FieldBase, type FieldBaseProps } from "./FieldBase"

/**
 * Lista desplegable sobre FieldBase (especificaciones §3, Select).
 *
 * Los valores son texto, como los entrega el <select> del navegador. Si la página guarda
 * un número, lo convierte en onChange (Number(e.target.value)).
 *
 * `placeholder` agrega una primera opción vacía y no seleccionable ("Selecciona un socio…").
 * Una opción "Todos" de un filtro no es placeholder: va en `options` con su propio valor.
 */

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectFieldProps extends Omit<FieldBaseProps, "children" | "icon"> {
  value: string
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (e: FocusEvent<HTMLSelectElement>) => void
  options: SelectOption[]
  placeholder?: string
  name?: string
  autoComplete?: string
}

export function SelectField({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  name,
  autoComplete,
  ...base
}: SelectFieldProps) {
  // Sin selección, el placeholder va atenuado como el de un input vacío. Las opciones de la
  // lista conservan el color normal, porque algunos navegadores lo heredan del <select>.
  const sinSeleccion = placeholder !== undefined && value === ""
  const clasesSelect = (base: string) =>
    [
      sinSeleccion ? base.replace("text-primary", "text-muted") : base,
      "cursor-pointer appearance-none [&>option]:text-primary",
    ].join(" ")

  return (
    // El chevron ocupa el lugar del ícono de FieldBase; appearance-none quita la flecha nativa
    <FieldBase {...base} icon={ChevronDown}>
      {(control) => (
        <select
          {...control}
          className={clasesSelect(control.className)}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          name={name}
          autoComplete={autoComplete}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldBase>
  )
}
