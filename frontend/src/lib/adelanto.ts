import type { CuotaAdelantable } from "../api/pagos.types"

/**
 * Reparto de un pago adelantado (T30), para la vista previa. Es el mismo cálculo que hace
 * el backend al registrarlo (backend/utils/amortizacion.js, planAdelanto): el capital se
 * aplica desde la última cuota hacia atrás; una cuota cubierta entera condona su interés
 * y la que queda a medias recibe solo capital y conserva su interés.
 */

export interface ParteAdelanto {
  numero_cuota: number
  capital: number
  /** > 0: la cuota queda pagada y se le condona ese interés */
  interes_condonado: number
  /** Lo que le quedará de capital (0 si queda pagada) */
  resta_capital: number
  /** El interés que conserva la cuota a medias (0 si queda pagada) */
  interes: number
}

/** null si el monto no es mayor que 0 o supera lo que se puede adelantar */
export function planAdelanto(cuotas: CuotaAdelantable[], monto: number): ParteAdelanto[] | null {
  let resto = Math.round(monto * 100)
  const total = cuotas.reduce((s, c) => s + Math.round(c.falta_capital * 100), 0)
  if (!(resto > 0) || resto > total) return null
  const partes: ParteAdelanto[] = []
  for (const c of cuotas) {
    if (resto <= 0) break
    const falta = Math.round(c.falta_capital * 100)
    if (resto >= falta) {
      partes.push({
        numero_cuota: c.numero_cuota,
        capital: falta / 100,
        interes_condonado: c.interes,
        resta_capital: 0,
        interes: 0,
      })
      resto -= falta
    } else {
      partes.push({
        numero_cuota: c.numero_cuota,
        capital: resto / 100,
        interes_condonado: 0,
        resta_capital: (falta - resto) / 100,
        interes: c.interes,
      })
      resto = 0
    }
  }
  return partes
}
