import type { BadgeTono } from "../components/Badge"
import type { CuentaAhorro } from "../api/ahorros.types"

/** Etiqueta y tono de `Badge` de cada estado de una cuenta de ahorro */
export const ESTADO_CUENTA: Record<CuentaAhorro["estado"], { etiqueta: string; tono: BadgeTono }> =
  {
    activa: { etiqueta: "Activa", tono: "ok" },
    suspendida: { etiqueta: "Suspendida", tono: "alerta" },
    cerrada: { etiqueta: "Cerrada", tono: "neutral" },
  }

export function estadoCuenta(estado: string) {
  return (
    ESTADO_CUENTA[estado as CuentaAhorro["estado"]] ?? {
      etiqueta: estado,
      tono: "neutral" as const,
    }
  )
}
