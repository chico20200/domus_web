// src/lib/cuentaUsuario.ts
import type { BadgeTono } from "../components/Badge"
import type { EstadoCuentaUsuario } from "../api/profile.types"
import { conPunto } from "./texto"

/**
 * Estado de la cuenta de usuario en DOMUS (Figura 1.2, HU-A03), distinto del estado de una
 * cuenta de ahorro (`lib/ahorros.ts`). Lo calcula el backend (`utils/cuentaSistema.js`).
 * Tonos de `Badge` por significado: activa al día (ok), pendiente por hacer (alerta),
 * bloqueada (destructivo) e inactiva sin carga (neutral).
 */
export const ESTADO_USUARIO: Record<
  EstadoCuentaUsuario,
  { etiqueta: string; tono: BadgeTono; motivo: string }
> = {
  activa: {
    etiqueta: "Activa",
    tono: "ok",
    motivo: "Perteneces al menos a una caja.",
  },
  inactiva: {
    etiqueta: "Inactiva",
    tono: "neutral",
    motivo:
      "Aún no perteneces a ninguna caja. Crea una o únete con el código que te dé su coordinador.",
  },
  pendiente: {
    etiqueta: "Pendiente",
    tono: "alerta",
    motivo: "Falta confirmar el correo con el enlace que se envió al crear la cuenta.",
  },
  bloqueada: {
    etiqueta: "Bloqueada",
    tono: "destructivo",
    motivo: "La administración de DOMUS deshabilitó la cuenta.",
  },
}

/** Motivo para mostrar: el del bloqueo si lo hay, si no el que corresponde al estado */
export function motivoEstado(estado: EstadoCuentaUsuario, motivo: string | null, cajas = 0) {
  if (estado === "bloqueada" && motivo) return `Motivo del bloqueo: ${conPunto(motivo)}`
  if (estado === "activa" && cajas > 1) return `Perteneces a ${cajas} cajas.`
  if (estado === "activa" && cajas === 1) return "Perteneces a una caja."
  return ESTADO_USUARIO[estado].motivo
}
