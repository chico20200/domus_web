// src/api/ciclos.types.ts
/** Cómo se reparte el interés de un ciclo (T23) */
export type TipoReparto = "diferenciada" | "equitativa"

/** GET /cajas/:id/reparto: el tipo del ciclo actual */
export interface RepartoResponse {
  configurado: boolean
  tipo: TipoReparto
  ciclo: { numero: number; label: string; inicio: string; fin: string } | null
}

export interface Ciclo {
  numero: number
  inicio: string
  fin: string
  meses: string[]
  label: string
  cerrado: boolean
  actual: boolean
}

export interface CicloResumen {
  numero: number
  label: string
  cerrado: boolean
  actual: boolean
}

export interface ConfigCiclo {
  fecha_fundacion: string
  mes_inicio_ciclo: number
  duracion_ciclo: number
}

export interface GetCiclosResponse {
  configurado: boolean
  config?: ConfigCiclo
  ciclos: Ciclo[]
  ciclo_actual: Ciclo | null
  mensaje?: string
}

export interface GuardarCicloResponse {
  message: string
  ciclos: Ciclo[]
  ciclo_actual: Ciclo
}
