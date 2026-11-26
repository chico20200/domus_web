import type { BadgeTono } from "../components/Badge"
import type { EstadoCredito, MoraCredito } from "../api/creditos.types"
import type { TipoPago } from "../api/pagos.types"

/**
 * Etiqueta y tono de Badge de cada estado de crédito. Un solo lugar para Créditos, Pagos
 * y el Dashboard. Son los estados de la base; el tono sigue el significado de Badge:
 * pendiente pide atención, activo está al día, vencido es un problema, pagado ya no
 * tiene carga.
 */
export const ESTADO_CREDITO: Record<EstadoCredito, { etiqueta: string; tono: BadgeTono }> = {
  pendiente: { etiqueta: "Pendiente", tono: "alerta" },
  activo: { etiqueta: "Activo", tono: "ok" },
  pagado: { etiqueta: "Pagado", tono: "neutral" },
  vencido: { etiqueta: "Vencido", tono: "destructivo" },
}

/** Activos y vencidos: desembolsados, sin terminar de pagar y los únicos que reciben pagos */
export const EN_CURSO: EstadoCredito[] = ["activo", "vencido"]

/**
 * Lo que muestra el Badge de un crédito. La mora (una cuota vencida sin pagar, calculada
 * por el backend al leer) manda sobre el estado guardado: un crédito activo con una
 * cuota atrasada se ve "En mora", no "Activo".
 */
export function estadoCredito(credito: { estado: string; mora?: MoraCredito | null }) {
  if (credito.mora) {
    const n = credito.mora.cuotas_vencidas
    return {
      etiqueta: `En mora · ${n} ${n === 1 ? "cuota" : "cuotas"}`,
      tono: "destructivo" as const,
    }
  }
  return (
    ESTADO_CREDITO[credito.estado as EstadoCredito] ?? {
      etiqueta: credito.estado,
      tono: "neutral" as const,
    }
  )
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
