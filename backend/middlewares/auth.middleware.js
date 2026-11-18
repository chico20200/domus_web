// backend/middlewares/auth.middleware.js
const supabaseAuth = require("../config/supabaseAuth")
const { leerBloqueo, responderBloqueada } = require("../utils/cuentaSistema")

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"]

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" })
  }

  const token = authHeader.split(" ")[1]
  const { data, error } = await supabaseAuth.auth.getUser(token)

  if (error || !data.user) {
    return res.status(403).json({ error: "Token inválido o expirado" })
  }

  // Una cuenta bloqueada no hace nada, ni siquiera con una sesión abierta antes del
  // bloqueo: el token sigue siendo válido para Supabase hasta que vence
  let bloqueo
  try {
    bloqueo = await leerBloqueo(data.user.id)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  if (bloqueo) return responderBloqueada(res, bloqueo)

  req.user = data.user
  next()
}

module.exports = verifyToken
