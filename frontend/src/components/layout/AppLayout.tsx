import { useState, type ReactNode } from "react"
import { Lock } from "lucide-react"
import { useCaja } from "../../context/CajaContext"
import { conPunto } from "../../lib/texto"
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
  const { cajaActiva } = useCaja()

  return (
    <div className="flex h-dvh overflow-hidden bg-base">
      <Sidebar abierto={sidebarAbierto} onToggle={() => setSidebarAbierto((prev) => !prev)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar titulo={titulo} />
        {/* Caja bloqueada por el administrador (T10): se lee, pero la base rechaza todo
            registro. El aviso explica por qué antes de que un formulario falle. */}
        {cajaActiva?.estado === "bloqueada" && (
          <div
            role="status"
            className="flex items-start gap-3 border-b border-base border-l-[3px] border-l-destructivo bg-surface-2 px-6 py-3 text-sm"
          >
            <Lock size={18} className="mt-0.5 shrink-0 text-destructivo" aria-hidden="true" />
            <p className="text-primary">
              <span className="font-medium">El administrador de DOMUS bloqueó esta caja.</span>{" "}
              Puedes consultar sus datos, pero no registrar nada nuevo.
              {cajaActiva.estado_motivo && (
                <span className="text-secondary">
                  {" "}
                  Motivo: {conPunto(cajaActiva.estado_motivo)}
                </span>
              )}
            </p>
          </div>
        )}
        {/* relative: el <main> es el bloque contenedor de lo que va con position:absolute
            (por ejemplo `sr-only`). Sin esto, esos elementos se ubican respecto al documento,
            salen del overflow-hidden y la ventana gana una segunda barra de desplazamiento. */}
        <main className="relative flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
