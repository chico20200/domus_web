import { Check, Circle } from "lucide-react"
import { REQUISITOS_CONTRASENA, fuerzaContrasena, type FuerzaContrasena } from "../lib/validacion"

/**
 * Indicador de fortaleza de una contraseña nueva (HU-A01): barra de tres tramos con su
 * nombre y la lista de requisitos, que se marcan a medida que se cumplen. Va debajo del
 * campo. El nombre del nivel se anuncia al lector de pantalla cuando cambia.
 */

const NIVEL: Record<
  Exclude<FuerzaContrasena, "vacia">,
  { tramos: number; texto: string; color: string }
> = {
  debil: { tramos: 1, texto: "Débil", color: "bg-destructivo" },
  aceptable: { tramos: 2, texto: "Aceptable", color: "bg-estado-alerta" },
  fuerte: { tramos: 3, texto: "Fuerte", color: "bg-estado-ok" },
}

export function IndicadorContrasena({ password }: { password: string }) {
  const fuerza = fuerzaContrasena(password)
  const nivel = fuerza === "vacia" ? null : NIVEL[fuerza]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-1" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1 rounded-full ${nivel && n <= nivel.tramos ? nivel.color : "bg-surface-2"}`}
            />
          ))}
        </div>
        <p className="w-32 text-right text-xs whitespace-nowrap text-secondary" aria-live="polite">
          {nivel ? `Seguridad: ${nivel.texto}` : ""}
        </p>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {REQUISITOS_CONTRASENA.map((r) => {
          const ok = r.cumple(password)
          return (
            <li
              key={r.texto}
              className={`flex items-center gap-1 text-xs ${ok ? "text-primary" : "text-muted"}`}
            >
              {ok ? (
                <Check size={12} className="text-estado-ok" aria-hidden="true" />
              ) : (
                <Circle size={12} aria-hidden="true" />
              )}
              {r.texto}
              <span className="sr-only">{ok ? ": cumplido" : ": falta"}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
