/**
 * Formato de números y fechas para toda la interfaz (especificaciones §4.3).
 *
 * Un solo lugar define que la moneda es USD, la configuración regional es es-EC
 * y la fecha se escribe dd/MM/yyyy. Ninguna página declara su propio Intl.NumberFormat
 * ni llama a toLocaleDateString.
 *
 * Si el valor falta o no es válido, todas devuelven "—".
 */

const LOCALE = "es-EC"
const VACIO = "—"

const fmtMoneda = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtFecha = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const fmtHora = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const fmtPorcentaje = new Map<number, Intl.NumberFormat>()

type FechaEntrada = string | Date | null | undefined

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Convierte la entrada en Date.
 *
 * Las fechas sin hora ("2026-11-11", columnas `date` de la base) se leen como fecha
 * local. `new Date("2026-11-11")` las toma como medianoche UTC, y en Ecuador (UTC-5)
 * eso se muestra como el día anterior.
 */
function aFecha(valor: FechaEntrada): Date | null {
  if (valor == null || valor === "") return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor

  const soloFecha = SOLO_FECHA.exec(valor)
  if (soloFecha) {
    const [anio, mes, dia] = soloFecha.slice(1).map(Number)
    const d = new Date(anio, mes - 1, dia)
    // Rechaza fechas imposibles como 2026-02-30, que Date convertiría en 2 de marzo
    return d.getMonth() === mes - 1 && d.getDate() === dia ? d : null
  }

  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 1234.5 → "$1.234,50" */
export function moneda(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return VACIO
  return fmtMoneda.format(valor)
}

/** "2026-11-11" o un ISO con hora → "11/11/2026" */
export function fecha(valor: FechaEntrada): string {
  const d = aFecha(valor)
  return d ? fmtFecha.format(d) : VACIO
}

/** "2026-11-11T22:05:00Z" → "11/11/2026 17:05" (hora local, 24 h) */
export function fechaHora(valor: FechaEntrada): string {
  const d = aFecha(valor)
  return d ? `${fmtFecha.format(d)} ${fmtHora.format(d)}` : VACIO
}

/**
 * Recibe puntos porcentuales, como los guarda la base: 12.5 → "12,50%".
 * `decimales` por defecto 2; los reportes de reparto de interés usan 4.
 */
export function porcentaje(valor: number | null | undefined, decimales = 2): string {
  if (valor == null || !Number.isFinite(valor)) return VACIO
  let fmt = fmtPorcentaje.get(decimales)
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, {
      style: "percent",
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    fmtPorcentaje.set(decimales, fmt)
  }
  return fmt.format(valor / 100)
}
