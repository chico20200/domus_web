// backend/utils/fechas.js

// Zona horaria de las cajas. server.js la fija en process.env.TZ al arrancar,
// así que los métodos locales de Date (getFullYear, getMonth, getDate) dan la
// fecha de Ecuador aunque el servidor corra en UTC.
const ZONA_HORARIA = "America/Guayaquil"

/** Fecha local en formato YYYY-MM-DD. Sin argumento, la de hoy. */
function fechaLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

/**
 * Convierte "YYYY-MM-DD" en un Date a medianoche local.
 * new Date("YYYY-MM-DD") la tomaría como medianoche UTC, que en Ecuador es el día anterior.
 */
function leerFecha(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

module.exports = { ZONA_HORARIA, fechaLocal, leerFecha }
