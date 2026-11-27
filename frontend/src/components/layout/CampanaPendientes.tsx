import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Bell, ChevronRight } from "lucide-react"
import { pendientesService } from "../../api/pendientes.service"
import { listaPendientes, type Pendiente } from "../../lib/pendientes"
import { useDatos } from "../../lib/useDatos"

const MARGEN = 16
const SEPARACION = 8

const PUNTO: Record<Pendiente["tono"], string> = {
  destructivo: "bg-destructivo",
  alerta: "bg-estado-alerta",
  neutral: "bg-[var(--border-control)]",
}

/**
 * Campana de pendientes de la caja activa (T29, decisión §13.4). Lo que necesita atención
 * según el rol, calculado por el servidor al leer: no hay "leídas" ni nada que guardar.
 * Se vuelve a pedir al cambiar de página, de caja o al abrirla, así refleja lo último que
 * se registró. El número sobre la campana es cuántos pendientes hay.
 *
 * El panel usa la Popover API, como InfoTip: el navegador lo cierra con Escape y con un
 * clic afuera. Cada pendiente es un botón que lleva a la página donde se atiende.
 */
export function CampanaPendientes({ cajaId }: { cajaId: string }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [posicion, setPosicion] = useState<CSSProperties>({})
  const panelId = useId()
  const tituloId = useId()

  // pathname en las dependencias: al cambiar de página se vuelve a pedir
  const cargar = useCallback(
    () => pendientesService.get(cajaId).then(listaPendientes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cajaId, pathname],
  )
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const lista = datos ?? []

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const alCambiar = (e: Event) => setAbierto((e as ToggleEvent).newState === "open")
    panel.addEventListener("toggle", alCambiar)
    return () => panel.removeEventListener("toggle", alCambiar)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const cerrar = () => panelRef.current?.hidePopover()
    window.addEventListener("resize", cerrar)
    return () => window.removeEventListener("resize", cerrar)
  }, [abierto])

  function alternar() {
    const panel = panelRef.current
    const boton = botonRef.current
    if (!panel || !boton) return
    if (abierto) return panel.hidePopover()
    void recargar()
    panel.showPopover()
    // Debajo de la campana, alineado a su borde derecho, sin salirse de la pantalla. Se
    // mide ya abierto; el navegador da a los popovers inset 0, por eso se fija left y no right
    const r = boton.getBoundingClientRect()
    const left = Math.max(
      MARGEN,
      Math.min(r.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - MARGEN),
    )
    setPosicion({ top: r.bottom + SEPARACION, left })
  }

  function ir(enlace: string) {
    panelRef.current?.hidePopover()
    navigate(enlace)
  }

  const n = lista.length
  const etiqueta = n === 0 ? "Pendientes: ninguno" : `Pendientes: ${n}`

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        aria-label={etiqueta}
        title={etiqueta}
        aria-expanded={abierto}
        aria-controls={panelId}
        className="relative flex size-8 shrink-0 items-center justify-center rounded-lg border border-base text-secondary transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus aria-expanded:bg-surface-2 aria-expanded:text-primary"
      >
        <Bell size={16} aria-hidden="true" />
        {n > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accion-primaria px-1 text-[10px] leading-none font-semibold text-sobre-accion tabular-nums"
          >
            {n > 9 ? "9+" : n}
          </span>
        )}
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-labelledby={tituloId}
        style={posicion}
        className="fixed m-0 w-96 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-base bg-surface text-left text-primary shadow-xl open:flex"
      >
        <p id={tituloId} className="border-b border-base px-4 py-3 text-sm font-semibold">
          Pendientes
        </p>
        {error ? (
          <p className="px-4 py-4 text-sm text-secondary">
            No se pudieron cargar los pendientes: {error}
          </p>
        ) : n === 0 ? (
          <p className="px-4 py-4 text-sm text-secondary">
            {cargando ? "Buscando pendientes…" : "No hay nada pendiente. Todo está al día."}
          </p>
        ) : (
          <ul className="flex max-h-[min(28rem,70vh)] flex-col overflow-y-auto py-1">
            {lista.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => ir(p.enlace)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="flex h-5 shrink-0 items-center" aria-hidden="true">
                    <span className={`size-2 rounded-full ${PUNTO[p.tono]}`} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium text-primary">{p.titulo}</span>
                    <span className="text-xs text-secondary">{p.detalle}</span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="mt-0.5 shrink-0 text-muted"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
