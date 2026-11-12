// src/context/NotifContext.ts
// Contexto y hooks aparte del proveedor (NotifProvider.tsx) para que Fast Refresh funcione.
import { createContext, useContext } from "react"
import type { ConfirmOpts } from "../components/ConfirmDialog"

export type ToastTipo = "exito" | "error" | "info" | "advertencia"

export interface Toast {
  id: string
  tipo: ToastTipo
  mensaje: string
}

export interface ConfirmState extends ConfirmOpts {
  resolver: (ok: boolean) => void
}

export interface NotifContextType {
  toast: (tipo: ToastTipo, mensaje: string) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
  // Estado interno: lo consume el renderer de NotifProvider
  _toasts: Toast[]
  _confirm: ConfirmState | null
  _quitarToast: (id: string) => void
}

export const NotifContext = createContext<NotifContextType | null>(null)

export function useNotif() {
  const ctx = useContext(NotifContext)
  if (!ctx) throw new Error("useNotif debe usarse dentro de NotifProvider")
  return { toast: ctx.toast, confirm: ctx.confirm }
}
