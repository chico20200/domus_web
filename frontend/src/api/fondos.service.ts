// src/api/fondos.service.ts
import { apiClient } from "./api.client"
import type {
  FondoResponse,
  GetFondosResponse,
  GetMovimientosFondoResponse,
  MovimientoFondoResponse,
  TipoMovimientoFondo,
} from "./fondos.types"

const base = (cajaId: string) => `/cajas/${cajaId}/fondos`

export const fondosService = {
  getFondos(cajaId: string) {
    return apiClient.get<GetFondosResponse>(base(cajaId))
  },

  getMovimientos(cajaId: string, fondoId: string) {
    return apiClient.get<GetMovimientosFondoResponse>(`${base(cajaId)}/${fondoId}/movimientos`)
  },

  crear(cajaId: string, nombre: string, descripcion: string) {
    return apiClient.post<FondoResponse>(base(cajaId), { nombre, descripcion })
  },

  editar(cajaId: string, fondoId: string, nombre: string, descripcion: string) {
    return apiClient.put<FondoResponse>(`${base(cajaId)}/${fondoId}`, { nombre, descripcion })
  },

  cambiarEstado(cajaId: string, fondoId: string, activo: boolean) {
    return apiClient.put<FondoResponse>(`${base(cajaId)}/${fondoId}/estado`, { activo })
  },

  registrar(
    cajaId: string,
    fondoId: string,
    tipo: TipoMovimientoFondo,
    monto: number,
    descripcion: string,
  ) {
    return apiClient.post<MovimientoFondoResponse>(`${base(cajaId)}/${fondoId}/${tipo}`, {
      monto,
      descripcion,
    })
  },
}
