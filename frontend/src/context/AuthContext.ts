// src/context/AuthContext.ts
// El contexto y su hook viven aparte del proveedor (AuthProvider.tsx) para que
// Fast Refresh funcione: un archivo .tsx solo exporta componentes.
import { createContext, useContext } from "react"
import type { AuthUser } from "../api/auth.types"

export interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return context
}
