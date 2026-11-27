// src/api/pendientes.types.ts
/** GET /api/cajas/:cajaId/pendientes (T29). null: no aplica a este rol o no hay nada */
export interface PendientesResponse {
  /** Solicitudes de crédito por aprobar; null para el socio */
  solicitudes: number | null
  mora: { creditos: number; cuotas: number; monto: number } | null
  ciclo_por_cerrar: { numero: number; label: string; fin: string; dias: number } | null
  nuevos_miembros: { total: number; sin_ficha: number; dias: number } | null
  /** La próxima cuota de cada crédito en curso de quien consulta */
  mis_cuotas: MiCuota[]
}

export interface MiCuota {
  credito_id: string
  numero: number
  numero_cuota: number
  fecha_vencimiento: string
  falta_total: number
  /** Días hasta el vencimiento; negativo si ya venció */
  dias: number
  vencidas: number
  monto_vencido: number
}
