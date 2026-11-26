// src/api/cajas.service.ts
import { apiClient } from "./api.client"
import type {
  GetMisCajasResponse,
  CreateCajaRequest,
  CreateCajaResponse,
  UnirseResponse,
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
}
