import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "./Button"
import { ErrorImagen, reducirImagen } from "../lib/imagen"

/**
 * Foto opcional del comprobante al registrar un depósito, retiro o pago (T16). En el
 * celular el sistema ofrece la cámara o la galería. La foto se reduce aquí y se sube
 * después de registrar el movimiento.
 */
export function CampoComprobante({
  valor,
  onCambio,
}: {
  valor: Blob | null
  onCambio: (imagen: Blob | null) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState("")

  // La vista previa sigue a la imagen elegida y se libera al cambiarla
  const vista = useMemo(() => (valor ? URL.createObjectURL(valor) : null), [valor])
  useEffect(() => {
    if (vista) return () => URL.revokeObjectURL(vista)
  }, [vista])

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    setError("")
    setProcesando(true)
    try {
      onCambio(await reducirImagen(archivo))
    } catch (err) {
      setError(err instanceof ErrorImagen ? err.message : "No se pudo preparar la foto")
    } finally {
      setProcesando(false)
      // Permite volver a elegir el mismo archivo después de quitarlo
      if (entrada.current) entrada.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-primary">Foto del comprobante</span>
      {vista ? (
        <div className="flex items-center gap-3">
          <img
            src={vista}
            alt="Vista previa del comprobante"
            className="h-16 w-16 rounded-lg border border-base object-cover"
          />
          <Button label="Quitar foto" variant="ghost" icon={X} onClick={() => onCambio(null)} />
        </div>
      ) : (
        <div>
          <Button
            label="Tomar o elegir foto"
            variant="secondary"
            icon={Camera}
            loading={procesando}
            onClick={() => entrada.current?.click()}
          />
        </div>
      )}
      <p className="text-xs text-secondary">
        Opcional. Una foto del recibo o del dinero entregado, como respaldo del registro.
      </p>
      {error && (
        <p className="text-xs text-destructivo" role="alert">
          {error}
        </p>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => elegir(e.target.files?.[0])}
      />
    </div>
  )
}
