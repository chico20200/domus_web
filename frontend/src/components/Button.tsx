import type { LucideIcon } from "lucide-react"
import { LoaderCircle } from "lucide-react"

/**
 * Variantes por prioridad de la acción (especificaciones §2.2), no por color:
 * - primary: la acción que la pantalla existe para hacer. Una sola por pantalla.
 * - secondary: acción alternativa real (Ver tabla, Generar nuevo código).
 * - ghost: salida sin consecuencia (Cancelar, Cerrar, Volver).
 * - destructive: borra o desactiva. Siempre con confirmación previa.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive"

interface ButtonProps {
  label: string
  variant?: ButtonVariant
  /** "button" por defecto, para que un botón dentro de un formulario no lo envíe sin querer */
  type?: "button" | "submit"
  disabled?: boolean
  /** Muestra un indicador de carga, bloquea el botón y conserva el texto */
  loading?: boolean
  /** Ocupa todo el ancho del contenedor */
  fullWidth?: boolean
  icon?: LucideIcon
  /**
   * Nombre completo para el lector de pantalla cuando el texto visible se repite, como
   * "Registrar pago" en cada fila de una tabla. Debe empezar con el texto visible.
   */
  ariaLabel?: string
  onClick?: () => void
}

// Cada variante fija su propio color de borde. No poner border-transparent en BASE:
// tiene la misma especificidad que border-accion-texto y, según el orden del CSS
// generado, taparía el contorno de secondary.
const VARIANTES: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accion-primaria text-sobre-accion enabled:hover:bg-accion-primaria-hover",
  secondary: "border-accion-texto text-accion-texto enabled:hover:bg-surface-2",
  ghost: "border-transparent text-secondary enabled:hover:bg-surface-2 enabled:hover:text-primary",
  destructive:
    "border-transparent bg-destructivo text-sobre-accion enabled:hover:bg-destructivo-hover",
}

const BASE = [
  "inline-flex items-center justify-center gap-2",
  // Todas las variantes tienen borde de 1 px (transparente salvo secondary): miden lo mismo
  "rounded-lg border px-4 py-2",
  "text-sm font-medium",
  "transition-colors cursor-pointer",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ")

export function Button({
  label,
  variant = "primary",
  type = "button",
  disabled = false,
  loading = false,
  fullWidth = false,
  icon: Icon,
  ariaLabel,
  onClick,
}: ButtonProps) {
  const clases = [BASE, VARIANTES[variant], fullWidth ? "w-full" : ""].join(" ")

  return (
    <button
      type={type}
      className={clases}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
    >
      {loading ? (
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} aria-hidden="true" />
      )}
      {label}
    </button>
  )
}
