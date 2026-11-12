// src/context/AuthProvider.tsx
import { useState, type ReactNode } from "react"
import type { AuthUser } from "../api/auth.types"
import { authService } from "../api/auth.service"
import { AuthContext } from "./AuthContext"

/**
 * Lee la sesión guardada al crear el estado, no en un efecto: así la primera pintura ya
 * sabe si hay usuario y no hace falta un estado "cargando". Si el token está vencido o
 * mal formado se borra (es idempotente, no importa que StrictMode lo llame dos veces).
 */
function sesionGuardada(): AuthUser | null {
  const token = authService.getToken()
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    // payload.exp es la fecha de expiración en segundos Unix
    const expiro = payload.exp && payload.exp < Math.floor(Date.now() / 1000)
    if (expiro) {
      authService.logout()
      return null
    }
    return { id: payload.sub, email: payload.email, token }
  } catch {
    authService.logout()
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(sesionGuardada)

  async function login(email: string, password: string) {
    const response = await authService.login({ email, password })
    setUser({ id: response.user.id, email: response.user.email, token: response.token })
  }

  function logout() {
    authService.logout()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
