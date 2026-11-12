import type { ReactNode } from "react"
import { Moon, Sun } from "lucide-react"
import { Link } from "react-router-dom"
import { useTheme } from "../../context/ThemeContext"
import { BotonIcono } from "./BotonIcono"

/**
 * Contenedor de las páginas sin sesión: iniciar sesión, crear cuenta, recuperar y
 * restablecer la contraseña. Logo arriba, una tarjeta centrada de 384 px
 * (`max-w-acceso`) con el título como <h1>, y `pie` debajo de la tarjeta para enlaces
 * secundarios. El cambio de tema queda arriba a la derecha.
 */

interface Props {
  titulo: string
  descripcion?: ReactNode
  /** Ícono grande sobre el título, para las vistas de resultado ("Revisa tu correo") */
  icono?: ReactNode
  pie?: ReactNode
  children?: ReactNode
}

export function PaginaAcceso({ titulo, descripcion, icono, pie, children }: Props) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div className="flex min-h-screen flex-col items-center bg-base px-4 py-10">
      <div className="fixed top-4 right-4">
        <BotonIcono
          icono={isDark ? Sun : Moon}
          etiqueta={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          onClick={toggleTheme}
        />
      </div>
      <div className="mb-8 flex items-center gap-3">
        <img src="/logo_domus.png" alt="" className="size-12" />
        <span className="text-2xl font-semibold text-primary">DOMUS</span>
      </div>
      <main className="flex w-full max-w-acceso flex-col gap-6">
        <div className="flex flex-col gap-6 rounded-xl border border-base bg-surface p-6">
          <div className="flex flex-col gap-2">
            {icono}
            <h1 className="text-xl font-semibold text-primary">{titulo}</h1>
            {descripcion && <p className="text-sm text-secondary">{descripcion}</p>}
          </div>
          {children}
        </div>
        {pie && <div className="text-center text-sm text-secondary">{pie}</div>}
      </main>
    </div>
  )
}

/** Enlace de texto de las páginas de acceso, con el color de acción y foco visible */
export function EnlaceAcceso({ a, children }: { a: string; children: ReactNode }) {
  return (
    <Link
      to={a}
      className="rounded-sm font-medium text-accion-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </Link>
  )
}
