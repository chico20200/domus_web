import { useState } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * La foto de una cuenta o de una caja (T17), el mismo componente en la barra superior,
 * la barra lateral, Perfil, Mis cajas y Configuración. Sin foto (o si no carga) muestra
 * las iniciales o el ícono.
 *
 * - forma "circulo" para personas, "cuadro" para cajas.
 * - tono "acento" (fondo de acción, como el botón de la barra) o "suave" (superficie).
 * - onFalla: la imagen no cargó, por ejemplo porque el enlace firmado venció. Se llama
 *   una vez: si el enlace nuevo tampoco carga, quedan las iniciales o el ícono.
 */

const TAMANO = {
  sm: { caja: "size-8", texto: "text-sm", icono: 16, radio: "rounded-lg" },
  md: { caja: "size-12", texto: "text-base", icono: 22, radio: "rounded-xl" },
  lg: { caja: "size-16", texto: "text-xl", icono: 28, radio: "rounded-xl" },
} as const

export function Avatar({
  url,
  texto,
  icono: Icono,
  tamano = "md",
  forma = "circulo",
  tono = "acento",
  onFalla,
}: {
  url: string | null | undefined
  /** Las iniciales a mostrar sin foto */
  texto?: string
  /** El ícono a mostrar sin foto (en lugar de texto) */
  icono?: LucideIcon
  tamano?: keyof typeof TAMANO
  forma?: "circulo" | "cuadro"
  tono?: "acento" | "suave"
  onFalla?: () => void
}) {
  // La URL que falló: con otra URL se vuelve a intentar. onFalla se llama una sola vez,
  // para que una foto que de verdad no está no pida enlaces nuevos sin parar
  const [fallida, setFallida] = useState<string | null>(null)
  const [avisado, setAvisado] = useState(false)
  const t = TAMANO[tamano]
  const radio = forma === "circulo" ? "rounded-full" : t.radio

  if (url && url !== fallida) {
    return (
      <img
        src={url}
        alt=""
        className={`${t.caja} ${radio} shrink-0 border border-base bg-surface-2 object-cover`}
        onError={() => {
          setFallida(url)
          if (!avisado) {
            setAvisado(true)
            onFalla?.()
          }
        }}
      />
    )
  }

  const colores =
    tono === "acento" ? "bg-accion-primaria text-sobre-accion" : "bg-surface-2 text-accion-texto"
  return (
    <span
      aria-hidden="true"
      className={`flex ${t.caja} ${radio} ${t.texto} shrink-0 items-center justify-center font-semibold ${colores}`}
    >
      {Icono ? <Icono size={t.icono} /> : texto}
    </span>
  )
}
