// backend/utils/ciclos.js
const { fechaLocal } = require("./fechas")

/**
 * Calcula todos los ciclos de una caja desde su fundación hasta hoy.
 *
 * Ejemplo: fundada abril 2023, ciclo de 12 meses empezando en abril
 *   Ciclo 1: 2023-04 → 2024-03   (cerrado)
 *   Ciclo 2: 2024-04 → 2025-03   (cerrado)
 *   Ciclo 3: 2025-04 → 2026-03   (actual)
 */
function calcularCiclos(fechaFundacion, mesInicio, duracionMeses, hoy = new Date()) {
  const fund = new Date(fechaFundacion + "T00:00:00")

  // El primer ciclo arranca en el mes de inicio configurado,
  // en el año de fundación (o el anterior si la caja nació antes de ese mes)
  let anioInicio = fund.getFullYear()
  if (fund.getMonth() + 1 < mesInicio) {
    anioInicio -= 1 // ej: fundada en feb, ciclo empieza en abril → ciclo previo
  }

  // Se comparan fechas YYYY-MM-DD, no instantes: el último día del ciclo
  // sigue siendo del ciclo hasta la medianoche
  const hoyISO = fechaLocal(hoy)

  const ciclos = []
  let numero = 1
  let cursor = new Date(anioInicio, mesInicio - 1, 1)

  // Genera ciclos hasta pasar la fecha actual
  while (true) {
    const inicio = new Date(cursor)
    const fin = new Date(cursor.getFullYear(), cursor.getMonth() + duracionMeses, 0)

    const mesesCiclo = []
    for (let i = 0; i < duracionMeses; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1)
      mesesCiclo.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    const inicioISO = fechaLocal(inicio)
    const finISO = fechaLocal(fin)
    const cerrado = finISO < hoyISO
    const actual = inicioISO <= hoyISO && hoyISO <= finISO

    ciclos.push({
      numero,
      inicio: inicioISO,
      fin: finISO,
      meses: mesesCiclo,
      label: `${nombreMes(inicio.getMonth() + 1)} ${inicio.getFullYear()} – ${nombreMes(fin.getMonth() + 1)} ${fin.getFullYear()}`,
      cerrado,
      actual,
    })

    if (actual || inicioISO > hoyISO) break

    numero++
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + duracionMeses, 1)

    if (numero > 50) break // guarda contra bucles infinitos
  }

  const cicloActual = ciclos.find((c) => c.actual) ?? ciclos[ciclos.length - 1]

  return { ciclos, cicloActual }
}

function nombreMes(n) {
  return ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][n - 1]
}

module.exports = { calcularCiclos }
