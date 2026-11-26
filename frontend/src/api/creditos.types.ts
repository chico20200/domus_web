// src/api/creditos.types.ts
// Los valores del enum estado_credito de la base
export type EstadoCredito = "pendiente" | "activo" | "pagado" | "vencido"

/** Cuotas vencidas sin pagar, calculadas al leer el crédito (T13). null si está al día */
export interface MoraCredito {
  cuotas_vencidas: number
  monto_vencido: number
  /** Vencimiento de la cuota atrasada más antigua */
  desde: string
}

export interface Credito {
  id: string
  caja_id: string
  socio_id: string
  monto_solicitado: number
  tasa_interes: number
  plazo_meses: number
  monto_total: number
  cuota_mensual: number
  saldo_pendiente: number
  estado: EstadoCredito
  mora?: MoraCredito | null
  fecha_desembolso?: string | null
  fecha_vencimiento?: string | null
  aprobado_por?: string | null
  created_at?: string
  updated_at?: string
  socios?: {
    nombre: string
    apellido: string
    cedula?: string
  }
}

import type { PagoCredito } from "./pagos.types"

// Responses
export interface GetCreditosResponse {
  creditos: Credito[]
}
export interface GetCreditoResponse {
  credito: Credito
  pagos: PagoCredito[]
}

export interface CreateCreditoRequest {
  socio_id: string
  monto_solicitado: number
  tasa_interes: number
  plazo_meses: number
}

export interface CreateCreditoResponse {
  message: string
  credito: Credito
}

export interface ChangeEstadoResponse {
  message: string
  credito: Credito
}
