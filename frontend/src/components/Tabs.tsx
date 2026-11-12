import { useId, useRef, type KeyboardEvent, type ReactNode } from "react"

/**
 * Pestañas que cambian el contenido de una misma sección (Reportes: resumen mensual e
 * interés por socio).
 *
 *   <Tabs etiqueta="Vista del reporte" valor={tab} onCambio={setTab}
 *     pestanas={[{ id: "mensual", titulo: "Resumen mensual" }, …]}>
 *     {tab === "mensual" ? <TablaMensual /> : <TablaSocios />}
 *   </Tabs>
 *
 * Sigue el patrón ARIA de pestañas: Tab entra a la pestaña activa y pasa al panel; las
 * flechas izquierda y derecha (e Inicio y Fin) cambian de pestaña.
 */

interface Pestana<T extends string> {
  id: T
  titulo: string
}

interface TabsProps<T extends string> {
  /** Nombre del grupo para el lector de pantalla */
  etiqueta: string
  pestanas: Pestana<T>[]
  valor: T
  onCambio: (id: T) => void
  children: ReactNode
}

export function Tabs<T extends string>({
  etiqueta,
  pestanas,
  valor,
  onCambio,
  children,
}: TabsProps<T>) {
  const base = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function alPulsar(e: KeyboardEvent<HTMLDivElement>) {
    const i = pestanas.findIndex((p) => p.id === valor)
    const destino =
      e.key === "ArrowRight"
        ? (i + 1) % pestanas.length
        : e.key === "ArrowLeft"
          ? (i - 1 + pestanas.length) % pestanas.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? pestanas.length - 1
              : null
    if (destino === null) return
    e.preventDefault()
    const id = pestanas[destino].id
    onCambio(id)
    refs.current[id]?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={etiqueta}
        onKeyDown={alPulsar}
        className="flex gap-1 border-b border-base"
      >
        {pestanas.map((p) => {
          const activa = p.id === valor
          return (
            <button
              key={p.id}
              ref={(el) => {
                refs.current[p.id] = el
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${p.id}`}
              aria-selected={activa}
              aria-controls={`${base}-panel`}
              tabIndex={activa ? 0 : -1}
              onClick={() => onCambio(p.id)}
              className={[
                "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                activa
                  ? "border-accion-texto font-medium text-accion-texto"
                  : "border-transparent text-secondary hover:text-primary",
              ].join(" ")}
            >
              {p.titulo}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${valor}`}
        tabIndex={0}
        className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        {children}
      </div>
    </div>
  )
}
