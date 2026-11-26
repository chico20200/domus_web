// src/api/pagos.types.ts
export interface PagoCredito {
  id: string
  caja_id: string
  credito_id: string
  numero_cuota: number
  monto_pagado: number
  monto_capital: number
  monto_interes: number
  saldo_antes: number
  saldo_despues: number
  fecha_pago: string
  created_at: string
  /** Ruta de la foto del comprobante (T16), o null si no tiene */
  comprobante?: string | null
}

export interface CuotaVencida {
  numero_cuota: number
  fecha_vencimiento: string
  falta_total: number
}

/** Una cuota que se puede adelantar (T30), de la última a la primera */
export interface CuotaAdelantable {
  numero_cuota: number
  falta_capital: number
  /** El interés de la cuota: se condona si el adelanto cubre todo su capital */
  interes: number
}

/** Si se puede hacer un pago adelantado y hasta cuánto, o por qué no */
export type AdelantoDisponible =
  | { disponible: true; maximo: number; cuotas: CuotaAdelantable[] }
  | { disponible: false; motivo: string }

export interface ProximaCuota {
  pendiente: boolean
  numero_cuota?: number
  total_cuotas?: number
  es_ultima?: boolean
  fecha_vencimiento?: string
  vencida?: boolean
  falta_capital?: number
  falta_interes?: number
  falta_total?: number
  cuotas_vencidas?: CuotaVencida[]
  adelanto?: AdelantoDisponible
  mensaje?: string
}

export interface AdelantoResponse {
  message: string
  /** Un pago por cuota tocada: las cubiertas enteras y la que queda a medias */
  pagos: PagoCredito[]
  capital_pagado: number
  interes_condonado: number
  cuotas_adelantadas: number[]
  cuota_a_medias: { numero_cuota: number; capital: number } | null
  saldo_pendiente: number
  credito_pagado: boolean
}

export type TipoPago = "completo" | "solo_capital" | "solo_interes"

export interface GetPagosResponse {
  pagos: PagoCredito[]
}

export interface RegistrarPagoResponse {
  message: string
  pago: PagoCredito
  desglose: {
    capital: number
    interes: number
    total: number
  }
  saldo_pendiente: number
  credito_pagado: boolean
}
export interface AbonoResponse {
  message: string
  pago: PagoCredito
  aplicado: {
    cuota: number
    capital: number
    interes: number
    total: number
  }
  resta_en_cuota: {
    capital: number
    interes: number
    total: number
  }
  saldo_pendiente: number
  credito_pagado: boolean
}
