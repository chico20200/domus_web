// src/api/salida.service.ts
import { apiClient } from "./api.client"
import type { Liquidacion, LiquidacionGuardada, RegistrarSalidaRequest } from "./salida.types"

const base = (cajaId: string, socioId: string) => `/cajas/${cajaId}/socios/${socioId}/salida`

export const salidaService = {
  /** Vista previa: no cambia nada (tesorero y coordinador) */
  async vistaPrevia(cajaId: string, socioId: string): Promise<Liquidacion> {
    return apiClient.get<Liquidacion>(base(cajaId, socioId))
  },

  /**
   * Registra la salida (solo coordinador). Si la liquidación cambió mientras se revisaba,
   * responde 409 con la nueva en `datos.liquidacion` (ApiError)
   */
  async registrar(
    cajaId: string,
    socioId: string,
    data: RegistrarSalidaRequest,
  ): Promise<{ message: string; liquidacion: LiquidacionGuardada }> {
    return apiClient.post(base(cajaId, socioId), data)
  },

  async historial(
    cajaId: string,
    socioId: string,
  ): Promise<{ liquidaciones: LiquidacionGuardada[] }> {
    return apiClient.get(`${base(cajaId, socioId)}/liquidaciones`)
  },
}
