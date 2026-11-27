// src/api/importacion.service.ts
import { apiClient } from "./api.client"
import type { ResultadoImportacion } from "./importacion.types"
import type { ModuloImportacion } from "../lib/importacion/modulos"

export const importacionService = {
  /** Con simular, la vista previa: la base lo hace todo y lo deshace */
  importar(cajaId: string, modulo: ModuloImportacion, filas: unknown[], simular: boolean) {
    return apiClient.post<ResultadoImportacion>(`/cajas/${cajaId}/importar/${modulo}`, {
      filas,
      simular,
    })
  },
}
