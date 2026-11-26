import { Building2 } from "lucide-react"
import { Avatar } from "../../components/Avatar"
import { EditorFoto } from "../../components/EditorFoto"
import { cajasService } from "../../api/cajas.service"
import { publicarFotoCaja, useFotoCaja } from "../../lib/fotos"

/**
 * Foto de la caja (T17), en el panel de la caja en Configuración. El coordinador la pone,
 * la cambia o la quita; los demás la ven. Sale también en la barra lateral y en Mis cajas.
 */
export function FotoCaja({ cajaId, puedeCambiar }: { cajaId: string; puedeCambiar: boolean }) {
  const { fotoUrl, refrescar } = useFotoCaja(cajaId)
  const avatar = (
    <Avatar
      url={fotoUrl}
      icono={Building2}
      tamano="lg"
      forma="cuadro"
      tono="suave"
      onFalla={refrescar}
    />
  )

  if (!puedeCambiar) return fotoUrl ? avatar : null

  return (
    <EditorFoto
      avatar={avatar}
      tieneFoto={Boolean(fotoUrl)}
      ayuda="La ven todos los miembros de la caja. JPG, PNG o WebP."
      onSubir={async (imagen) => {
        const { foto_url } = await cajasService.subirFoto(cajaId, imagen)
        publicarFotoCaja(cajaId, foto_url)
      }}
      onQuitar={async () => {
        await cajasService.quitarFoto(cajaId)
        publicarFotoCaja(cajaId, null)
      }}
    />
  )
}
