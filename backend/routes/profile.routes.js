// backend/routes/profile.routes.js
const express = require("express")
const { responderError } = require("../utils/errores")
const router = express.Router()
const verifyToken = require("../middlewares/auth.middleware")
const {
  esAdminSistema,
  contarCajasActivas,
  calcularEstadoCuenta,
} = require("../utils/cuentaSistema")

router.use(verifyToken)

// GET /api/profiles/me
// Devuelve el perfil del usuario autenticado, el estado de su cuenta (HU-A03) y si
// administra DOMUS. Una cuenta bloqueada no llega aquí (verifyToken la detiene), así que
// el estado que se ve en el perfil es activa o inactiva

router.get("/me", async (req, res) => {
  const userId = req.user.id

  const { data, error } = await req.db.from("profiles").select("*").eq("id", userId).single()

  if (error || !data) {
    return res.status(404).json({ error: "Perfil no encontrado" })
  }

  let cajasActivas, admin
  try {
    ;[cajasActivas, admin] = await Promise.all([contarCajasActivas(userId), esAdminSistema(userId)])
  } catch (err) {
    return responderError(res, err)
  }

  return res.json({
    profile: data,
    estado_cuenta: {
      ...calcularEstadoCuenta({
        confirmada: Boolean(req.user.email_confirmed_at),
        bloqueo: null,
        cajasActivas,
      }),
      cajas_activas: cajasActivas,
    },
    es_admin_sistema: admin,
  })
})

// PUT /api/profiles/me
// El usuario actualiza su propio perfil

router.put("/me", async (req, res) => {
  const userId = req.user.id
  const { nombre, telefono, foto_url } = req.body

  const updates = {}
  if (nombre !== undefined) updates.nombre = nombre
  if (telefono !== undefined) updates.telefono = telefono
  if (foto_url !== undefined) updates.foto_url = foto_url

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No se enviaron campos para actualizar" })
  }

  const { data, error } = await req.db
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single()

  if (error || !data) {
    return res.status(500).json({ error: "Error al actualizar el perfil", detalle: error.message })
  }

  return res.json({ message: "Perfil actualizado correctamente", profile: data })
})

module.exports = router
