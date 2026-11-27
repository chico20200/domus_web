// src/api/socios.types.ts
export interface Socio {
  id: string
  caja_id: string
  user_id: string | null
  cedula: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  direccion: string
  fecha_ingreso: string
  activo: boolean
  /** La última salida; null mientras está activo (migración 018) */
  fecha_salida: string | null
  created_at: string
}

export interface GetSociosResponse {
  socios: Socio[]
}

export interface GetSocioResponse {
  socio: Socio
}

export interface CreateSocioRequest {
  nombre: string
  apellido: string
  cedula: string
  telefono?: string
  email?: string
  direccion?: string
  fecha_ingreso?: string
}

/** Una corrección de la fecha de ingreso (T14). La hace el coordinador con un motivo */
export interface CorreccionIngreso {
  id: string
  fecha_anterior: string
  fecha_nueva: string
  motivo: string
  corregido_por_nombre: string | null
  creado_en: string
}

export interface GetCorreccionesIngresoResponse {
  correcciones: CorreccionIngreso[]
}

export interface CorregirIngresoResponse {
  message: string
  fecha_anterior: string
  fecha_ingreso: string
}

export interface SocioResponse {
  message: string
  socio: Socio
}
