// src/context/NotifContext.tsx
import { createContext, useContext, useState, useCallback } from "react"
import { ConfirmDialog, type ConfirmOpts } from "../components/ConfirmDialog"

// ── Tipos ─────────────────────────────────────────────────────
export type ToastTipo = "exito" | "error" | "info" | "advertencia"

interface Toast {
  id: string
  tipo: ToastTipo
  mensaje: string
}

interface ConfirmState extends ConfirmOpts {
  resolver: (ok: boolean) => void
}

interface NotifContextType {
  toast: (tipo: ToastTipo, mensaje: string) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
  // Estado interno — lo consume el renderer
  _toasts: Toast[]
  _confirm: ConfirmState | null
  _quitarToast: (id: string) => void
}

const NotifContext = createContext<NotifContextType | null>(null)

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const quitarToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (tipo: ToastTipo, mensaje: string) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, tipo, mensaje }])
      // Se cierra solo a los 4 segundos
      setTimeout(() => quitarToast(id), 4000)
    },
    [quitarToast],
  )

  // Devuelve una promesa que se resuelve cuando el usuario elige
  const confirm = useCallback((opts: ConfirmOpts): Promise<boolean> => {
    return new Promise((resolver) => {
      setConfirmState({ ...opts, resolver })
    })
  }, [])

  return (
    <NotifContext.Provider
      value={{
        toast,
        confirm,
        _toasts: toasts,
        _confirm: confirmState,
        _quitarToast: quitarToast,
      }}
    >
      {children}
      <NotifRenderer onCerrarConfirm={() => setConfirmState(null)} />
    </NotifContext.Provider>
  )
}

export function useNotif() {
  const ctx = useContext(NotifContext)
  if (!ctx) throw new Error("useNotif debe usarse dentro de NotifProvider")
  return { toast: ctx.toast, confirm: ctx.confirm }
}

// Hook interno para el renderer
function useNotifInterno() {
  const ctx = useContext(NotifContext)
  if (!ctx) throw new Error("Fuera de NotifProvider")
  return ctx
}

// ── El renderer: dibuja toasts y el diálogo ───────────────────
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"

const toastConfig: Record<ToastTipo, { icon: typeof CheckCircle; color: string; bg: string }> = {
  exito: { icon: CheckCircle, color: "var(--color-secondary_g)", bg: "rgba(106,178,62,0.12)" },
  error: { icon: XCircle, color: "var(--color-danger_r)", bg: "rgba(217,97,70,0.12)" },
  info: { icon: Info, color: "var(--color-primary_y)", bg: "rgba(221,154,76,0.12)" },
  advertencia: {
    icon: AlertTriangle,
    color: "var(--color-primary_y)",
    bg: "rgba(221,154,76,0.12)",
  },
}

function NotifRenderer({ onCerrarConfirm }: { onCerrarConfirm: () => void }) {
  const { _toasts, _confirm, _quitarToast } = useNotifInterno()

  function responder(ok: boolean) {
    _confirm?.resolver(ok)
    onCerrarConfirm()
  }

  return (
    <>
      {/* ── Toasts (esquina inferior derecha) ─────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          pointerEvents: "none",
        }}
      >
        {_toasts.map((t) => {
          const cfg = toastConfig[t.tipo]
          const Icon = cfg.icon
          return (
            <div
              key={t.id}
              style={{
                minWidth: "280px",
                maxWidth: "380px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-base)",
                borderLeft: `3px solid ${cfg.color}`,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                pointerEvents: "auto",
                animation: "notifIn .2s ease-out",
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: cfg.bg,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={13} style={{ color: cfg.color }} />
              </div>
              <p
                style={{
                  flex: 1,
                  fontSize: "13px",
                  lineHeight: 1.4,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {t.mensaje}
              </p>
              <button
                onClick={() => _quitarToast(t.id)}
                aria-label="Cerrar"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Diálogo de confirmación ───────────────────────── */}
      <ConfirmDialog
        abierto={_confirm !== null}
        titulo={_confirm?.titulo ?? ""}
        mensaje={_confirm?.mensaje}
        labelOk={_confirm?.labelOk}
        labelCancel={_confirm?.labelCancel}
        peligroso={_confirm?.peligroso}
        onResponder={responder}
      />

      {/* Animación de entrada */}
      <style>{`
        @keyframes notifIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
