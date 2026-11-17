// backend/utils/cuentaSistema.js
const supabaseAdmin = require("../config/supabaseAdmin")

/**
 * Lo que la administración del sistema sabe de una cuenta de usuario (migración 003):
 * si está bloqueada y si administra DOMUS. Las dos tablas solo se leen con la clave de
 * servicio; la cuenta no puede cambiarlas.
 */

/** El bloqueo de la cuenta ({ motivo, bloqueada_en }) o null. Lanza si la consulta falla */
async function leerBloqueo(userId) {
  const { data, error } = await supabaseAdmin
    .from("bloqueos_cuenta")
    .select("motivo, bloqueada_en")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Si la cuenta administra DOMUS. Lanza si la consulta falla */
async function esAdminSistema(userId) {
  const { data, error } = await supabaseAdmin
    .from("administradores_sistema")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

/**
 * Respuesta para una cuenta bloqueada: 403 con `codigo: "cuenta_bloqueada"` y el motivo,
 * para que el login lo muestre y el frontend cierre una sesión abierta.
 */
function responderBloqueada(res, bloqueo) {
  return res.status(403).json({
    error: "Tu cuenta está bloqueada por la administración de DOMUS.",
    codigo: "cuenta_bloqueada",
    motivo: bloqueo.motivo,
    bloqueada_en: bloqueo.bloqueada_en,
  })
}

module.exports = { leerBloqueo, esAdminSistema, responderBloqueada }
