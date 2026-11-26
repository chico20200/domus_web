/**
 * Lo común de las fotos que se suben (T16 y T17): la imagen llega como cuerpo de la
 * petición, sin JSON ni base64, y se revisa que sea de verdad una imagen.
 */
const express = require("express")

const TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
const MB = 1024 * 1024

/** Lee el cuerpo como imagen, hasta `bytes`. Un cuerpo mayor responde 413 (server.js) */
const leerImagen = (bytes) => express.raw({ type: Object.keys(TIPOS), limit: bytes })

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

function tipoDe(req) {
  return (req.headers["content-type"] ?? "").split(";")[0].trim()
}

/** Mensaje de error de la imagen recibida, o "" si se puede subir */
function errorImagen(req) {
  const tipo = tipoDe(req)
  if (!TIPOS[tipo]) return "La foto tiene que ser JPG, PNG o WebP"
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return "No llegó ninguna foto"
  if (!esDelTipo(req.body, tipo)) return "El archivo no es una imagen válida"
  return ""
}

/** Nombre nuevo para el archivo, con la extensión de su tipo */
function nombreArchivo(req) {
  return `${require("crypto").randomUUID()}.${TIPOS[tipoDe(req)]}`
}

/** Respuesta a un error de Storage al subir: 403 si lo rechazó la política */
function responderErrorSubida(res, error, sinPermiso) {
  const estado = Number(error.statusCode ?? error.status) || 400
  return res.status(estado === 403 ? 403 : 400).json({
    error: estado === 403 ? sinPermiso : `No se pudo guardar la foto: ${error.message}`,
  })
}

module.exports = { MB, TIPOS, leerImagen, errorImagen, tipoDe, nombreArchivo, responderErrorSubida }
