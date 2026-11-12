// src/context/NotifProvider.tsx
import { useCallback, useContext, useState, type ReactNode } from "react"
import { AlertTriangle, CheckCircle, Info, X, XCircle, type LucideIcon } from "lucide-react"
import { ConfirmDialog, type ConfirmOpts } from "../components/ConfirmDialog"
import { NotifContext, type ConfirmState, type Toast, type ToastTipo } from "./NotifContext"

export function NotifProvider({ children }: { children: ReactNode }) {
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

/**
 * Tono de cada aviso: ícono y color de estado (§2.3). El color va en el ícono y en la
 * franja izquierda; el texto queda en text-primary para leerse igual en los cuatro.
 */
const TONO: Record<ToastTipo, { icono: LucideIcon; texto: string; franja: string }> = {
  exito: { icono: CheckCircle, texto: "text-estado-ok", franja: "border-l-estado-ok" },
  error: { icono: XCircle, texto: "text-destructivo", franja: "border-l-destructivo" },
  info: { icono: Info, texto: "text-accion-texto", franja: "border-l-accion-texto" },
  advertencia: {
    icono: AlertTriangle,
    texto: "text-estado-alerta",
    franja: "border-l-estado-alerta",
  },
}

function NotifRenderer({ onCerrarConfirm }: { onCerrarConfirm: () => void }) {
  const ctx = useContext(NotifContext)
  if (!ctx) throw new Error("NotifRenderer fuera de NotifProvider")
  const { _toasts, _confirm, _quitarToast } = ctx

  function responder(ok: boolean) {
    _confirm?.resolver(ok)
    onCerrarConfirm()
  }

  return (
    <>
      {/*
       * Avisos abajo a la derecha; en pantallas angostas ocupan el ancho con 16 px de margen.
       * La región existe siempre para que el lector de pantalla anuncie lo que entra.
       */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {_toasts.map((t) => {
          const tono = TONO[t.tipo]
          const Icono = tono.icono
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-base bg-surface py-3 pr-2 pl-3 shadow-lg motion-safe:animate-aviso-entra ${tono.franja}`}
            >
              <Icono size={18} aria-hidden="true" className={`mt-0.5 shrink-0 ${tono.texto}`} />
              <p className="flex-1 text-sm text-primary">{t.mensaje}</p>
              <button
                type="button"
                onClick={() => _quitarToast(t.id)}
                aria-label="Cerrar aviso"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        abierto={_confirm !== null}
        titulo={_confirm?.titulo ?? ""}
        mensaje={_confirm?.mensaje}
        labelOk={_confirm?.labelOk}
        labelCancel={_confirm?.labelCancel}
        peligroso={_confirm?.peligroso}
        onResponder={responder}
      />
    </>
  )
}
