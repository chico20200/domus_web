// src/api/cajas.service.ts
import { apiClient } from "./api.client"
import type {
  GetMisCajasResponse,
  CreateCajaRequest,
  CreateCajaResponse,
  UnirseResponse,
  RequisitosEliminarCaja,
} from "./cajas.types"
import type { FotoResponse } from "./profile.types"

export const cajasService = {
  async getMisCajas(): Promise<GetMisCajasResponse> {
    return apiClient.get<GetMisCajasResponse>("/cajas/mis-cajas")
  },

  async crear(data: CreateCajaRequest): Promise<CreateCajaResponse> {
    return apiClient.post<CreateCajaResponse>("/cajas", data)
  },

  /** Entra a una caja con un código de invitación; el código fija el rol */
  // POST /api/cajas/:cajaId/politicas
  aceptarPoliticas(cajaId: string, version: string): Promise<unknown> {
    return apiClient.post(`/cajas/${cajaId}/politicas`, { version })
  },

  async unirse(codigo: string): Promise<UnirseResponse> {
    return apiClient.post<UnirseResponse>("/cajas/unirse", { codigo })
  },

  // Foto de la caja (T17): la ven todos los miembros; la cambia el coordinador
  getFoto(cajaId: string): Promise<{ foto_url: string | null }> {
    return apiClient.get<{ foto_url: string | null }>(`/cajas/${cajaId}/foto`)
  },
  subirFoto(cajaId: string, imagen: Blob): Promise<FotoResponse> {
    return apiClient.subirImagen<FotoResponse>(`/cajas/${cajaId}/foto`, imagen, "PUT")
  },
  quitarFoto(cajaId: string): Promise<FotoResponse> {
    return apiClient.delete<FotoResponse>(`/cajas/${cajaId}/foto`)
  },

  // Eliminar la caja (Etapa 7, T9–T10): solo el coordinador
  /** Lo que falta: socios activos, créditos en curso, ahorros y fondos con saldo */
  requisitosEliminar(cajaId: string): Promise<RequisitosEliminarCaja> {
    return apiClient.get<RequisitosEliminarCaja>(`/cajas/${cajaId}/eliminacion`)
  },
  /** La base vuelve a revisar todo; `nombre` es el de la caja, escrito para confirmar */
  eliminar(cajaId: string, nombre: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/cajas/${cajaId}/eliminar`, { nombre })
  },
}
