// src/context/CajaContext.ts
// Contexto y hook aparte del proveedor (CajaProvider.tsx) para que Fast Refresh funcione.
import { createContext, useContext } from "react"
import type { RolCaja } from "../lib/roles"

export interface Caja {
  id: string
  nombre: string
  descripcion: string
  rol: RolCaja
}

export interface CajaContextType {
  cajaActiva: Caja | null
  /** La caja vino de localStorage y su rol todavía no se comprobó con el servidor */
  verificando: boolean
  setCajaActiva: (caja: Caja) => void
  salirDeCaja: () => void
}

export const CajaContext = createContext<CajaContextType | null>(null)

export function useCaja() {
  const context = useContext(CajaContext)
  if (!context) throw new Error("useCaja debe usarse dentro de CajaProvider")
  return context
}
