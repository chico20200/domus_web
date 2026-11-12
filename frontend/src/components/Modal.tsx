import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react"
import { X } from "lucide-react"

/**
 * Ventana modal (especificaciones §3, Modal).
 *
 * Usa <dialog> con showModal(), así el navegador se encarga de lo difícil:
 * - Foco atrapado: el resto de la página queda inerte; Tab no sale del modal.
 * - Escape cierra (evento "cancel").
 * - Se dibuja por encima de todo, sin z-index.
 *
 * Además:
 * - Clic afuera (en el fondo oscuro) cierra, salvo `cerrarAlClicFuera={false}`. Un arrastre
 *   que empieza adentro y termina afuera (seleccionar texto) no cierra.
 * - Al abrir, el foco va al primer campo o botón del cuerpo; si no hay, al botón Cerrar.
 * - Al cerrar, el foco vuelve al elemento que abrió el modal.
 * - aria-modal, y título y descripción enlazados con aria-labelledby y aria-describedby.
 *
 * Es controlado: el modal se abre y se cierra solo con `abierto`. Escape, clic afuera y
 * el botón Cerrar llaman a `onCerrar`; la página decide.
 *
 *   <Modal abierto={ver} onCerrar={() => setVer(false)} titulo="Nueva cuenta"
 *          acciones={<Button ... />}>
 *     ...
 *   </Modal>
 */

export type AnchoModal = "normal" | "amplio"

interface ModalProps {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  /** Una línea bajo el título que explica para qué es el modal */
  descripcion?: string
  /**
   * Botones del pie, en fila a la derecha. La acción principal va al final (la más a la
   * derecha) y Cancelar o Cerrar antes. En `Form`, que alinea a la izquierda, es al revés
   */
  acciones?: ReactNode
  /** normal: 448 px (formularios, confirmaciones). amplio: 768 px (tablas) */
  ancho?: AnchoModal
  /** false en formularios largos donde un clic accidental haría perder lo escrito */
  cerrarAlClicFuera?: boolean
  children?: ReactNode
}

const ANCHOS: Record<AnchoModal, string> = {
  normal: "max-w-md",
  amplio: "max-w-3xl",
}

const ENFOCABLES =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  acciones,
  ancho = "normal",
  cerrarAlClicFuera = true,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cuerpoRef = useRef<HTMLDivElement>(null)
  const anterior = useRef<HTMLElement | null>(null)
  const pulsoEnFondo = useRef(false)
  // Última versión de onCerrar, para no volver a registrar el listener en cada render
  const onCerrarRef = useRef(onCerrar)
  useEffect(() => {
    onCerrarRef.current = onCerrar
  })

  const tituloId = useId()
  const descripcionId = useId()

  // Abrir y cerrar según la prop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (abierto && !dialog.open) {
      anterior.current = document.activeElement as HTMLElement | null
      dialog.showModal()
      const primero = cuerpoRef.current?.querySelector<HTMLElement>(ENFOCABLES)
      primero?.focus()
    } else if (!abierto && dialog.open) {
      dialog.close()
    }
  }, [abierto])

  // Escape: el navegador dispara "cancel". Se cancela el cierre nativo y decide la página.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const alCancelar = (e: Event) => {
      e.preventDefault()
      onCerrarRef.current()
    }
    // Si el navegador cierra igual (algunos ignoran preventDefault en un segundo Escape
    // seguido), se avisa a la página para que el estado no quede abierto.
    const alCerrar = () => {
      anterior.current?.focus()
      anterior.current = null
      if (abierto) onCerrarRef.current()
    }
    dialog.addEventListener("cancel", alCancelar)
    dialog.addEventListener("close", alCerrar)
    return () => {
      dialog.removeEventListener("cancel", alCancelar)
      dialog.removeEventListener("close", alCerrar)
    }
  }, [abierto])

  // Si el componente se desmonta abierto, devolver el foco igual
  useEffect(() => {
    const dialog = dialogRef.current
    return () => {
      if (dialog?.open) anterior.current?.focus()
    }
  }, [])

  // Clic afuera: el <dialog> no tiene relleno, así que un clic cuyo destino es el propio
  // <dialog> cayó en el fondo. Se exige que también la pulsación empezara ahí.
  function alPulsar(e: MouseEvent<HTMLDialogElement>) {
    pulsoEnFondo.current = e.target === e.currentTarget
  }
  function alClic(e: MouseEvent<HTMLDialogElement>) {
    if (cerrarAlClicFuera && pulsoEnFondo.current && e.target === e.currentTarget) onCerrar()
    pulsoEnFondo.current = false
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={tituloId}
      aria-describedby={descripcion ? descripcionId : undefined}
      onMouseDown={alPulsar}
      onClick={alClic}
      className={[
        "m-auto w-[calc(100%-2rem)] p-0",
        "max-h-[calc(100dvh-2rem)]",
        ANCHOS[ancho],
        "rounded-xl border border-base bg-surface text-primary shadow-xl",
        "backdrop:bg-black/50",
      ].join(" ")}
    >
      {abierto && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header
            className={`flex items-start justify-between gap-4 p-6 ${children ? "pb-4" : ""}`}
          >
            <div className="flex flex-col gap-1">
              <h2 id={tituloId} className="text-base font-semibold text-primary">
                {titulo}
              </h2>
              {descripcion && (
                <p id={descripcionId} className="text-sm text-secondary">
                  {descripcion}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="-m-2 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          {/* Sin contenido (una confirmación), el cuerpo no se pinta para no dejar un hueco */}
          {children && (
            <div ref={cuerpoRef} className="flex-1 overflow-y-auto px-6 pb-6">
              {children}
            </div>
          )}

          {acciones && (
            <footer className="flex flex-wrap justify-end gap-3 border-t border-base px-6 py-4">
              {acciones}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
