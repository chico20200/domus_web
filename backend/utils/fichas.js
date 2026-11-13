// backend/utils/fichas.js
const supabaseAdmin = require("../config/supabaseAdmin")

/** Escapa los comodines de LIKE (%, _ y \) para comparar un texto literal con ilike */
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Vincula a una cuenta de usuario la ficha de socio de la caja que tiene su mismo correo
 * y todavía no tiene usuario. El correo se compara sin distinguir mayúsculas. Devuelve la
 * ficha vinculada, o null si no hay ninguna.
 */
async function vincularFichaPorCorreo(cajaId, userId, email) {
  const correo = typeof email === "string" ? email.trim() : ""
  if (!correo) return null

  const { data: ficha } = await supabaseAdmin
    .from("socios")
    .select("id, nombre, apellido, activo")
    .eq("caja_id", cajaId)
    .ilike("email", escaparLike(correo))
    .is("user_id", null)
    .limit(1)
    .maybeSingle()
  if (!ficha) return null

  const { error } = await supabaseAdmin
    .from("socios")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("id", ficha.id)
    .eq("caja_id", cajaId)
    .is("user_id", null)
  return error ? null : ficha
}

/**
 * Ficha de socio de un usuario en una caja: la vinculada a su cuenta o, si no hay, la que
 * tiene su correo (y en ese caso queda vinculada). Así una ficha creada después de que la
 * persona se unió a la caja también se encuentra.
 */
async function fichaDelUsuario(cajaId, user) {
  const { data: ficha } = await supabaseAdmin
    .from("socios")
    .select("id, nombre, apellido, activo")
    .eq("caja_id", cajaId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()
  if (ficha) return ficha
  return vincularFichaPorCorreo(cajaId, user.id, user.email)
}

module.exports = { escaparLike, vincularFichaPorCorreo, fichaDelUsuario }
