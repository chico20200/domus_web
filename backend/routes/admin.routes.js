// backend/routes/admin.routes.js
const express = require("express")
const router = express.Router()
const supabaseAdmin = require("../config/supabaseAdmin")
const verifyToken = require("../middlewares/auth.middleware")
const requiereAdminSistema = require("../middlewares/adminSistema.middleware")
const { ACUERDO_VERSION } = require("../utils/confidencialidad")

// Panel de administración del sistema (HU019 a HU021). Solo para las cuentas de
// administradores_sistema; nada de aquí depende de una caja ni de sus roles.
router.use(verifyToken, requiereAdminSistema)

/** La aceptación de la versión vigente del acuerdo, o null. Lanza si la consulta falla */
async function leerAceptacion(userId) {
  const { data, error } = await supabaseAdmin
    .from("aceptaciones_confidencialidad")
    .select("aceptada_en")
    .eq("user_id", userId)
    .eq("version", ACUERDO_VERSION)
    .maybeSingle()
  if (error) throw error
  return data
}

// GET /api/admin/acuerdo
// Versión vigente del acuerdo de confidencialidad y si esta cuenta ya la aceptó
router.get("/acuerdo", async (req, res) => {
  try {
    const aceptacion = await leerAceptacion(req.user.id)
    return res.json({
      version: ACUERDO_VERSION,
      aceptado: Boolean(aceptacion),
      aceptado_en: aceptacion?.aceptada_en ?? null,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/acuerdo  { version }
// Registra la aceptación (HU-S03). La versión tiene que ser la vigente: así no se acepta
// un texto viejo que el navegador tenía en caché. Aceptar dos veces no duplica la fila.
router.post("/acuerdo", async (req, res) => {
  if (req.body?.version !== ACUERDO_VERSION) {
    return res.status(400).json({
      error: "El acuerdo cambió. Recarga la página para leer la versión vigente.",
      version: ACUERDO_VERSION,
    })
  }
  try {
    const previa = await leerAceptacion(req.user.id)
    if (previa) return res.json({ version: ACUERDO_VERSION, aceptado_en: previa.aceptada_en })

    const { data, error } = await supabaseAdmin
      .from("aceptaciones_confidencialidad")
      .insert({ user_id: req.user.id, version: ACUERDO_VERSION })
      .select("aceptada_en")
      .single()
    if (error) throw error
    return res.status(201).json({ version: ACUERDO_VERSION, aceptado_en: data.aceptada_en })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// Todo lo que sigue exige el acuerdo vigente aceptado (HU-S03): sin él, el panel no
// entrega ningún dato
router.use(async (req, res, next) => {
  try {
    if (!(await leerAceptacion(req.user.id))) {
      return res.status(403).json({
        error: "Acepta el acuerdo de confidencialidad para abrir el panel",
        codigo: "acuerdo_pendiente",
        version: ACUERDO_VERSION,
      })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  next()
})

module.exports = router
