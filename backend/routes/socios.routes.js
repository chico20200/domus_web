// backend/routes/socios.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true }) // ← mergeParams para leer :cajaId
const supabaseAdmin = require("../config/supabaseAdmin")
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { fechaLocal } = require("../utils/fechas")

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios
// Lista todos los socios de la caja
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId } = req.params

  const { data, error } = await supabaseAdmin
    .from("socios")
    .select("*")
    .eq("caja_id", cajaId)
    .order("apellido", { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ socios: data })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios/:socioId
// Detalle de un socio
// ─────────────────────────────────────────────
router.get("/:socioId", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { data, error } = await supabaseAdmin
    .from("socios")
    .select("*")
    .eq("id", socioId)
    .eq("caja_id", cajaId)
    .single()

  if (error || !data) return res.status(404).json({ error: "Socio no encontrado" })

  return res.json({ socio: data })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/socios
// Registra un nuevo socio — tesorero o coordinador
// ─────────────────────────────────────────────
router.post("/", requierePermiso("socios.gestionar"), async (req, res) => {
  const { cajaId } = req.params

  const { nombre, apellido, cedula, telefono, email, direccion, fecha_ingreso } = req.body

  if (!nombre || !apellido || !cedula) {
    return res.status(400).json({ error: "Nombre, apellido y cédula son requeridos" })
  }

  // Verifica que la cédula no esté duplicada en la misma caja
  const { data: existente } = await supabaseAdmin
    .from("socios")
    .select("id")
    .eq("caja_id", cajaId)
    .eq("cedula", cedula)
    .single()

  if (existente) {
    return res.status(400).json({ error: "Ya existe un socio con esa cédula en esta caja" })
  }

  const { data, error } = await supabaseAdmin
    .from("socios")
    .insert({
      caja_id: cajaId,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      cedula: cedula.trim(),
      telefono: telefono?.trim() ?? "",
      email: email?.trim() ?? "",
      direccion: direccion?.trim() ?? "",
      fecha_ingreso: fecha_ingreso ?? fechaLocal(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ message: "Socio registrado correctamente", socio: data })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/socios/:socioId
// Actualiza datos del socio — tesorero o coordinador
// ─────────────────────────────────────────────
router.put("/:socioId", requierePermiso("socios.gestionar"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { nombre, apellido, cedula, telefono, email, direccion } = req.body
  const updates = {}

  if (nombre !== undefined) updates.nombre = nombre.trim()
  if (apellido !== undefined) updates.apellido = apellido.trim()
  if (cedula !== undefined) updates.cedula = cedula.trim()
  if (telefono !== undefined) updates.telefono = telefono.trim()
  if (email !== undefined) updates.email = email.trim()
  if (direccion !== undefined) updates.direccion = direccion.trim()
  updates.updated_at = new Date().toISOString()

  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: "No se enviaron campos para actualizar" })
  }

  const { data, error } = await supabaseAdmin
    .from("socios")
    .update(updates)
    .eq("id", socioId)
    .eq("caja_id", cajaId)
    .select()
    .single()

  if (error || !data)
    return res.status(500).json({ error: error?.message ?? "Error al actualizar" })

  return res.json({ message: "Socio actualizado correctamente", socio: data })
})

// ─────────────────────────────────────────────
// DELETE /api/cajas/:cajaId/socios/:socioId
// Desactiva un socio — solo coordinador
// ─────────────────────────────────────────────
router.delete("/:socioId", requierePermiso("socios.eliminar"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { error } = await supabaseAdmin
    .from("socios")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", socioId)
    .eq("caja_id", cajaId)

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ message: "Socio desactivado correctamente" })
})

module.exports = router
