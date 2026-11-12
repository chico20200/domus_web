import { useState, type ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

/**
 * Marco de las páginas con sesión y caja: barra lateral, barra superior y contenido.
 * Las páginas no lo usan directamente: van dentro de PageShell, que fija el ancho.
 */

interface AppLayoutProps {
  children: ReactNode
  /** Título de la página actual; la barra superior lo muestra como <h1> */
  titulo: string
}

export function AppLayout({ children, titulo }: AppLayoutProps) {
  const [sidebarAbierto, setSidebarAbierto] = useState(true)

  return (
    <div className="flex h-dvh overflow-hidden bg-base">
      <Sidebar abierto={sidebarAbierto} onToggle={() => setSidebarAbierto((prev) => !prev)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar titulo={titulo} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
