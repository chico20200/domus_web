// backend/routes/miembros.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso, NIVEL } = require("../middlewares/permisos.middleware")
const { responderError } = require("../utils/errores")

const ROLES_VALIDOS = Object.keys(NIVEL)

router.use(verifyToken)

// ── Helper: genera código legible ────────────────────────────
function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let codigo = ""
  for (let i = 0; i < 8; i++) {
    codigo += chars[Math.floor(Math.random() * chars.length)]
  }
  return codigo
}

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/miembros
// Lista miembros de la caja
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId } = req.params

  // 1. Trae los miembros con su user_id
  const { data: miembros, error } = await req.db
    .from("miembros_caja")
    .select("id, user_id, rol, activo, created_at")
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error al leer miembros:", error.message)
    return responderError(res, error)
  }

  if (!miembros || miembros.length === 0) {
    return res.json({ miembros: [] })
  }

  // 2. Trae los perfiles de esos usuarios
  const userIds = miembros.map((m) => m.user_id)

  const { data: perfiles } = await req.db.from("profiles").select("id, nombre").in("id", userIds)

  const perfilPorId = {}
  ;(perfiles ?? []).forEach((p) => {
    perfilPorId[p.id] = p
  })

  // 3. Los correos están en auth.users, que la clave pública no lee: los da la función
  // correos_miembros (migración 004), solo a quien ve los miembros de la caja
  const { data: correos, error: errorCorreos } = await req.db.rpc("correos_miembros", {
    p_caja: cajaId,
  })
  if (errorCorreos) return responderError(res, errorCorreos)
  const emailPorId = {}
  ;(correos ?? []).forEach((c) => {
    emailPorId[c.user_id] = c.email ?? ""
  })

  // 4. Arma la respuesta
  const resultado = miembros.map((m) => ({
    id: m.user_id, // ← el frontend usa este id para cambiar rol / remover
    rol: m.rol,
    activo: m.activo,
    email: emailPorId[m.user_id] ?? "",
    profiles: perfilPorId[m.user_id] ? { nombre: perfilPorId[m.user_id].nombre } : null,
  }))

  return res.json({ miembros: resultado })
})
// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/miembros/:userId
// Cambia el rol de un miembro — solo coordinador
// ─────────────────────────────────────────────
router.put("/:userId", requierePermiso("miembros.gestionar"), async (req, res) => {
  const { cajaId, userId } = req.params

  const { nuevoRol } = req.body
  if (!ROLES_VALIDOS.includes(nuevoRol)) {
    return res.status(400).json({ error: "Rol inválido" })
  }

  // No puede cambiar su propio rol
  if (userId === req.user.id) {
    return res.status(400).json({ error: "No puedes cambiar tu propio rol" })
  }

  const { data, error } = await req.db
    .from("miembros_caja")
    .update({ rol: nuevoRol })
    .eq("caja_id", cajaId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) return responderError(res, error)

  return res.json({ message: "Rol actualizado correctamente", miembro: data })
})

// ─────────────────────────────────────────────
// DELETE /api/cajas/:cajaId/miembros/:userId
// Remueve un miembro — solo coordinador
// ─────────────────────────────────────────────
router.delete("/:userId", requierePermiso("miembros.gestionar"), async (req, res) => {
  const { cajaId, userId } = req.params

  if (userId === req.user.id) {
    return res.status(400).json({ error: "No puedes removerte a ti mismo" })
  }

  const { error } = await req.db
    .from("miembros_caja")
    .update({ activo: false })
    .eq("caja_id", cajaId)
    .eq("user_id", userId)

  if (error) return responderError(res, error)

  return res.json({ message: "Miembro removido correctamente" })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/invitaciones
// Genera un código de invitación — solo coordinador
// ─────────────────────────────────────────────
router.post("/invitaciones", requierePermiso("miembros.gestionar"), async (req, res) => {
  const { cajaId } = req.params

  const { rolInvitado = "socio" } = req.body
  if (!ROLES_VALIDOS.includes(rolInvitado)) {
    return res.status(400).json({ error: "Rol inválido" })
  }

  // Desactiva códigos anteriores no usados de esta caja
  await req.db
    .from("invitaciones_caja")
    .update({ activo: false })
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .is("usado_por", null)

  const codigo = generarCodigo()
  const expiraAt = new Date()
  expiraAt.setDate(expiraAt.getDate() + 7) // expira en 7 días

  const { data, error } = await req.db
    .from("invitaciones_caja")
    .insert({
      caja_id: cajaId,
      codigo,
      rol: rolInvitado,
      creado_por: req.user.id,
      expira_at: expiraAt.toISOString(),
    })
    .select()
    .single()

  if (error) return responderError(res, error)

  return res.status(201).json({
    message: "Código generado correctamente",
    codigo: data.codigo,
    expira: data.expira_at,
    rol: data.rol,
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/invitaciones
// Ver código activo de la caja — solo coordinador
// ─────────────────────────────────────────────
router.get("/invitaciones", requierePermiso("miembros.gestionar"), async (req, res) => {
  const { cajaId } = req.params

  const { data } = await req.db
    .from("invitaciones_caja")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .is("usado_por", null)
    .gt("expira_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return res.json({ invitacion: data ?? null })
})

module.exports = router
