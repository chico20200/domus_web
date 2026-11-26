/**
 * Fotos de comprobantes (Etapa 6, T16). Se suben con el token de la persona (req.db), así
 * las políticas del bucket comprobantes (migración 010) deciden quién puede; y se unen al
 * movimiento con adjuntar_comprobante (011), que revisa la ruta y que no tenga foto ya.
 */
const supabaseAdmin = require("../config/supabaseAdmin")
const { responderError } = require("./errores")
const {
  MB,
  leerImagen: lector,
  errorImagen,
  tipoDe,
  nombreArchivo,
  responderErrorSubida,
} = require("./imagenes")

const BUCKET = "comprobantes"
const MAXIMO = 5 * MB // el mismo límite del bucket
// Cuánto dura el enlace para ver la foto: lo justo para abrirla
const SEGUNDOS_ENLACE = 300

/** El cuerpo de la petición es la imagen tal cual (sin JSON ni base64) */
const leerImagen = lector(MAXIMO)

/**
 * Sube la foto a {caja}/{socio}/{uuid}.ext y la une al registro.
 * tipo: 'movimiento' | 'pago'. Responde 201 con { comprobante: true } o el error.
 */
async function subirYAdjuntar(req, res, { tipo, id, cajaId, socioId }) {
  const problema = errorImagen(req)
  if (problema) return res.status(400).json({ error: problema })

  const ruta = `${cajaId}/${socioId}/${nombreArchivo(req)}`

  const { error: errorSubida } = await req.db.storage
    .from(BUCKET)
    .upload(ruta, req.body, { contentType: tipoDe(req), upsert: false })
  if (errorSubida) {
    // La política del bucket rechaza (rol, caja bloqueada) o Storage (tamaño, tipo)
    return responderErrorSubida(
      res,
      errorSubida,
      "No tienes permiso para subir comprobantes en esta caja",
    )
  }

  const { error } = await req.db.rpc("adjuntar_comprobante", {
    p_tipo: tipo,
    p_id: id,
    p_ruta: ruta,
  })
  if (error) {
    // La foto quedó subida pero sin registro (por ejemplo, otro la adjuntó antes). Nadie
    // puede borrar comprobantes con su token; se limpia con la clave de servicio para no
    // dejar archivos sueltos. Solo se borra esta ruta, recién creada en esta petición.
    await supabaseAdmin.storage
      .from(BUCKET)
      .remove([ruta])
      .catch(() => {})
    return responderError(res, error)
  }

  return res.status(201).json({ message: "Comprobante guardado", comprobante: true })
}

/** Enlace firmado y corto para ver la foto. Responde { url } o el error */
async function enviarEnlace(req, res, ruta) {
  if (!ruta) return res.status(404).json({ error: "Este registro no tiene comprobante" })
  const { data, error } = await req.db.storage.from(BUCKET).createSignedUrl(ruta, SEGUNDOS_ENLACE)
  if (error || !data?.signedUrl) {
    return res.status(404).json({ error: "No se pudo abrir el comprobante" })
  }
  return res.json({ url: data.signedUrl, vence_en: SEGUNDOS_ENLACE })
}

module.exports = { leerImagen, errorImagen, subirYAdjuntar, enviarEnlace, MAXIMO }
