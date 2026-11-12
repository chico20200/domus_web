import type { LucideIcon } from "lucide-react"

/** Botón cuadrado de 32 px con solo un ícono. El texto va en aria-label */
export function BotonIcono({
  icono: Icono,
  etiqueta,
  onClick,
}: {
  icono: LucideIcon
  etiqueta: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-base text-secondary transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Icono size={16} aria-hidden="true" />
    </button>
  )
}
