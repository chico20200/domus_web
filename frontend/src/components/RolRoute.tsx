// src/components/RolRoute.tsx
import { Navigate } from "react-router-dom"
import { useCaja } from "../context/CajaContext"
import { inicioDeRol, tieneRol, type RolCaja } from "../lib/roles"

interface RolRouteProps {
  children: React.ReactNode
  /** Rol mínimo para entrar. Sin él basta con ser miembro de la caja activa. */
  rolMinimo?: RolCaja
  /** Adónde va quien no alcanza el rol. Por omisión, la página de inicio de su rol. */
  redirigir?: string
}

/**
 * Protege una ruta que vive dentro de una caja (§9.4). Sin caja activa lleva a /cajas;
 * con un rol menor al pedido lleva a la página de inicio de ese rol. El backend
 * verifica cada petición por su cuenta: esto evita pantallas rotas, no fugas.
 */
export function RolRoute({ children, rolMinimo = "socio", redirigir }: RolRouteProps) {
  const { cajaActiva } = useCaja()

  if (!cajaActiva) return <Navigate to="/cajas" replace />

  if (!tieneRol(cajaActiva.rol, rolMinimo)) {
    return <Navigate to={redirigir ?? inicioDeRol(cajaActiva.rol)} replace />
  }

  return <>{children}</>
}
