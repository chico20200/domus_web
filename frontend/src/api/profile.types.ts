// src/api/profile.types.ts

// Lo que devuelve GET /api/profiles/me
export interface Profile {
  id: string
  nombre: string
  telefono: string
  foto_url: string
}

/** Estado de la cuenta de usuario (Figura 1.2). Ver `lib/cuentaUsuario.ts` */
export type EstadoCuentaUsuario = "pendiente" | "activa" | "inactiva" | "bloqueada"

export interface EstadoCuenta {
  estado: EstadoCuentaUsuario
  /** Solo en una cuenta bloqueada: el motivo que escribió la administración */
  motivo: string | null
  /** Solo en una cuenta bloqueada: desde cuándo */
  desde: string | null
  cajas_activas: number
}

export interface GetProfileResponse {
  profile: Profile
  estado_cuenta: EstadoCuenta
  es_admin_sistema: boolean
}

// Lo que envías en PUT /api/profiles/me
// Todos opcionales — el backend solo actualiza los que lleguen
export interface UpdateProfileRequest {
  nombre?: string
  telefono?: string
  foto_url?: string
}

export interface UpdateProfileResponse {
  message: string
  profile: Profile
}
