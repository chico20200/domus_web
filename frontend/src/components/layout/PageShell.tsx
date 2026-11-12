import type { ReactNode } from "react"
import { AppLayout } from "./AppLayout"

/**
 * Contenedor de toda página con barra lateral (especificaciones §4.1).
 *
 * Fija el ancho y lo centra siempre. Las páginas no escriben `max-w-*` ni usan
 * AppLayout directamente.
 *
 * - formulario: 640 px. Configuración, Perfil, Ahorros, Créditos: una columna de
 *   formularios y tarjetas.
 * - completo: 1200 px. Dashboard, Socios, Reportes: tablas y rejillas.
 *
 * El título va en la barra superior como <h1>. Las secciones de la página se separan
 * 32 px (gap-8, "entre secciones de una página" en SISTEMA_DE_DISENO.md).
 */

export type AnchoPagina = "formulario" | "completo"

interface PageShellProps {
  titulo: string
  ancho: AnchoPagina
  children: ReactNode
}

const ANCHOS: Record<AnchoPagina, string> = {
  formulario: "max-w-formulario",
  completo: "max-w-completo",
}

export function PageShell({ titulo, ancho, children }: PageShellProps) {
  return (
    <AppLayout titulo={titulo}>
      <div className={`mx-auto flex w-full flex-col gap-8 ${ANCHOS[ancho]}`}>{children}</div>
    </AppLayout>
  )
}
