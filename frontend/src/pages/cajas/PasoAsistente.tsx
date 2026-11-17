import { useEffect, useRef, type ReactNode } from "react"
import { InfoTip, type TextoAyuda } from "../../components/InfoTip"

/**
 * Marco de un paso del asistente: tarjeta con el título como <h2>. Al cambiar de paso el
 * foco pasa al título, para que el teclado y el lector de pantalla empiecen por arriba
 * del paso nuevo y no queden en un botón que ya no existe. El primer paso no lo toma,
 * para no robar el foco al abrir la página.
 */

interface Props {
  titulo: string
  descripcion?: string
  ayuda?: TextoAyuda
  enfocar?: boolean
  children: ReactNode
}

export function PasoAsistente({ titulo, descripcion, ayuda, enfocar = true, children }: Props) {
  const titulo_ = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (enfocar) titulo_.current?.focus()
  }, [enfocar])

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-base bg-surface p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2
            ref={titulo_}
            tabIndex={-1}
            className="text-base font-semibold text-primary outline-none"
          >
            {titulo}
          </h2>
          {ayuda && <InfoTip ayuda={ayuda} />}
        </div>
        {descripcion && <p className="text-sm text-secondary">{descripcion}</p>}
      </div>
      {children}
    </section>
  )
}
