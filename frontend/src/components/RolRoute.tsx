// src/components/RolRoute.tsx
import { Navigate } from "react-router-dom"
import { useCaja } from "../context/CajaContext"
import { tieneRol, type RolCaja } from "../lib/roles"

interface RolRouteProps {
  children: React.ReactNode
  rolMinimo: RolCaja
  redirigir?: string
}

export function RolRoute({ children, rolMinimo, redirigir = "/ahorros" }: RolRouteProps) {
  const { cajaActiva } = useCaja()

  if (!tieneRol(cajaActiva?.rol, rolMinimo)) {
    return <Navigate to={redirigir} replace />
  }

  return <>{children}</>
}
