// src/lib/pendientes.ts
import type { PendientesResponse } from "../api/pendientes.types"
import { fecha, moneda } from "./format"
import { numeroCredito } from "./creditos"

export interface Pendiente {
  id: string
  tono: "destructivo" | "alerta" | "neutral"
  titulo: string
  detalle: string
  /** Página donde se atiende */
  enlace: string
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function cuandoVence(dias: number) {
  if (dias === 0) return "vence hoy"
  if (dias === 1) return "vence mañana"
  return `vence en ${dias} días`
}

/**
 * Convierte la respuesta de /pendientes en la lista de la campana (T29), de lo más urgente
 * a lo menos: lo vencido primero, después lo que espera una acción y al final los avisos.
 * Es una función aparte para probarla sin React.
 */
export function listaPendientes(p: PendientesResponse): Pendiente[] {
  const lista: Pendiente[] = []

  for (const c of p.mis_cuotas) {
    const credito = `crédito ${numeroCredito(c.numero)}`
    lista.push(
      c.vencidas > 0
        ? {
            id: `cuota-${c.credito_id}`,
            tono: "destructivo",
            titulo: `Tienes ${plural(c.vencidas, "cuota vencida", "cuotas vencidas")} en tu ${credito}`,
            detalle: `${moneda(c.monto_vencido)} por pagar. Acércate al tesorero para ponerte al día.`,
            enlace: "/creditos",
          }
        : {
            id: `cuota-${c.credito_id}`,
            tono: c.dias <= 7 ? "alerta" : "neutral",
            titulo: `Tu cuota ${c.numero_cuota} del ${credito} ${cuandoVence(c.dias)}`,
            detalle: `Vence el ${fecha(c.fecha_vencimiento)}: ${moneda(c.falta_total)}.`,
            enlace: "/creditos",
          },
    )
  }

  if (p.mora) {
    lista.push({
      id: "mora",
      tono: "destructivo",
      titulo: `${plural(p.mora.creditos, "crédito", "créditos")} en mora`,
      detalle: `${plural(p.mora.cuotas, "cuota vencida", "cuotas vencidas")}: ${moneda(p.mora.monto)} por cobrar.`,
      enlace: "/pagos",
    })
  }

  if (p.solicitudes) {
    lista.push({
      id: "solicitudes",
      tono: "alerta",
      titulo:
        p.solicitudes === 1
          ? "1 solicitud de crédito por aprobar"
          : `${p.solicitudes} solicitudes de crédito por aprobar`,
      detalle: "Ábrela en Créditos para aprobarla y desembolsar.",
      enlace: "/creditos",
    })
  }

  if (p.ciclo_por_cerrar) {
    const c = p.ciclo_por_cerrar
    lista.push({
      id: "ciclo",
      tono: c.dias <= 7 ? "alerta" : "neutral",
      titulo:
        c.dias === 0
          ? `El ciclo ${c.numero} cierra hoy`
          : `El ciclo ${c.numero} cierra en ${plural(c.dias, "día", "días")}`,
      detalle: `${c.label}, cierra el ${fecha(c.fin)}. Revisa el reparto de intereses en Reportes.`,
      enlace: "/reportes",
    })
  }

  if (p.nuevos_miembros) {
    const m = p.nuevos_miembros
    lista.push({
      id: "miembros",
      tono: m.sin_ficha > 0 ? "alerta" : "neutral",
      titulo: `${m.total === 1 ? "1 miembro nuevo" : `${m.total} miembros nuevos`} en los últimos ${m.dias} días`,
      detalle:
        m.sin_ficha > 0
          ? `${m.sin_ficha === 1 ? "1 todavía no tiene" : `${m.sin_ficha} todavía no tienen`} ficha de socio: regístrala con el mismo correo con el que entra.`
          : "Ya tienen su ficha de socio.",
      enlace: "/socios",
    })
  }

  return lista
}
