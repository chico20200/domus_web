// src/context/CajaContext.tsx
import { createContext, useContext, useState } from "react"
import { normalizarRol, type RolCaja } from "../lib/roles"

interface Caja {
  id: string
  nombre: string
  descripcion: string
  rol: RolCaja
}

interface CajaContextType {
  cajaActiva: Caja | null
  setCajaActiva: (caja: Caja) => void
  salirDeCaja: () => void
}

const CajaContext = createContext<CajaContextType | null>(null)

export function CajaProvider({ children }: { children: React.ReactNode }) {
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

export function useCaja() {
  const context = useContext(CajaContext)
  if (!context) throw new Error("useCaja debe usarse dentro de CajaProvider")
  return context
}
