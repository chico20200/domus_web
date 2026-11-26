import { useRef, useState, type ReactNode } from "react"
import { Camera, Trash2 } from "lucide-react"
import { Button } from "./Button"
import { useNotif } from "../context/NotifContext"
import { ErrorImagen, LADO_AVATAR, reducirImagen } from "../lib/imagen"

/**
 * Cambiar o quitar una foto de perfil o de caja (T17): la foto actual y dos botones. La
 * imagen se reduce a 512 px antes de subirla. El componente que lo usa decide qué
 * servicio llamar y publica la foto nueva para el resto de la app.
 */
export function EditorFoto({
  avatar,
  tieneFoto,
  ayuda,
  onSubir,
  onQuitar,
}: {
  avatar: ReactNode
  tieneFoto: boolean
  ayuda: string
  onSubir: (imagen: Blob) => Promise<void>
  onQuitar: () => Promise<void>
}) {
  const { toast } = useNotif()
  const entrada = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState<"subir" | "quitar" | null>(null)

  async function elegir(archivo: File | undefined) {
    if (!archivo) return
    setOcupado("subir")
    try {
      await onSubir(await reducirImagen(archivo, LADO_AVATAR))
      toast("exito", "Foto actualizada")
    } catch (err) {
      toast(
        "error",
        err instanceof ErrorImagen || err instanceof Error
          ? err.message
          : "No se pudo guardar la foto",
      )
    } finally {
      setOcupado(null)
      if (entrada.current) entrada.current.value = ""
    }
  }

  async function quitar() {
    setOcupado("quitar")
    try {
      await onQuitar()
      toast("exito", "Foto quitada")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo quitar la foto")
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {avatar}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            label={tieneFoto ? "Cambiar foto" : "Poner foto"}
            variant="secondary"
            icon={Camera}
            loading={ocupado === "subir"}
            disabled={ocupado !== null}
            onClick={() => entrada.current?.click()}
          />
          {tieneFoto && (
            <Button
              label="Quitar"
              variant="ghost"
              icon={Trash2}
              loading={ocupado === "quitar"}
              disabled={ocupado !== null}
              onClick={quitar}
            />
          )}
        </div>
        <p className="text-xs text-secondary">{ayuda}</p>
      </div>
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
