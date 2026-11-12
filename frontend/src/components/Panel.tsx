import type { ReactNode } from "react"

/**
 * Contenedor genérico (especificaciones §3.1, división de Card). Reemplaza el
 * `div` con borde que cada página escribe a mano.
 *
 *   <Panel titulo="Ciclo de la caja" descripcion="Periodo entre cortes de cuentas"
 *     acciones={<Button label="Editar" variant="ghost" />}>
 *     …
 *   </Panel>
 *
 * - Relleno de 24 px y 24 px entre bloques (SISTEMA_DE_DISENO.md §2).
 * - `sinRelleno` para contenido que llega hasta el borde, como una lista con separadores.
 * - El título es un <h2>: el <h1> de la página está en la barra superior.
 */

interface PanelProps {
  titulo?: string
  descripcion?: string
  /** Botones a la derecha del título */
  acciones?: ReactNode
  sinRelleno?: boolean
  children: ReactNode
}

export function Panel({ titulo, descripcion, acciones, sinRelleno = false, children }: PanelProps) {
  const conCabecera = titulo || descripcion || acciones
  return (
    <section
      className={[
        "flex flex-col rounded-xl border border-base bg-surface",
        sinRelleno ? "" : "gap-6 p-6",
      ].join(" ")}
    >
      {conCabecera && (
        <div
          className={[
            "flex flex-wrap items-start justify-between gap-4",
            sinRelleno ? "border-b border-base p-6" : "",
          ].join(" ")}
        >
          <div className="flex min-w-0 flex-col gap-1">
            {titulo && <h2 className="text-base font-semibold text-primary">{titulo}</h2>}
            {descripcion && <p className="text-sm text-secondary">{descripcion}</p>}
          </div>
          {acciones && <div className="flex shrink-0 flex-wrap gap-3">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
