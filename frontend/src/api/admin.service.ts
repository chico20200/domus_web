// src/api/admin.service.ts
import { apiClient } from "./api.client"
import type { AceptarAcuerdoResponse, EstadoAcuerdo } from "./admin.types"

export const adminService = {
  // GET /api/admin/acuerdo
  getAcuerdo(): Promise<EstadoAcuerdo> {
    return apiClient.get<EstadoAcuerdo>("/admin/acuerdo")
  },

  // POST /api/admin/acuerdo
  aceptarAcuerdo(version: string): Promise<AceptarAcuerdoResponse> {
    return apiClient.post<AceptarAcuerdoResponse>("/admin/acuerdo", { version })
  },
}
