// src/context/ThemeContext.ts
// Contexto y hook aparte del proveedor (ThemeProvider.tsx) para que Fast Refresh funcione.
import { createContext, useContext } from "react"

export type Theme = "light" | "dark"

export interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

export const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider")
  return context
}
