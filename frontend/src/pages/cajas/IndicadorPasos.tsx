import { Check } from "lucide-react"

/**
 * Pasos de un asistente: número (o marca si ya se hizo) y nombre de cada uno.
 * El actual lleva aria-current="step"; debajo, "Paso n de N" para quien no ve la lista.
 * La cuadrícula es de cuatro columnas, los pasos del asistente de creación de caja.
 */

interface Props {
  pasos: string[]
  /** Paso actual, desde 1 */
  actual: number
}

export function IndicadorPasos({ pasos, actual }: Props) {
  return (
    <nav aria-label="Pasos para crear la caja" className="flex flex-col gap-3">
      <ol className="grid grid-cols-4 gap-2">
        {pasos.map((nombre, i) => {
          const n = i + 1
          const hecho = n < actual
          const esActual = n === actual
          return (
            <li
              key={nombre}
              aria-current={esActual ? "step" : undefined}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span
                className={[
                  "flex size-8 items-center justify-center rounded-full border text-sm font-medium",
                  esActual
                    ? "border-accion-texto text-accion-texto"
                    : hecho
                      ? "border-estado-ok text-estado-ok"
                      : "border-base text-muted",
                ].join(" ")}
              >
                {hecho ? <Check size={16} aria-label="hecho" /> : n}
              </span>
              <span
                className={`text-xs ${esActual ? "font-medium text-primary" : "text-secondary"}`}
              >
                {nombre}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Paso {actual} de {pasos.length}: {pasos[actual - 1]}
      </p>
    </nav>
  )
}
