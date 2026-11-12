import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * Estado vacío (especificaciones §3, EmptyState). Reemplaza los bloques "Aún no hay…".
 *
 * Dice qué falta y, si el usuario puede resolverlo, ofrece la acción:
 *
 *   <EmptyState icono={Users} titulo="Aún no hay socios"
 *     descripcion="Registra al primer socio para empezar a abrir cuentas."
 *     accion={<Button label="Nuevo socio" icon={UserPlus} onClick={...} />} />
 *
 * Una búsqueda sin resultados también es un estado vacío, pero sin acción de crear:
 *   <EmptyState icono={Search} titulo="Ningún socio coincide con «ana»" />
 */

interface EmptyStateProps {
  titulo: string
  descripcion?: string
  icono?: LucideIcon
  /** Normalmente un Button. Se omite si el rol del usuario no puede crear nada */
  accion?: ReactNode
}

export function EmptyState({ titulo, descripcion, icono: Icono, accion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      {Icono && (
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icono size={24} aria-hidden="true" />
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-base font-medium text-primary">{titulo}</p>
        {descripcion && <p className="text-sm text-secondary">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}
