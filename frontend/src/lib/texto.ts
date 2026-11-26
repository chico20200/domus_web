/** Para buscar sin tildes ni mayúsculas: "Pérez" → "perez" */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/** Cierra una frase escrita por alguien (un motivo) con punto si no termina en signo */
export function conPunto(texto: string) {
  const t = texto.trim()
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

/**
 * Si un socio coincide con lo que se busca, por nombre, apellido o cédula, sin tildes ni
 * mayúsculas. `consulta` ya viene normalizada (ver `normalizar`); vacía coincide con todo.
 * La usan Socios, Ahorros y Créditos para que las tres busquen igual.
 */
export function coincideSocio(
  socio: { nombre: string; apellido: string; cedula?: string } | null | undefined,
  consulta: string,
) {
  if (!consulta) return true
  if (!socio) return false
  return normalizar(`${socio.nombre} ${socio.apellido} ${socio.cedula ?? ""}`).includes(consulta)
}

/** Dos iniciales del nombre, o la primera letra del correo si no hay nombre */
export function iniciales(nombre: string | null | undefined, correo = "") {
  const limpio = nombre?.trim()
  if (limpio) {
    return limpio
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }
  return correo[0]?.toUpperCase() ?? "?"
}
