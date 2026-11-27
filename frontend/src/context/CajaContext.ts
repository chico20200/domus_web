// src/context/CajaContext.ts
// Contexto y hook aparte del proveedor (CajaProvider.tsx) para que Fast Refresh funcione.
import { createContext, useContext } from "react"
import type { RolCaja } from "../lib/roles"

export interface Caja {
  id: string
  nombre: string
  descripcion: string
  rol: RolCaja
  /**
   * Si aceptó la versión vigente de las políticas de la caja (HU-S04). Sin él, RolRoute
   * lleva a /politicas. Puede faltar en una caja guardada de antes; la revalidación
   * contra /cajas/mis-cajas lo completa.
   */
  politicas_aceptadas?: boolean
  /**
   * "bloqueada" si el administrador de DOMUS la bloqueó (T10): AppLayout muestra el aviso.
   * Se toma al revalidar la caja, una vez por sesión; si la bloquean a mitad de sesión,
   * cada registro responde "La caja no admite registros nuevos".
   */
  estado?: "activa" | "bloqueada" | "eliminada"
  estado_motivo?: string | null
  /** Cuándo se bloqueó o se eliminó: el aviso de caja eliminada muestra la fecha (T11) */
  estado_cambiado_en?: string | null
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
