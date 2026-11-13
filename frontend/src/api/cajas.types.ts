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
}

export interface GetMisCajasResponse {
  cajas: MiCaja[]
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
