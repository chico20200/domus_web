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
  fecha_fundacion: string | null
  /** El ciclo en curso, como "Abril 2025 – Marzo 2026" */
  ciclo_vigente: string | null
  estado: "activa" | "bloqueada"
  /** Solo si está bloqueada */
  estado_motivo: string | null
  estado_cambiado_en: string | null
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
  /** aceptar_acuerdo: el administrador aceptó el acuerdo de confidencialidad (HU021, T28) */
  accion: "bloquear" | "restablecer" | "bloquear_caja" | "restablecer_caja" | "aceptar_acuerdo"
  cuenta_id: string | null
  /** null en las acciones sobre una caja */
  cuenta_correo: string | null
  caja_id: string | null
  /** El nombre al momento de la acción; null en las acciones sobre una cuenta */
  caja_nombre: string | null
  /** null en la aceptación del acuerdo */
  motivo: string | null
  /** Versión del acuerdo aceptada; null en las demás acciones */
  version: string | null
  fecha: string
  /** null si la cuenta del administrador ya no existe */
  admin_correo: string | null
}
