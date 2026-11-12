// src/api/cajas.types.ts
import type { RolCaja } from "../lib/roles"

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
  descripcion?: string
}

export interface CreateCajaResponse {
  message: string
  caja: Caja
}
