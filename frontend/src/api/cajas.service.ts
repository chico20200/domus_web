// src/api/cajas.service.ts
import { apiClient } from "./api.client"
import type {
  GetMisCajasResponse,
  CreateCajaRequest,
  CreateCajaResponse,
  UnirseResponse,
} from "./cajas.types"

export const cajasService = {
  async getMisCajas(): Promise<GetMisCajasResponse> {
    return apiClient.get<GetMisCajasResponse>("/cajas/mis-cajas")
  },

  async crear(data: CreateCajaRequest): Promise<CreateCajaResponse> {
    return apiClient.post<CreateCajaResponse>("/cajas", data)
  },

  /** Entra a una caja con un código de invitación; el código fija el rol */
  async unirse(codigo: string): Promise<UnirseResponse> {
    return apiClient.post<UnirseResponse>("/cajas/unirse", { codigo })
  },
}
