import type { LucideIcon } from "lucide-react"

/**
 * Etiqueta de estado o de rol (especificaciones §3, Badge).
 *
 * El tono sale del significado, no del gusto:
 * - ok: al día, activo, vigente, pagado a tiempo.
 * - alerta: pendiente, por vencer, requiere atención.
 * - destructivo: en mora, castigado, rechazado, bloqueado.
 * - neutral: roles (socio, tesorero), cerrado, sin estado especial.
 *
 * Contorno sin relleno: con la paleta AA de T3, cualquier fondo teñido baja el contraste
 * del texto de 4,5:1 sobre bg-surface-2. Así el texto queda sobre la superficie y cumple
 * en los dos modos; el borde es decorativo.
 */

export type BadgeTono = "ok" | "alerta" | "destructivo" | "neutral"

interface BadgeProps {
  label: string
  tono?: BadgeTono
  icon?: LucideIcon
}

const TONOS: Record<BadgeTono, string> = {
  ok: "text-estado-ok",
  alerta: "text-estado-alerta",
  destructivo: "text-destructivo",
  neutral: "text-secondary",
}

export function Badge({ label, tono = "neutral", icon: Icon }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border border-current/40 px-2 py-1",
        "text-xs leading-none font-medium whitespace-nowrap",
        TONOS[tono],
      ].join(" ")}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {label}
    </span>
  )
}
