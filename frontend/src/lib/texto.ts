/** Para buscar sin tildes ni mayúsculas: "Pérez" → "perez" */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}
