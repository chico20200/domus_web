// src/api/miembros.types.ts
import type { RolCaja } from "../lib/roles"

export interface Miembro {
  /** user_id de la cuenta: es el id que usan cambiar rol y remover */
  id: string
  rol: RolCaja
  activo: boolean
  email: string
  profiles: { nombre: string } | null
}

/** Rol con el que entra quien usa el código. El coordinador no se invita */
export type RolInvitado = "socio" | "tesorero"

export interface Invitacion {
  codigo: string
  expira_at: string
  rol: RolInvitado
}

export interface GenerarInvitacionResponse {
  message: string
  codigo: string
  expira: string
  rol: RolInvitado
}
