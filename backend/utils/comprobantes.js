/**
 * Fotos de comprobantes (Etapa 6, T16). Se suben con el token de la persona (req.db), así
 * las políticas del bucket comprobantes (migración 010) deciden quién puede; y se unen al
 * movimiento con adjuntar_comprobante (011), que revisa la ruta y que no tenga foto ya.
 */
const crypto = require("crypto")
const express = require("express")
const supabaseAdmin = require("../config/supabaseAdmin")
const { responderError } = require("./errores")

const BUCKET = "comprobantes"
const MAXIMO = 5 * 1024 * 1024 // el mismo límite del bucket
const TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
// Cuánto dura el enlace para ver la foto: lo justo para abrirla
const SEGUNDOS_ENLACE = 300

/** El cuerpo de la petición es la imagen tal cual (sin JSON ni base64) */
const leerImagen = express.raw({ type: Object.keys(TIPOS), limit: MAXIMO })

/** Que los primeros bytes sean de verdad del tipo que dice: no basta el Content-Type */
function esDelTipo(buffer, tipo) {
  if (tipo === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (tipo === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (tipo === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    )
  }
  return false
}

/** Mensaje de error de la imagen recibida, o "" si se puede subir */
function errorImagen(req) {
  const tipo = (req.headers["content-type"] ?? "").split(";")[0].trim()
  if (!TIPOS[tipo]) return "La foto tiene que ser JPG, PNG o WebP"
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return "No llegó ninguna foto"
  if (!esDelTipo(req.body, tipo)) return "El archivo no es una imagen válida"
  return ""
}

/**
 * Sube la foto a {caja}/{socio}/{uuid}.ext y la une al registro.
 * tipo: 'movimiento' | 'pago'. Responde 201 con { comprobante: true } o el error.
 */
async function subirYAdjuntar(req, res, { tipo, id, cajaId, socioId }) {
  const problema = errorImagen(req)
  if (problema) return res.status(400).json({ error: problema })

  const contentType = req.headers["content-type"].split(";")[0].trim()
  const ruta = `${cajaId}/${socioId}/${crypto.randomUUID()}.${TIPOS[contentType]}`

  const { error: errorSubida } = await req.db.storage
    .from(BUCKET)
    .upload(ruta, req.body, { contentType, upsert: false })
  if (errorSubida) {
    // La política del bucket rechaza (rol, caja bloqueada) o Storage (tamaño, tipo)
    const estado = Number(errorSubida.statusCode ?? errorSubida.status) || 400
    return res.status(estado === 403 ? 403 : 400).json({
      error:
        estado === 403
          ? "No tienes permiso para subir comprobantes en esta caja"
          : `No se pudo guardar la foto: ${errorSubida.message}`,
    })
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
