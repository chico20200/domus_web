// src/context/CajaProvider.tsx
import { useEffect, useState, type ReactNode } from "react"
import { cajasService } from "../api/cajas.service"
import { normalizarRol } from "../lib/roles"
import { useAuth } from "./AuthContext"
import { CajaContext, type Caja } from "./CajaContext"

/** Caja guardada de una visita anterior. Si el rol guardado no es válido se descarta. */
function cajaGuardada(): Caja | null {
  try {
    const guardada = localStorage.getItem("cajaActiva")
    if (!guardada) return null
    const caja = JSON.parse(guardada)
    const rol = normalizarRol(caja?.rol)
    return rol ? { ...caja, rol } : null
  } catch {
    return null
  }
}

/**
 * Caja con la que se trabaja. La copia de localStorage solo sirve para no pedir la
 * caja otra vez al recargar: su rol no se cree hasta revalidarlo contra
 * /cajas/mis-cajas (§9.5). Mientras tanto `verificando` es true y RolRoute espera.
 * Una caja elegida en Mis cajas ya viene del servidor y no se vuelve a pedir.
 */
export function CajaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [cajaActiva, setCajaActivaState] = useState<Caja | null>(cajaGuardada)
  // Usuario para el que ya se comprobó la caja activa
  const [verificadaPara, setVerificadaPara] = useState<string | null>(null)

  // Al cerrar sesión se olvida la caja: la siguiente cuenta en este navegador elige la suya
  const [usuarioPrevio, setUsuarioPrevio] = useState(user?.id ?? null)
  if ((user?.id ?? null) !== usuarioPrevio) {
    setUsuarioPrevio(user?.id ?? null)
    if (!user) {
      localStorage.removeItem("cajaActiva")
      setCajaActivaState(null)
      setVerificadaPara(null)
    }
  }

  const userId = user?.id ?? null
  const cajaId = cajaActiva?.id ?? null
  const verificando = userId !== null && cajaId !== null && verificadaPara !== userId

  useEffect(() => {
    if (!verificando || !userId || !cajaId) return
    let vigente = true
    cajasService
      .getMisCajas()
      .then(({ cajas }) => {
        if (!vigente) return
        const deServidor = cajas.find((c) => c.id === cajaId)
        const rol = normalizarRol(deServidor?.rol)
        if (deServidor && rol) {
          const caja = { ...deServidor, rol }
          localStorage.setItem("cajaActiva", JSON.stringify(caja))
          setCajaActivaState(caja)
        } else {
          // Ya no es miembro de esa caja (o la caja se desactivó): vuelve a elegir
          localStorage.removeItem("cajaActiva")
          setCajaActivaState(null)
        }
        setVerificadaPara(userId)
      })
      .catch(() => {
        // Sin respuesta del servidor se sigue con la copia guardada: cada página va a
        // mostrar su propio error y el backend verifica el rol en cada petición.
        if (vigente) setVerificadaPara(userId)
      })
    return () => {
      vigente = false
    }
  }, [verificando, userId, cajaId])

  function setCajaActiva(caja: Caja) {
    localStorage.setItem("cajaActiva", JSON.stringify(caja))
    setCajaActivaState(caja)
    setVerificadaPara(userId)
  }

  function salirDeCaja() {
    localStorage.removeItem("cajaActiva")
    setCajaActivaState(null)
  }

  return (
    <CajaContext.Provider value={{ cajaActiva, verificando, setCajaActiva, salirDeCaja }}>
      {children}
    </CajaContext.Provider>
  )
}
