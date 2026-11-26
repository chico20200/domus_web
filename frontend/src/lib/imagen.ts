/**
 * Reduce una foto antes de subirla (T16). Una foto de celular pesa de 3 a 8 MB; para leer
 * un comprobante bastan 1600 px por el lado mayor en JPEG, que pesa unos cientos de KB.
 * Así se sube rápido con datos móviles y queda muy por debajo del límite del bucket.
 */

const LADO_MAXIMO = 1600
const CALIDAD = 0.82

/** Para la foto de perfil y la de la caja (T17): se ven pequeñas, 512 px sobran */
export const LADO_AVATAR = 512

export class ErrorImagen extends Error {}

export async function reducirImagen(archivo: File, ladoMaximo = LADO_MAXIMO): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) {
    throw new ErrorImagen("Elige una foto (JPG, PNG o WebP)")
  }

  let imagen: ImageBitmap
  try {
    // imageOrientation: la foto queda derecha aunque el celular la guarde girada
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" })
  } catch {
    // Por ejemplo, una foto HEIC en un navegador que no la abre
    throw new ErrorImagen("No se pudo abrir la foto. Prueba con una en JPG o PNG.")
  }

  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height))
  const ancho = Math.round(imagen.width * escala)
  const alto = Math.round(imagen.height * escala)
  const lienzo = document.createElement("canvas")
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext("2d")
  if (!ctx) throw new ErrorImagen("No se pudo preparar la foto")
  // Fondo blanco: un PNG con transparencia no queda negro al pasar a JPEG
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, ancho, alto)
  ctx.drawImage(imagen, 0, 0, ancho, alto)
  imagen.close()

  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", CALIDAD))
  if (!blob) throw new ErrorImagen("No se pudo preparar la foto")
  return blob
}
