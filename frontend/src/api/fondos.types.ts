// src/api/fondos.types.ts
// Fondos de caja (T18, T19): dinero de la organización aparte del que se presta

export interface Fondo {
  id: string
  nombre: string
  descripcion: string | null
  saldo: number
  /** Un fondo cerrado (saldo 0) no recibe movimientos y se puede reabrir */
  activo: boolean
  created_at: string
}

export type TipoMovimientoFondo = "deposito" | "retiro"

export interface MovimientoFondo {
  id: string
  tipo: TipoMovimientoFondo
  monto: number
  saldo_anterior: number
  saldo_posterior: number
  descripcion: string
  fecha: string
  created_at: string
}

export interface GetFondosResponse {
  fondos: Fondo[]
  total: number
}

export interface GetMovimientosFondoResponse {
  fondo: Fondo
  movimientos: MovimientoFondo[]
}

export interface FondoResponse {
  message: string
  fondo: Fondo
}

export interface MovimientoFondoResponse {
  message: string
  movimiento: MovimientoFondo
  saldo_anterior: number
  saldo_posterior: number
}
