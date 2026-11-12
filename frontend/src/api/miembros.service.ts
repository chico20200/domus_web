// src/api/miembros.service.ts
import { apiClient } from "./api.client"
import type { RolCaja } from "../lib/roles"
import type { GenerarInvitacionResponse, Invitacion, Miembro, RolInvitado } from "./miembros.types"

export const miembrosService = {
  async listar(cajaId: string): Promise<Miembro[]> {
    const res = await apiClient.get<{ miembros: Miembro[] }>(`/cajas/${cajaId}/miembros`)
    return res.miembros
  },

  async cambiarRol(cajaId: string, userId: string, nuevoRol: RolCaja): Promise<void> {
    await apiClient.put(`/cajas/${cajaId}/miembros/${userId}`, { nuevoRol })
  },

  async remover(cajaId: string, userId: string): Promise<void> {
    await apiClient.delete(`/cajas/${cajaId}/miembros/${userId}`)
  },

  /** Código vigente sin usar, o null si no hay */
  async invitacionActiva(cajaId: string): Promise<Invitacion | null> {
    const res = await apiClient.get<{ invitacion: Invitacion | null }>(
      `/cajas/${cajaId}/miembros/invitaciones`,
    )
    return res.invitacion
  },

  /** Genera un código nuevo; el backend desactiva el anterior */
  async generarInvitacion(cajaId: string, rolInvitado: RolInvitado): Promise<Invitacion> {
    const res = await apiClient.post<GenerarInvitacionResponse>(
      `/cajas/${cajaId}/miembros/invitaciones`,
      { rolInvitado },
    )
    return { codigo: res.codigo, expira_at: res.expira, rol: res.rol }
  },
}
