// src/api/salida.types.ts
// Salida de un socio con liquidación (Etapa 7, T3–T6). Ver backend/API.md, "salida".

export interface CicloLiquidacion {
  numero: number
  label: string
  inicio: string
  fin: string
}

export interface CreditoLiquidacion {
  id: string
  numero: number
  capital_pendiente: number
  interes_vencido: number
  cuotas_vencidas: number
  /** Interés de las cuotas que aún no vencen: no se cobra */
  interes_condonado: number
  /** Capital pendiente más el interés vencido: se descuenta de sus ahorros */
  deuda: number
}

export interface Liquidacion {
  socio: {
    id: string
    nombre: string
    apellido: string
    cedula: string
    activo: boolean
    /** Su cuenta de usuario entra a la caja: al salir pierde el acceso */
    pierde_acceso: boolean
  }
  cuentas: { id: string; numero_cuenta: string; estado: string; saldo: number }[]
  ahorros: number
  /** null si la caja no tiene configurado su periodo */
  interes: {
    ciclo: CicloLiquidacion
    tipo: "diferenciada" | "equitativa"
    monto: number
    por_mes: { mes: string; interes: number }[]
  } | null
  creditos: CreditoLiquidacion[]
  deuda: number
  /** Solicitudes sin aprobar: se anulan al salir */
  solicitudes: { id: string; numero: number; monto: number }[]
  neto: number
  puede_salir: boolean
  impedimentos: { codigo: "inactivo" | "propia" | "deuda"; mensaje: string }[]
}

export interface RegistrarSalidaRequest {
  neto_esperado: number
  ahorros_entregados: boolean
  interes_entregado: boolean
}

/** Una liquidación guardada (tabla liquidaciones) */
export interface LiquidacionGuardada {
  id: string
  fecha: string
  ahorros: number
  interes: number
  deuda: number
  interes_condonado: number
  neto: number
  ciclo_numero: number | null
  tipo_reparto: string | null
  /** Lo que se vio al registrarla: cuentas, créditos, solicitudes e interés */
  detalle: {
    cuentas?: Liquidacion["cuentas"]
    creditos?: CreditoLiquidacion[]
    solicitudes?: Liquidacion["solicitudes"]
    interes?: Liquidacion["interes"]
    acceso_retirado?: boolean
  }
  created_at: string
}
