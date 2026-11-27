// src/api/reportes.types.ts
import type { Ciclo, CicloResumen, TipoReparto } from "./ciclos.types"

export interface FilaMes {
  mes: string
  capital_total: number
  interes_mes: number
  tasa_mes: number
  /** Equitativa: cuántos socios se reparten el mes y cuánto le toca a cada uno */
  participantes: number | null
  parte: number | null
  saldos: Record<string, number>
  reparto: Record<string, number>
}

export interface InteresSocio {
  socio_id: string
  nombre: string
  cedula: string
  saldo_final: number
  /** Quien ya salió sigue en los ciclos en que estuvo (T24) */
  activo: boolean
  fecha_salida: string | null
  por_mes: { mes: string; interes: number }[]
  interes_total: number
}

export interface DistribucionResponse {
  caja: {
    id: string
    nombre: string
  }
  ciclo: Ciclo // ← el ciclo que se está viendo
  ciclos_disponibles: CicloResumen[] // ← todos los ciclos para el selector
  tipo: TipoReparto
  meses: FilaMes[]
  por_socio: InteresSocio[]
  interes_total: number
  tasa_acumulada: number
  validacion: {
    interes_generado: number
    interes_repartido: number
    /** Centavos que sobran al redondear cada parte: van a Fondos de caja */
    sobrante: number
    /** Interés que nadie pudo recibir */
    diferencia: number
    cuadra: boolean
  }
  /** Si el sobrante de este ciclo ya se pasó a un fondo */
  sobrante_registrado: { monto: number; fondo: string; fecha: string } | null
}

export interface EstadoCajaResponse {
  ciclo: {
    numero: number
    label: string
    inicio: string
    fin: string
    cerrado: boolean
  }
  /** Fecha a la que se miden los saldos: el fin del ciclo si cerró, hoy si está en curso */
  corte: string
  total_ahorros: number
  interes_recaudado: number // del ciclo seleccionado
  capital_recuperado: number // del ciclo seleccionado
  interes_historico: number // acumulado de toda la caja
  por_cobrar: number
  interes_condonado: number
  en_caja: number
  creditos: {
    total: number
    activos: number
    pagados: number
    pendientes: number
    vencidos: number
    en_mora: number
  }
}
