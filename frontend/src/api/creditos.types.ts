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
  /** 1, 2, 3… dentro de la caja, en el orden de solicitud. Lo pone la base (007) */
  numero: number
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
/** "Mis créditos" del socio (T27): sin ficha vinculada no hay créditos que mostrar */
export interface GetMisCreditosResponse {
  vinculado: boolean
  creditos: Credito[]
}
export interface GetCreditoResponse {
  credito: Credito
  pagos: PagoCredito[]
}

/** Reglas de crédito de la caja (T12). null: sin monto máximo */
export interface ConfigCredito {
  monto_maximo_credito: number | null
}

export interface GuardarConfigCreditoResponse extends ConfigCredito {
  message: string
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
