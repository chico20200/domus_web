import { LoaderCircle } from "lucide-react"

/**
 * Estado de carga (especificaciones §3, LoadingState). Reemplaza los `<p>Cargando…</p>`.
 *
 * - Dentro de una página o tarjeta: <LoadingState texto="Cargando socios…" />
 * - Antes de tener layout (App.tsx, verificación de sesión): <LoadingState pantallaCompleta />
 *
 * role="status" para que el lector de pantalla anuncie que algo está cargando.
 * Con "reducir movimiento" activado, el ícono no gira; el texto basta.
 */

interface LoadingStateProps {
  /** Qué se está cargando. Por defecto "Cargando…" */
  texto?: string
  /** Ocupa toda la ventana, con el fondo de la página */
  pantallaCompleta?: boolean
}

export function LoadingState({ texto = "Cargando…", pantallaCompleta = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={[
        "flex flex-col items-center justify-center gap-3 px-4 py-12 text-center",
        pantallaCompleta ? "min-h-dvh bg-base" : "",
      ].join(" ")}
    >
      <LoaderCircle
        size={24}
        className="animate-spin text-muted motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="text-sm text-secondary">{texto}</p>
    </div>
  )
}
