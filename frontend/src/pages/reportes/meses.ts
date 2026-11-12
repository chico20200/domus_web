const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** "2026-04" → "abr 26", para encabezados de columna donde no cabe más */
export function mesCorto(mes: string) {
  const [anio, m] = mes.split("-")
  return `${MESES[Number(m) - 1] ?? m} ${anio.slice(2)}`
}
