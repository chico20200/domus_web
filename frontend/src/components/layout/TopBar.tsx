import { Sun, Moon, Bell, LogOut, type LucideIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../../context/ThemeContext"
import { useAuth } from "../../context/AuthContext"

interface TopBarProps {
  titulo: string
}

/** Botón cuadrado de 32 px con solo un ícono. El texto va en aria-label */
function BotonIcono({
  icono: Icono,
  etiqueta,
  onClick,
}: {
  icono: LucideIcon
  etiqueta: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-base text-secondary transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Icono size={16} aria-hidden="true" />
    </button>
  )
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
