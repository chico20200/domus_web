/** Para buscar sin tildes ni mayúsculas: "Pérez" → "perez" */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/** Cierra una frase escrita por alguien (un motivo) con punto si no termina en signo */
export function conPunto(texto: string) {
  const t = texto.trim()
  return /[.!?…]$/.test(t) ? t : `${t}.`
}
