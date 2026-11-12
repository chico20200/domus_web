import type { BadgeTono } from "../components/Badge"
import type { EstadoCredito } from "../api/creditos.types"
import type { TipoPago } from "../api/pagos.types"

/**
 * Etiqueta y tono de Badge de cada estado de crédito. Un solo lugar para Créditos, Pagos
 * y el Dashboard. El tono sigue el significado de Badge: pendiente pide atención, activo
 * está al día, mora y castigado son problemas, pagado ya no tiene carga.
 */
export const ESTADO_CREDITO: Record<EstadoCredito, { etiqueta: string; tono: BadgeTono }> = {
  pendiente: { etiqueta: "Pendiente", tono: "alerta" },
  activo: { etiqueta: "Activo", tono: "ok" },
  pagado: { etiqueta: "Pagado", tono: "neutral" },
  mora: { etiqueta: "En mora", tono: "destructivo" },
  castigado: { etiqueta: "Castigado", tono: "destructivo" },
}

export function estadoCredito(estado: string) {
  return ESTADO_CREDITO[estado as EstadoCredito] ?? { etiqueta: estado, tono: "neutral" as const }
}

export function nombreSocio(socio?: { nombre: string; apellido: string } | null) {
  return socio ? `${socio.nombre} ${socio.apellido}` : "Sin socio"
}

/**
 * Los tres tipos de pago de una cuota, con el mismo texto en Pagos (para elegir) y en la
 * confirmación del pago
 */
export const TIPO_PAGO: Record<
  TipoPago,
  { etiqueta: string; titulo: string; explicacion: string }
> = {
  completo: {
    etiqueta: "Pago completo",
    titulo: "Pago completo de la cuota",
    explicacion: "Cubre lo que falta de capital y de interés de la cuota.",
  },
  solo_capital: {
    etiqueta: "Solo capital",
    titulo: "Pago solo de capital",
    explicacion: "Cubre el capital de la cuota. El interés queda pendiente.",
  },
  solo_interes: {
    etiqueta: "Solo interés",
    titulo: "Pago solo de interés",
    explicacion: "Cubre el interés de la cuota. El capital queda pendiente.",
  },
}
