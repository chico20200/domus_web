// src/api/cajas.types.ts
import type { RolCaja } from "../lib/roles"
import type { Ciclo } from "./ciclos.types"

export interface Caja {
  id: string
  nombre: string
  descripcion: string
  creado_por: string
  activa: boolean
  created_at: string
}

export interface MiCaja {
  id: string
  nombre: string
  descripcion: string
  rol: RolCaja
  /** Si aceptó la versión vigente de las políticas de esta caja (HU-S04) */
  politicas_aceptadas: boolean
  /** "bloqueada": el administrador de DOMUS la bloqueó; se lee pero no se registra (T10).
   *  Opcional porque una caja guardada antes de T10 no lo trae hasta revalidarse. */
  estado?: "activa" | "bloqueada"
  estado_motivo?: string | null
  /** Enlace firmado de la foto de la caja (T17), válido una hora; null si no tiene */
  foto_url?: string | null
}

export interface GetMisCajasResponse {
  cajas: MiCaja[]
  /** Cajas que creó la cuenta (sin contar las eliminadas) y el máximo por cuenta */
  creacion: { creadas: number; limite: number } | null
}

export interface CreateCajaRequest {
  nombre: string
  descripcion: string
  fecha_fundacion: string
  mes_inicio_ciclo: number
  duracion_ciclo: number
  /** Versión de las políticas de uso que se aceptó (src/lib/politicas.ts) */
  politicas_version: string
}

export interface CreateCajaResponse {
  message: string
  caja: MiCaja & {
    fecha_fundacion: string
    mes_inicio_ciclo: number
    duracion_ciclo: number
  }
  ciclo_actual: Ciclo
}

export interface UnirseResponse {
  message: string
  /** true si el correo de la cuenta coincidió con una ficha de socio de la caja */
  socioVinculado: boolean
  caja: {
    id: string
    nombre: string
    descripcion?: string
    rol: RolCaja
  }
}
