import { Sun, Moon, Bell, LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../../context/ThemeContext"
import { useAuth } from "../../context/AuthContext"
import { BotonIcono } from "./BotonIcono"

interface TopBarProps {
  titulo: string
}

export function TopBar({ titulo }: TopBarProps) {
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const iniciales = user?.email?.[0].toUpperCase() ?? "U"

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-base bg-surface px-6">
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-primary">{titulo}</h1>

      <div className="flex items-center gap-2">
        <BotonIcono
          icono={isDark ? Sun : Moon}
          etiqueta={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          onClick={toggleTheme}
        />

        {/* Sin función todavía: implementarlo o quitarlo es una decisión pendiente (§13.4) */}
        <BotonIcono icono={Bell} etiqueta="Notificaciones" />

        <button
          type="button"
          onClick={() => navigate("/perfil")}
          aria-label="Ir al perfil"
          title={user?.email}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accion-primaria text-sm font-medium text-sobre-accion transition-colors hover:bg-accion-primaria-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {iniciales}
        </button>

        <BotonIcono icono={LogOut} etiqueta="Cerrar sesión" onClick={logout} />
      </div>
    </header>
  )
}
