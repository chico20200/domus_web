/**
 * Foto de perfil y foto de la caja (Etapa 6, T17). Se suben con el token de la persona
 * (req.db): las políticas de los buckets perfiles y cajas (migración 010) deciden quién
 * puede. Después poner_foto_perfil o poner_foto_caja (012) guarda la ruta y devuelve la
 * anterior, que se borra: cada cuenta y cada caja tiene una sola foto en Storage.
 */
const supabaseAdmin = require("../config/supabaseAdmin")
const { responderError } = require("./errores")
const {
  MB,
  leerImagen,
  errorImagen,
  tipoDe,
  nombreArchivo,
  responderErrorSubida,
} = require("./imagenes")

// La foto se ve todo el tiempo (barra, perfil, lista de cajas): el enlace dura una hora y
// el frontend lo vuelve a pedir si una imagen deja de cargar
const SEGUNDOS_ENLACE = 60 * 60
const leerFoto = leerImagen(2 * MB) // el límite de los buckets perfiles y cajas

/**
 * Sube la foto a {carpeta}/{uuid}.ext y llama a la función que la pone.
 * Responde 200 con { foto_url } firmada, o el error.
 */
async function subirFoto(req, res, { bucket, carpeta, rpc, args, sinPermiso }) {
  const problema = errorImagen(req)
  if (problema) return res.status(400).json({ error: problema })

  const ruta = `${carpeta}/${nombreArchivo(req)}`
  const { error: errorSubida } = await req.db.storage
    .from(bucket)
    .upload(ruta, req.body, { contentType: tipoDe(req), upsert: false })
  if (errorSubida) return responderErrorSubida(res, errorSubida, sinPermiso)

  const { data, error } = await req.db.rpc(rpc, { ...args, p_ruta: ruta })
  if (error) {
    // La foto quedó subida pero sin uso: se borra solo esta ruta, recién creada
    await supabaseAdmin.storage
      .from(bucket)
      .remove([ruta])
      .catch(() => {})
    return responderError(res, error)
  }
  await borrarAnterior(req, bucket, data?.anterior)

  return res.json({ message: "Foto guardada", foto_url: await enlace(req.db, bucket, ruta) })
}

/** Quita la foto: la ruta queda vacía y el archivo se borra */
async function quitarFoto(req, res, { bucket, rpc, args }) {
  const { data, error } = await req.db.rpc(rpc, { ...args, p_ruta: null })
  if (error) return responderError(res, error)
  await borrarAnterior(req, bucket, data?.anterior)
  return res.json({ message: "Foto quitada", foto_url: null })
}

// Con el token de la persona: la política del bucket le deja borrar lo suyo. Si falla,
// la foto ya no está en uso y no se muestra; no vale la pena fallar la petición.
async function borrarAnterior(req, bucket, ruta) {
  if (!ruta) return
  await req.db.storage
    .from(bucket)
    .remove([ruta])
    .catch(() => {})
}

/** Enlace firmado de una ruta, o null si no hay ruta o no se pudo firmar */
async function enlace(db, bucket, ruta) {
  if (!ruta) return null
  const { data } = await db.storage.from(bucket).createSignedUrl(ruta, SEGUNDOS_ENLACE)
  return data?.signedUrl ?? null
}

/** Enlaces de varias rutas en una sola llamada: { ruta: url } */
async function enlaces(db, bucket, rutas) {
  const conRuta = [...new Set(rutas.filter(Boolean))]
  if (conRuta.length === 0) return {}
  const { data } = await db.storage.from(bucket).createSignedUrls(conRuta, SEGUNDOS_ENLACE)
  const porRuta = {}
  ;(data ?? []).forEach((d) => {
    if (d.signedUrl && !d.error) porRuta[d.path] = d.signedUrl
  })
  return porRuta
}

module.exports = { leerFoto, subirFoto, quitarFoto, enlace, enlaces }
