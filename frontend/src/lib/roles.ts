// src/lib/roles.ts
// Roles dentro de una caja. Misma escalera que el backend
// (backend/middlewares/permisos.middleware.js): cada rol puede todo lo de los de abajo.

export type RolCaja = "socio" | "tesorero" | "coordinador"

const NIVEL: Record<RolCaja, number> = { socio: 1, tesorero: 2, coordinador: 3 }

/** Nombre del rol para mostrar en la interfaz (§9.1) */
export const ETIQUETA_ROL: Record<RolCaja, string> = {
  socio: "Socio",
  tesorero: "Tesorero",
  coordinador: "Coordinador",
}

/** ¿El rol alcanza el mínimo? Un rol desconocido o ausente nunca alcanza. */
export function tieneRol(rol: string | null | undefined, minimo: RolCaja): boolean {
  if (!rol || !Object.hasOwn(NIVEL, rol)) return false
  return NIVEL[rol as RolCaja] >= NIVEL[minimo]
}

/** Página de inicio de cada rol dentro de una caja */
export function inicioDeRol(rol: RolCaja): string {
  return tieneRol(rol, "tesorero") ? "/dashboard" : "/ahorros"
}

/**
 * Lee un rol guardado de antes. "admin" es el nombre viejo de "coordinador"
 * (migración 001), y puede seguir en el localStorage de algún navegador.
 * Devuelve null si no es un rol válido.
 */
export function normalizarRol(valor: unknown): RolCaja | null {
  if (valor === "admin") return "coordinador"
  if (typeof valor === "string" && Object.hasOwn(NIVEL, valor)) return valor as RolCaja
  return null
}
