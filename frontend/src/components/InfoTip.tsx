import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { CircleHelp } from "lucide-react"

/**
 * Ayuda en contexto (especificaciones §8, HT04).
 *
 * Un ícono de interrogación junto al título de una sección o a la etiqueta de un campo.
 * Al pulsarlo abre un panel corto con tres partes fijas: qué es, qué pasa cuando lo haces
 * y qué necesitas antes. Abre con pulsación, no con el ratón encima, porque en un teléfono
 * no hay "encima".
 *
 * Usa la Popover API (`popover="auto"`), así el navegador se encarga de:
 * - Dibujarlo en la capa superior: no lo recorta el desplazamiento de un Modal ni de una tabla.
 * - Cerrar con Escape y con un clic afuera, y cerrar el que estuviera abierto al abrir otro.
 *
 * La posición se calcula al abrir: debajo del ícono, o encima si abajo no cabe, sin salirse
 * de la pantalla. Al desplazar o cambiar el tamaño de la ventana se cierra, para no quedar
 * flotando lejos de su ícono.
 *
 *   <InfoTip ayuda={AYUDA.cicloCaja} />
 */

export interface TextoAyuda {
  /** Nombre del concepto; es el título del panel y la etiqueta accesible del ícono */
  titulo: string
  que: string
  pasa: string
  necesitas: string
}

interface InfoTipProps {
  ayuda: TextoAyuda
}

const MARGEN = 16
const SEPARACION = 8

const PARTES: { clave: keyof Omit<TextoAyuda, "titulo">; etiqueta: string }[] = [
  { clave: "que", etiqueta: "Qué es" },
  { clave: "pasa", etiqueta: "Qué pasa cuando lo haces" },
  { clave: "necesitas", etiqueta: "Qué necesitas antes" },
]

export function InfoTip({ ayuda }: InfoTipProps) {
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const panelId = useId()
  const tituloId = useId()

  // Seguir el estado real del popover: lo puede cerrar el navegador (Escape, clic afuera,
  // otro popover que se abre), no solo el botón.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const alCambiar = (e: Event) => setAbierto((e as ToggleEvent).newState === "open")
    panel.addEventListener("toggle", alCambiar)
    return () => panel.removeEventListener("toggle", alCambiar)
  }, [])

  // Abierto, se cierra al desplazar cualquier contenedor o al cambiar el tamaño
  useEffect(() => {
    if (!abierto) return
    const cerrar = () => panelRef.current?.hidePopover()
    window.addEventListener("scroll", cerrar, true)
    window.addEventListener("resize", cerrar)
    return () => {
      window.removeEventListener("scroll", cerrar, true)
      window.removeEventListener("resize", cerrar)
    }
  }, [abierto])

  function alternar() {
    const panel = panelRef.current
    const boton = botonRef.current
    if (!panel || !boton) return
    if (abierto) {
      panel.hidePopover()
      return
    }

    // Se abre primero para poder medir el alto real del panel, y se coloca enseguida;
    // las dos cosas pasan antes de que el navegador pinte.
    panel.showPopover()
    const r = boton.getBoundingClientRect()
    const ancho = panel.offsetWidth
    const alto = panel.offsetHeight
    const left = Math.min(Math.max(r.left, MARGEN), window.innerWidth - ancho - MARGEN)
    const cabeAbajo = r.bottom + SEPARACION + alto <= window.innerHeight - MARGEN
    const top = cabeAbajo ? r.bottom + SEPARACION : Math.max(MARGEN, r.top - SEPARACION - alto)
    setPosicion({ top, left })
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        aria-label={`Ayuda: ${ayuda.titulo}`}
        aria-expanded={abierto}
        aria-controls={panelId}
        className="-m-1 inline-flex shrink-0 rounded-full p-1 align-middle text-muted transition-colors hover:text-accion-texto focus-visible:outline-2 focus-visible:outline-focus aria-expanded:text-accion-texto"
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-labelledby={tituloId}
        style={posicion}
        className="fixed m-0 w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-base bg-surface p-4 text-left text-primary shadow-xl open:flex"
      >
        <p id={tituloId} className="text-sm font-semibold text-primary">
          {ayuda.titulo}
        </p>
        {PARTES.map(({ clave, etiqueta }) => (
          <div key={clave} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-secondary">{etiqueta}</p>
            <p className="text-sm font-normal text-primary">{ayuda[clave]}</p>
          </div>
        ))}
      </div>
    </>
  )
}
