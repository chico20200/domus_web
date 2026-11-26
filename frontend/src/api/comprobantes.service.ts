// src/api/comprobantes.service.ts
import { apiClient } from "./api.client"

/**
 * Fotos de comprobantes (T16). Se suben después de registrar el movimiento o el pago, y
 * también después desde el historial. Para verlas se pide un enlace firmado que dura
 * pocos minutos: las fotos no tienen dirección pública.
 */

/** Dónde está el comprobante: un depósito o retiro, o un pago de crédito */
export type DestinoComprobante =
  | { tipo: "movimiento"; cajaId: string; cuentaId: string; id: string }
  | { tipo: "pago"; cajaId: string; creditoId: string; id: string }

function ruta(d: DestinoComprobante) {
  return d.tipo === "movimiento"
    ? `/cajas/${d.cajaId}/cuentas/${d.cuentaId}/movimientos/${d.id}/comprobante`
    : `/cajas/${d.cajaId}/creditos/${d.creditoId}/pagos/${d.id}/comprobante`
}

export const comprobantesService = {
  subir(destino: DestinoComprobante, imagen: Blob) {
    return apiClient.subirImagen<{ message: string }>(ruta(destino), imagen)
  },

  async enlace(destino: DestinoComprobante): Promise<string> {
    const { url } = await apiClient.get<{ url: string }>(ruta(destino))
    return url
  },
}

/**
 * Sube la foto de algo que ya se registró. No lanza: el movimiento ya está guardado y lo
 * que falle aquí no lo deshace. Devuelve el aviso para la persona, o null si salió bien.
 */
export async function adjuntarTrasRegistrar(
  destino: DestinoComprobante,
  imagen: Blob | null,
): Promise<string | null> {
  if (!imagen) return null
  try {
    await comprobantesService.subir(destino, imagen)
    return null
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "error desconocido"
    return `Quedó registrado, pero la foto no se guardó (${motivo}). Puedes agregarla desde el historial.`
  }
}
