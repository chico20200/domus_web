// src/api/admin.service.ts
import { apiClient } from "./api.client"
import type { AceptarAcuerdoResponse, CajaAdmin, CuentaAdmin, EstadoAcuerdo } from "./admin.types"

export const adminService = {
  // GET /api/admin/acuerdo
  getAcuerdo(): Promise<EstadoAcuerdo> {
    return apiClient.get<EstadoAcuerdo>("/admin/acuerdo")
  },

  // POST /api/admin/acuerdo
  aceptarAcuerdo(version: string): Promise<AceptarAcuerdoResponse> {
    return apiClient.post<AceptarAcuerdoResponse>("/admin/acuerdo", { version })
  },

  // GET /api/admin/cajas
  async getCajas(): Promise<CajaAdmin[]> {
    return (await apiClient.get<{ cajas: CajaAdmin[] }>("/admin/cajas")).cajas
  },

  // GET /api/admin/cuentas
  async getCuentas(): Promise<CuentaAdmin[]> {
    return (await apiClient.get<{ cuentas: CuentaAdmin[] }>("/admin/cuentas")).cuentas
  },
}
