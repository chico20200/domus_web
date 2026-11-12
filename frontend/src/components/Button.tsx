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
  onClick?: () => void
}

const VARIANTES: Record<ButtonVariant, string> = {
  primary: "bg-accion-primaria text-sobre-accion enabled:hover:bg-accion-primaria-hover",
  secondary: "border-accion-primaria text-accion-primaria enabled:hover:bg-surface-2",
  ghost: "text-secondary enabled:hover:bg-surface-2 enabled:hover:text-primary",
  destructive: "bg-destructivo text-sobre-accion enabled:hover:bg-destructivo-hover",
}

const BASE = [
  "inline-flex items-center justify-center gap-2",
  // Borde transparente en todas las variantes para que midan lo mismo que secondary
  "rounded-lg border border-transparent px-4 py-2",
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
