import type { ReactNode } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../context/ThemeContext"
import { BotonIcono } from "./BotonIcono"

/**
 * Contenedor de las páginas con sesión iniciada pero sin caja elegida, que no tienen
 * barra lateral (hoy, "Mis cajas"). Es el equivalente de `PageShell` para ellas:
 * barra superior con el logo, el cambio de tema y `acciones`, y el contenido centrado
 * con el ancho `formulario` (640 px). El título va como <h1> sobre el contenido.
 */

interface Props {
  titulo: string
  descripcion?: string
  /** Botones a la derecha de la barra superior, como "Mi perfil" */
  acciones?: ReactNode
  children: ReactNode
}

export function PaginaSinMenu({ titulo, descripcion, acciones, children }: Props) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div className="min-h-screen bg-base">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-base bg-surface px-6">
        <div className="flex items-center gap-3">
          <img src="/logo_domus.png" alt="" className="size-8" />
          <span className="font-semibold text-primary">DOMUS</span>
        </div>
        <div className="flex items-center gap-2">
          {acciones}
          <BotonIcono
            icono={isDark ? Sun : Moon}
            etiqueta={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            onClick={toggleTheme}
          />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-formulario flex-col gap-8 px-4 py-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-primary">{titulo}</h1>
          {descripcion && <p className="text-sm text-secondary">{descripcion}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}
