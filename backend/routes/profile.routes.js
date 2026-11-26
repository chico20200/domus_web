// backend/routes/profile.routes.js
const express = require("express")
const { responderError } = require("../utils/errores")
const { leerFoto, subirFoto, quitarFoto, enlace } = require("../utils/fotos")
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

  // La foto se guarda como ruta en Storage (T17); se entrega un enlace firmado
  const { foto, ...perfil } = data
  perfil.foto_url = await enlace(req.db, "perfiles", foto)

  return res.json({
    profile: perfil,
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
  const { nombre, telefono } = req.body

  // La foto va por PUT /me/foto
  const updates = {}
  if (nombre !== undefined) updates.nombre = nombre
  if (telefono !== undefined) updates.telefono = telefono

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No se enviaron campos para actualizar" })
  }

  const { data, error } = await req.db
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id, nombre, telefono, foto")
    .single()

  // El nombre y el teléfono los valida la base (migración 005) y responde 400
  if (error) return responderError(res, error)

  const { foto, ...perfil } = data
  perfil.foto_url = await enlace(req.db, "perfiles", foto)
  return res.json({ message: "Perfil actualizado correctamente", profile: perfil })
})

// PUT /api/profiles/me/foto  (la imagen como cuerpo, hasta 2 MB) → { foto_url }
// DELETE /api/profiles/me/foto
// Foto de perfil (T17). La ven la cuenta y quienes comparten una caja con ella.
router.put("/me/foto", leerFoto, (req, res) =>
  subirFoto(req, res, {
    bucket: "perfiles",
    carpeta: req.user.id,
    rpc: "poner_foto_perfil",
    args: {},
    sinPermiso: "No se pudo guardar la foto de perfil",
  }),
)

router.delete("/me/foto", (req, res) =>
  quitarFoto(req, res, { bucket: "perfiles", rpc: "poner_foto_perfil", args: {} }),
)

module.exports = router
