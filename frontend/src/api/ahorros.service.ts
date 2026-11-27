// src/api/ahorros.service.ts
import { apiClient } from "./api.client"
import type {
  GetCuentasResponse,
  GetMisCuentasResponse,
  GetCuentaResponse,
  CuentaCreatedResponse,
  TransaccionResponse,
} from "./ahorros.types"

export const ahorrosService = {
  async getCuentas(cajaId: string): Promise<GetCuentasResponse> {
    return apiClient.get<GetCuentasResponse>(`/cajas/${cajaId}/cuentas`)
  },

  /** Las cuentas propias del usuario (socio) en la caja */
  async getMisCuentas(cajaId: string): Promise<GetMisCuentasResponse> {
    return apiClient.get<GetMisCuentasResponse>(`/cajas/${cajaId}/cuentas/mias`)
  },

  async getCuenta(cajaId: string, cuentaId: string): Promise<GetCuentaResponse> {
    return apiClient.get<GetCuentaResponse>(`/cajas/${cajaId}/cuentas/${cuentaId}`)
  },

  async getCuentasSocio(cajaId: string, socioId: string): Promise<GetCuentasResponse> {
    return apiClient.get<GetCuentasResponse>(`/cajas/${cajaId}/cuentas/socio/${socioId}`)
  },

  async abrirCuenta(cajaId: string, socioId: string): Promise<CuentaCreatedResponse> {
    return apiClient.post<CuentaCreatedResponse>(`/cajas/${cajaId}/cuentas`, { socio_id: socioId })
  },

  /** Cierra (saldo en 0) o reabre (titular activo) una cuenta: solo el coordinador */
  async cambiarEstado(
    cajaId: string,
    cuentaId: string,
    estado: "activa" | "cerrada",
  ): Promise<{ message: string }> {
    return apiClient.put<{ message: string }>(`/cajas/${cajaId}/cuentas/${cuentaId}/estado`, {
      estado,
    })
  },

  async depositar(
    cajaId: string,
    cuentaId: string,
    monto: number,
    descripcion?: string,
  ): Promise<TransaccionResponse> {
    return apiClient.post<TransaccionResponse>(`/cajas/${cajaId}/cuentas/${cuentaId}/deposito`, {
      monto,
      descripcion,
    })
  },

  async retirar(
    cajaId: string,
    cuentaId: string,
    monto: number,
    descripcion?: string,
  ): Promise<TransaccionResponse> {
    return apiClient.post<TransaccionResponse>(`/cajas/${cajaId}/cuentas/${cuentaId}/retiro`, {
      monto,
      descripcion,
    })
  },
}
