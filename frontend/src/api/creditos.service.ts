// src/api/creditos.service.ts
import { apiClient } from "./api.client"
import type { GetAmortizacionResponse } from "./amortizacion.types"
import type {
  GetCreditosResponse,
  GetCreditoResponse,
  CreateCreditoRequest,
  CreateCreditoResponse,
  ChangeEstadoResponse,
  ConfigCredito,
  GuardarConfigCreditoResponse,
} from "./creditos.types"

export const creditosService = {
  /** Monto máximo de la caja (T12); la base lo aplica en cada solicitud */
  async getConfig(cajaId: string): Promise<ConfigCredito> {
    return apiClient.get<ConfigCredito>(`/cajas/${cajaId}/configuracion-credito`)
  },

  async guardarConfig(
    cajaId: string,
    config: ConfigCredito,
  ): Promise<GuardarConfigCreditoResponse> {
    return apiClient.put<GuardarConfigCreditoResponse>(
      `/cajas/${cajaId}/configuracion-credito`,
      config,
    )
  },

  async getCreditos(cajaId: string): Promise<GetCreditosResponse> {
    return apiClient.get<GetCreditosResponse>(`/cajas/${cajaId}/creditos`)
  },

  async getCredito(cajaId: string, creditoId: string): Promise<GetCreditoResponse> {
    return apiClient.get<GetCreditoResponse>(`/cajas/${cajaId}/creditos/${creditoId}`)
  },

  async getAmortizacion(cajaId: string, creditoId: string): Promise<GetAmortizacionResponse> {
    return apiClient.get<GetAmortizacionResponse>(
      `/cajas/${cajaId}/creditos/${creditoId}/amortizacion`,
    )
  },

  async getCreditosSocio(cajaId: string, socioId: string): Promise<GetCreditosResponse> {
    return apiClient.get<GetCreditosResponse>(`/cajas/${cajaId}/creditos/socio/${socioId}`)
  },

  async crear(cajaId: string, data: CreateCreditoRequest): Promise<CreateCreditoResponse> {
    return apiClient.post<CreateCreditoResponse>(`/cajas/${cajaId}/creditos`, data)
  },

  async aprobar(
    cajaId: string,
    creditoId: string,
    fecha_desembolso?: string,
  ): Promise<CreateCreditoResponse> {
    return apiClient.put<CreateCreditoResponse>(`/cajas/${cajaId}/creditos/${creditoId}/aprobar`, {
      fecha_desembolso,
    })
  },

  async cambiarEstado(
    cajaId: string,
    creditoId: string,
    estado: string,
  ): Promise<ChangeEstadoResponse> {
    return apiClient.put<ChangeEstadoResponse>(`/cajas/${cajaId}/creditos/${creditoId}/estado`, {
      estado,
    })
  },
}
