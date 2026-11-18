// src/api/admin.types.ts
// Panel de administración del sistema (backend/routes/admin.routes.js)
import type { EstadoCuentaUsuario } from "./profile.types"
import type { RolCaja } from "../lib/roles"

/** GET /api/admin/acuerdo */
export interface EstadoAcuerdo {
  version: string
  aceptado: boolean
  aceptado_en: string | null
}

/** POST /api/admin/acuerdo */
export interface AceptarAcuerdoResponse {
  version: string
  aceptado_en: string
}

/** GET /api/admin/cajas: conteos, sin montos */
export interface CajaAdmin {
  id: string
  nombre: string
  creada_en: string
  miembros: number
  socios: number
  creditos_vigentes: number
}

/** GET /api/admin/cuentas */
export interface CuentaAdmin {
  id: string
  correo: string
  nombre: string | null
  creada_en: string
  ultimo_ingreso: string | null
  es_admin_sistema: boolean
  cajas: { caja_id: string; nombre: string; rol: RolCaja }[]
  estado: EstadoCuentaUsuario
  /** Solo si está bloqueada */
  motivo: string | null
  desde: string | null
}

/** GET /api/admin/bitacora */
export interface RegistroBitacora {
  id: string
  accion: "bloquear" | "restablecer"
  cuenta_id: string | null
  cuenta_correo: string
  motivo: string
  fecha: string
  /** null si la cuenta del administrador ya no existe */
  admin_correo: string | null
}
