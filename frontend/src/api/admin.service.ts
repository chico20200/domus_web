// src/api/admin.service.ts
import { apiClient } from "./api.client"
import type {
  AceptarAcuerdoResponse,
  CajaAdmin,
  CuentaAdmin,
  EstadoAcuerdo,
  RegistroBitacora,
} from "./admin.types"

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

  // POST /api/admin/cuentas/:id/bloqueo
  bloquear(cuentaId: string, motivo: string): Promise<unknown> {
    return apiClient.post(`/admin/cuentas/${cuentaId}/bloqueo`, { motivo })
  },

  // POST /api/admin/cuentas/:id/restablecimiento
  restablecer(cuentaId: string, motivo: string): Promise<unknown> {
    return apiClient.post(`/admin/cuentas/${cuentaId}/restablecimiento`, { motivo })
  },

  // POST /api/admin/cajas/:id/bloqueo
  bloquearCaja(cajaId: string, motivo: string): Promise<unknown> {
    return apiClient.post(`/admin/cajas/${cajaId}/bloqueo`, { motivo })
  },

  // POST /api/admin/cajas/:id/restablecimiento
  restablecerCaja(cajaId: string, motivo: string): Promise<unknown> {
    return apiClient.post(`/admin/cajas/${cajaId}/restablecimiento`, { motivo })
  },

  // GET /api/admin/bitacora
  async getBitacora(): Promise<RegistroBitacora[]> {
    return (await apiClient.get<{ registros: RegistroBitacora[] }>("/admin/bitacora")).registros
  },
}
