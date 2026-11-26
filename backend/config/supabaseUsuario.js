const { createClient } = require("@supabase/supabase-js")

/**
 * Cliente de Supabase con el token de quien hace la petición (Etapa 6, T6).
 *
 * Usa la clave pública: cada consulta pasa por las políticas de RLS de la migración 004,
 * así que la base misma decide qué ve y qué escribe esta persona en cada caja. Se crea uno
 * por petición en verifyToken (req.db) y no guarda sesión.
 *
 * La clave de servicio (supabaseAdmin) queda solo para lo que no es de una caja: el panel
 * del administrador del sistema y el estado de la cuenta (bloqueos).
 */
function clienteDeUsuario(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

module.exports = { clienteDeUsuario }
