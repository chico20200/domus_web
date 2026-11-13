import { NavLink, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  CreditCard,
  Receipt,
  PieChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  ArrowLeftRight,
} from "lucide-react"
import { useCaja } from "../../context/CajaContext"
import { ETIQUETA_ROL, tieneRol } from "../../lib/roles"

interface SidebarProps {
  abierto: boolean
  onToggle: () => void
}

/**
 * Barra lateral: caja activa con el rol, navegación según el rol, cambiar de caja y
 * contraer. Contraída mide 56 px y solo muestra íconos; entonces cada enlace lleva su
 * nombre en aria-label y title.
 *
 * El enlace activo se marca con fondo surface-2, texto en accion-texto y una barra de
 * 3 px a la izquierda (no con un fondo teñido, que no cumple AA con esta paleta).
 */
export function Sidebar({ abierto, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { cajaActiva, salirDeCaja } = useCaja()

  const rol = cajaActiva?.rol ?? "socio"
  const esTesorero = tieneRol(rol, "tesorero")

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", visible: esTesorero },
    { to: "/socios", icon: Users, label: "Socios", visible: esTesorero },
    { to: "/ahorros", icon: PiggyBank, label: "Ahorros", visible: true },
    { to: "/creditos", icon: CreditCard, label: "Créditos", visible: esTesorero },
    { to: "/pagos", icon: Receipt, label: "Pagos", visible: esTesorero },
    { to: "/reportes", icon: PieChart, label: "Reportes", visible: esTesorero },
    // Mismo rol mínimo que las rutas de App.tsx (§9.4)
    { to: "/configuracion", icon: Settings, label: "Configuración", visible: esTesorero },
  ].filter((item) => item.visible)

  const botonPie =
    "flex w-full items-center gap-2 rounded-lg border border-base p-2 text-secondary transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"

  return (
    <aside
      className={[
        "flex shrink-0 flex-col overflow-hidden border-r border-base bg-surface",
        "transition-[width] duration-200 motion-reduce:transition-none",
        abierto ? "w-56" : "w-14",
      ].join(" ")}
    >
      {/* Caja activa */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-base px-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accion-primaria text-sobre-accion">
          <Building2 size={16} aria-hidden="true" />
        </span>
        {abierto && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-primary" title={cajaActiva?.nombre}>
              {cajaActiva?.nombre ?? "Sin caja"}
            </p>
            <p className="truncate text-xs text-muted">{ETIQUETA_ROL[rol]}</p>
          </div>
        )}
      </div>

      <nav aria-label="Secciones de la caja" className="flex-1 overflow-y-auto py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={abierto ? undefined : label}
            title={abierto ? undefined : label}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 border-l-[3px] py-2 pr-3 pl-[15px] text-sm whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                isActive
                  ? "border-accion-texto bg-surface-2 font-medium text-accion-texto"
                  : "border-transparent text-secondary hover:bg-surface-2 hover:text-primary",
              ].join(" ")
            }
          >
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            {abierto && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="flex shrink-0 flex-col gap-1 border-t border-base p-2">
        <button
          type="button"
          onClick={() => {
            salirDeCaja()
            navigate("/cajas")
          }}
          aria-label={abierto ? undefined : "Cambiar caja"}
          title="Cambiar de caja"
          className={`${botonPie} ${abierto ? "justify-start" : "justify-center"}`}
        >
          <ArrowLeftRight size={14} className="shrink-0" aria-hidden="true" />
          {abierto && <span className="text-xs">Cambiar caja</span>}
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-label={abierto ? "Contraer menú lateral" : "Expandir menú lateral"}
          aria-expanded={abierto}
          className={`${botonPie} justify-center`}
        >
          {abierto ? (
            <ChevronLeft size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  )
}
