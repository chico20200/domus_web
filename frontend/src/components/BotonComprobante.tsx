import { useRef, useState } from "react"
import { ImagePlus, Receipt } from "lucide-react"
import { Button } from "./Button"
import { useNotif } from "../context/NotifContext"
import { comprobantesService, type DestinoComprobante } from "../api/comprobantes.service"
import { ErrorImagen, reducirImagen } from "../lib/imagen"

/**
 * El comprobante de una fila del historial (T16): "Ver foto" si tiene; "Agregar foto" si
 * no tiene y quien mira puede registrar movimientos; nada en otro caso. La foto se abre
 * en otra pestaña con un enlace firmado que vence en pocos minutos.
 */
export function BotonComprobante({
  destino,
  tiene,
  puedeAdjuntar,
  descripcion,
  onAdjuntado,
}: {
  destino: DestinoComprobante
  tiene: boolean
  puedeAdjuntar: boolean
  /** Para el lector de pantalla: "del depósito del 12/11/2026" */
  descripcion: string
  onAdjuntado?: () => void | Promise<void>
}) {
  const { toast } = useNotif()
  const entrada = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)

  async function ver() {
    // La pestaña se abre en el clic (si no, el navegador la bloquea) y se le pone la
    // dirección cuando llega el enlace firmado
    const ventana = window.open("", "_blank")
    setOcupado(true)
    try {
      const url = await comprobantesService.enlace(destino)
      if (ventana) {
        ventana.opener = null
        ventana.location.href = url
      } else window.location.assign(url)
    } catch (err) {
      ventana?.close()
      toast("error", err instanceof Error ? err.message : "No se pudo abrir el comprobante")
    } finally {
      setOcupado(false)
    }
  }

  async function agregar(archivo: File | undefined) {
    if (!archivo) return
    setOcupado(true)
    try {
      await comprobantesService.subir(destino, await reducirImagen(archivo))
      toast("exito", "Foto del comprobante guardada")
      await onAdjuntado?.()
    } catch (err) {
      toast(
        "error",
        err instanceof ErrorImagen || err instanceof Error
          ? err.message
          : "No se pudo guardar la foto",
      )
    } finally {
      setOcupado(false)
      if (entrada.current) entrada.current.value = ""
    }
  }

  if (tiene) {
    return (
      <Button
        label="Ver foto"
        variant="ghost"
        icon={Receipt}
        loading={ocupado}
        ariaLabel={`Ver la foto del comprobante ${descripcion}`}
        onClick={ver}
      />
    )
  }
  if (!puedeAdjuntar) return null
  return (
    <>
      <Button
        label="Agregar foto"
        variant="ghost"
        icon={ImagePlus}
        loading={ocupado}
        ariaLabel={`Agregar la foto del comprobante ${descripcion}`}
        onClick={() => entrada.current?.click()}
      />
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => agregar(e.target.files?.[0])}
      />
    </>
  )
}
