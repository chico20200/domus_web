const { createClient } = require("@supabase/supabase-js")

// Cliente con la clave pública (anon) solo para las operaciones de Supabase Auth:
// registro, inicio de sesión, verificación de token y correos de recuperación.
// Nunca se usa para leer o escribir tablas: guarda en memoria la última sesión
// iniciada, y si consultara datos lo haría con el token de ese usuario.
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

module.exports = supabaseAuth
