import type { LucideIcon } from "lucide-react"

/**
 * Tarjeta de métrica (especificaciones §3.1, división de Card). Un número con su etiqueta:
 *
 *   <StatCard etiqueta="Socios activos" valor={12} detalle="15 miembros del sistema"
 *     icono={Users} />
 *
 * `destacada` marca la métrica principal de una rejilla (el saldo total en el Dashboard).
 * No lleva relleno naranja como la Card vieja: el relleno de acción queda para el botón
 * principal (§2.2), y una tarjeta naranja competía con él. Se destaca con un borde y el
 * valor en el color de acción.
 */

interface StatCardProps {
  etiqueta: string
  valor: string | number
  detalle?: string
  icono?: LucideIcon
  destacada?: boolean
}

export function StatCard({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  destacada = false,
}: StatCardProps) {
  return (
    <div
      className={[
        "flex flex-col gap-2 rounded-xl border bg-surface p-4",
        destacada ? "border-accion-texto" : "border-base",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-secondary uppercase">
          {etiqueta}
        </span>
        {Icono && <Icono size={16} className="shrink-0 text-muted" aria-hidden="true" />}
      </div>
      <span
        className={[
          "text-2xl font-semibold tabular-nums",
          destacada ? "text-accion-texto" : "text-primary",
        ].join(" ")}
      >
        {valor}
      </span>
      {detalle && <span className="text-xs text-muted">{detalle}</span>}
    </div>
  )
}
