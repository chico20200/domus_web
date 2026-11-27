// src/api/ciclos.service.ts
import { apiClient } from "./api.client"
import type {
  GetCiclosResponse,
  ConfigCiclo,
  GuardarCicloResponse,
  RepartoResponse,
  TipoReparto,
} from "./ciclos.types"

export const ciclosService = {
  async getCiclos(cajaId: string): Promise<GetCiclosResponse> {
    return apiClient.get<GetCiclosResponse>(`/cajas/${cajaId}/ciclos`)
  },

  async guardarConfig(cajaId: string, config: ConfigCiclo): Promise<GuardarCicloResponse> {
    return apiClient.put<GuardarCicloResponse>(`/cajas/${cajaId}/configuracion-ciclo`, config)
  },

  getReparto(cajaId: string) {
    return apiClient.get<RepartoResponse>(`/cajas/${cajaId}/reparto`)
  },

  /** Cambia el tipo del ciclo actual; los anteriores no cambian */
  guardarReparto(cajaId: string, tipo: TipoReparto) {
    return apiClient.put<{ message: string; tipo: TipoReparto }>(`/cajas/${cajaId}/reparto`, {
      tipo,
    })
  },
}
