// src/context/CajaProvider.tsx
import { useState, type ReactNode } from "react"
import { normalizarRol } from "../lib/roles"
import { CajaContext, type Caja } from "./CajaContext"

export function CajaProvider({ children }: { children: ReactNode }) {
  const [cajaActiva, setCajaActivaState] = useState<Caja | null>(() => {
    // Recupera la caja activa del localStorage si existe. Si el rol guardado no es
    // válido se descarta la caja y el usuario vuelve a elegirla.
    try {
      const guardada = localStorage.getItem("cajaActiva")
      if (!guardada) return null
      const caja = JSON.parse(guardada)
      const rol = normalizarRol(caja?.rol)
      return rol ? { ...caja, rol } : null
    } catch {
      return null
    }
  })

  function setCajaActiva(caja: Caja) {
    localStorage.setItem("cajaActiva", JSON.stringify(caja))
    setCajaActivaState(caja)
  }

  function salirDeCaja() {
    localStorage.removeItem("cajaActiva")
    setCajaActivaState(null)
  }

  return (
    <CajaContext.Provider value={{ cajaActiva, setCajaActiva, salirDeCaja }}>
      {children}
    </CajaContext.Provider>
  )
}
