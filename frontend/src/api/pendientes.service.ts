// src/api/pendientes.service.ts
import { apiClient } from "./api.client"
import type { PendientesResponse } from "./pendientes.types"

export const pendientesService = {
  /** Lo que muestra la campana de la barra superior (T29), calculado al leer */
  async get(cajaId: string): Promise<PendientesResponse> {
    return apiClient.get<PendientesResponse>(`/cajas/${cajaId}/pendientes`)
  },
}
