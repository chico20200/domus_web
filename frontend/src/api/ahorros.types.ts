// src/api/ahorros.types.ts
export interface CuentaAhorro {
  id: string
  caja_id: string
  socio_id: string
  numero_cuenta: string
  saldo: number
  estado: "activa" | "cerrada" | "suspendida"
  fecha_apertura: string
  /** Día en que se cerró; null si está abierta */
  fecha_cierre?: string | null
  socios?: {
    nombre: string
    apellido: string
    cedula: string
    /** Solo en el detalle: si la ficha del titular está activa (para reabrir la cuenta) */
    activo?: boolean
  }
}

export interface Transaccion {
  id: string
  cuenta_id: string
  tipo: "deposito" | "retiro"
  monto: number
  saldo_anterior: number
  saldo_posterior: number
  descripcion: string
  /** Ruta de la foto del comprobante (T16), o null si no tiene */
  comprobante?: string | null
  /** Día del movimiento (migración 015): hoy al registrarlo, o el del Excel al importarlo */
  fecha: string
  created_at: string
}

/** GET /cuentas/mias: la ficha la resuelve el servidor por usuario o por correo */
export interface GetMisCuentasResponse {
  vinculado: boolean
  socio?: { id: string; nombre: string; apellido: string }
  cuentas: CuentaAhorro[]
}

export interface GetCuentasResponse {
  cuentas: CuentaAhorro[]
}
export interface GetCuentaResponse {
  cuenta: CuentaAhorro
  transacciones: Transaccion[]
}
export interface CuentaCreatedResponse {
  message: string
  cuenta: CuentaAhorro
}
export interface TransaccionResponse {
  message: string
  transaccion: Transaccion
  saldo_anterior: number
  saldo_posterior: number
}
