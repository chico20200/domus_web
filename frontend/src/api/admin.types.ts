// src/api/admin.types.ts
// Panel de administración del sistema (backend/routes/admin.routes.js)

/** GET /api/admin/acuerdo */
export interface EstadoAcuerdo {
  version: string
  aceptado: boolean
  aceptado_en: string | null
}

/** POST /api/admin/acuerdo */
export interface AceptarAcuerdoResponse {
  version: string
  aceptado_en: string
}
