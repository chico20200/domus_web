// src/api/resumen.types.ts
export interface ResumenCaja {
  totalMiembros: number
  totalSocios: number
  saldoTotal: number
  /** Activos y vencidos: desembolsados y sin terminar de pagar */
  creditosActivos: number
  /** De esos, los que tienen al menos una cuota vencida sin pagar */
  creditosEnMora: number
  saldoPendiente: number
}

export interface TransaccionReciente {
  id: string
  tipo: "deposito" | "retiro"
  monto: number
  descripcion: string
  /** Día del movimiento (migración 015) */
  fecha: string
  created_at: string
  cuentas_ahorro?: {
    socios?: {
      nombre: string
      apellido: string
    }
  }
}

export interface GetResumenResponse {
  caja: {
    id: string
    nombre: string
    descripcion: string
    created_at: string
  }
  rol: string
  resumen: ResumenCaja
  transaccionesRecientes: TransaccionReciente[]
}
