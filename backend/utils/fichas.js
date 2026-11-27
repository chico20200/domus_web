// backend/utils/fichas.js
const { NIVEL } = require("../middlewares/permisos.middleware")

/**
 * Ficha de socio de quien hace la petición en una caja: la vinculada a su cuenta o, si no
 * hay, la que tiene su mismo correo (y en ese caso queda vinculada). Así una ficha creada
 * después de que la persona se unió a la caja también se encuentra.
 *
 * Lo hace la función vincular_mi_ficha de la base (migración 004): el socio no puede
 * editar fichas, así que el vínculo se escribe con permisos propios, solo para su correo.
 * Compara el correo completo sin mayúsculas, sin comodines. Devuelve la ficha o null.
 */
async function fichaDelUsuario(db, cajaId) {
  const { data, error } = await db.rpc("vincular_mi_ficha", { p_caja: cajaId })
  if (error) throw error
  return data ?? null
}

/**
 * ¿Quien hace la petición puede ver algo de este socio? El tesorero y el coordinador ven
 * todo; el socio, solo lo de su propia ficha (T27). `titular` es el user_id de la ficha.
 * El RLS ya esconde lo ajeno; esto deja la regla escrita también en la ruta.
 */
function puedeVerDelSocio(req, titular) {
  return NIVEL[req.rol] >= NIVEL.tesorero || (titular != null && titular === req.user.id)
}

module.exports = { fichaDelUsuario, puedeVerDelSocio }
