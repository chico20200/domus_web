import { useCallback, useEffect, useState } from "react"

/**
 * Carga datos del servidor para una sección de página.
 *
 *   const cargarMiembros = useCallback(() => miembrosService.listar(cajaId), [cajaId])
 *   const { datos, cargando, error, recargar } = useDatos(cargarMiembros)
 *
 * - `cargar` tiene que ser estable (useCallback): se vuelve a pedir cuando cambia, por
 *   ejemplo al cambiar de caja.
 * - `cargando` es true solo en la primera carga. `await recargar()` (después de guardar
 *   algo) pide de nuevo sin volver a mostrar el estado de carga, así la pantalla no parpadea.
 * - Si la respuesta llega cuando la sección ya pidió otra cosa (otra caja), se descarta.
 * - `error` es el mensaje del servidor o uno genérico; la sección decide cómo mostrarlo.
 */
export function useDatos<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let vigente = true
    cargar().then(
      (d) => {
        if (!vigente) return
        setDatos(d)
        setError("")
        setCargando(false)
      },
      (e: unknown) => {
        if (!vigente) return
        setError(e instanceof Error ? e.message : "No se pudieron cargar los datos")
        setCargando(false)
      },
    )
    return () => {
      vigente = false
    }
  }, [cargar])

  // Desde un manejador de evento (después de guardar, o "Reintentar"). Se puede esperar
  // con await para seguir con los datos nuevos ya en pantalla.
  const recargar = useCallback(async () => {
    try {
      setDatos(await cargar())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos")
    }
  }, [cargar])

  return { datos, cargando, error, recargar }
}
