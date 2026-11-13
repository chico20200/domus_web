// backend/utils/contrasena.js

/**
 * Política de contraseña (HU-A01): al menos 8 caracteres, con letras y números. Es la
 * misma regla del frontend (src/lib/validacion.ts). Devuelve el mensaje de error o "".
 */
function validarContrasena(valor) {
  if (typeof valor !== "string" || !valor) return "La contraseña es requerida"
  if (valor.length < 8) return "La contraseña debe tener al menos 8 caracteres"
  if (!/\p{L}/u.test(valor) || !/\d/.test(valor)) {
    return "La contraseña debe combinar letras y números"
  }
  return ""
}

module.exports = { validarContrasena }
