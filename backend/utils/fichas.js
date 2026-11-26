// backend/utils/fichas.js

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

module.exports = { fichaDelUsuario }
