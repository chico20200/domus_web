// src/api/reportes.service.ts
import { apiClient } from "./api.client"
import type { DistribucionResponse, EstadoCajaResponse } from "./reportes.types"

export const reportesService = {
  async getDistribucion(cajaId: string, ciclo?: number): Promise<DistribucionResponse> {
    const url = ciclo
      ? `/cajas/${cajaId}/reportes/distribucion-interes?ciclo=${ciclo}`
      : `/cajas/${cajaId}/reportes/distribucion-interes`
    return apiClient.get<DistribucionResponse>(url)
  },

  async getEstadoCaja(cajaId: string, ciclo?: number): Promise<EstadoCajaResponse> {
    const url = ciclo
      ? `/cajas/${cajaId}/reportes/estado-caja?ciclo=${ciclo}`
      : `/cajas/${cajaId}/reportes/estado-caja`
    return apiClient.get<EstadoCajaResponse>(url)
  },

  /** Pasa a un fondo los centavos que sobraron del reparto de un ciclo cerrado */
  pasarSobrante(cajaId: string, ciclo: number, fondoId: string) {
    return apiClient.post<{ message: string; sobrante: { monto: number; fecha: string } }>(
      `/cajas/${cajaId}/reportes/sobrante`,
      { ciclo, fondo_id: fondoId },
    )
  },
}
