// src/api/profile.service.ts
import { apiClient } from "./api.client"
import type {
  FotoResponse,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "./profile.types"

export const profileService = {
  // GET /api/profiles/me
  async getMe(): Promise<GetProfileResponse> {
    return apiClient.get<GetProfileResponse>("/profiles/me")
  },

  // PUT /api/profiles/me
  async updateMe(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    return apiClient.put<UpdateProfileResponse>("/profiles/me", data)
  },

  // Foto de perfil (T17)
  subirFoto(imagen: Blob): Promise<FotoResponse> {
    return apiClient.subirImagen<FotoResponse>("/profiles/me/foto", imagen, "PUT")
  },
  quitarFoto(): Promise<FotoResponse> {
    return apiClient.delete<FotoResponse>("/profiles/me/foto")
  },
}
