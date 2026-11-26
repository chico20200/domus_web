// backend/routes/socios.routes.js
const express = require("express")
const { responderError } = require("../utils/errores")
const router = express.Router({ mergeParams: true }) // ← mergeParams para leer :cajaId
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { fechaLocal } = require("../utils/fechas")
const { soloDigitos } = require("../utils/validacion")

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios
// Lista todos los socios de la caja
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId } = req.params

  const { data, error } = await req.db
    .from("socios")
    .select("*")
    .eq("caja_id", cajaId)
    .order("apellido", { ascending: true })

  if (error) return responderError(res, error)

  return res.json({ socios: data })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios/:socioId
// Detalle de un socio
// ─────────────────────────────────────────────
router.get("/:socioId", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { data, error } = await req.db
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

  // Verifica que la cédula no esté duplicada en la misma caja. La base la guarda solo con
  // dígitos, así que se compara igual. La cédula, el teléfono y el correo los valida la
  // base (migración 005) y responde 400 con el mensaje.
  const { data: existente } = await req.db
    .from("socios")
    .select("id")
    .eq("caja_id", cajaId)
    .eq("cedula", soloDigitos(cedula))
    .maybeSingle()

  if (existente) {
    return res.status(400).json({ error: "Ya existe un socio con esa cédula en esta caja" })
  }

  const { data, error } = await req.db
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

  if (error) return responderError(res, error)

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

  const { data, error } = await req.db
    .from("socios")
    .update(updates)
    .eq("id", socioId)
    .eq("caja_id", cajaId)
    .select()
    .single()

  if (error) return responderError(res, error)

  return res.json({ message: "Socio actualizado correctamente", socio: data })
})

// ─────────────────────────────────────────────
// DELETE /api/cajas/:cajaId/socios/:socioId
// Desactiva un socio — solo coordinador
// ─────────────────────────────────────────────
router.delete("/:socioId", requierePermiso("socios.eliminar"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { error } = await req.db
    .from("socios")
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq("id", socioId)
    .eq("caja_id", cajaId)

  if (error) return responderError(res, error)

  return res.json({ message: "Socio desactivado correctamente" })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios/:socioId/correcciones-ingreso
// Correcciones de la fecha de ingreso de un socio, la más reciente primero (T14)
// ─────────────────────────────────────────────
router.get("/:socioId/correcciones-ingreso", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { data, error } = await req.db
    .from("correcciones_fecha_ingreso")
    .select("id, fecha_anterior, fecha_nueva, motivo, corregido_por, creado_en")
    .eq("caja_id", cajaId)
    .eq("socio_id", socioId)
    .order("creado_en", { ascending: false })

  if (error) return responderError(res, error)

  // Quién corrigió, por nombre: los perfiles de los miembros de la caja se pueden leer
  const ids = [...new Set((data ?? []).map((c) => c.corregido_por))]
  let nombres = {}
  if (ids.length > 0) {
    const { data: perfiles } = await req.db.from("profiles").select("id, nombre").in("id", ids)
    nombres = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p.nombre]))
  }

  return res.json({
    correcciones: (data ?? []).map(({ corregido_por, ...c }) => ({
      ...c,
      corregido_por_nombre: nombres[corregido_por] ?? null,
    })),
  })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/socios/:socioId/correcciones-ingreso  { fecha_ingreso, motivo }
// Corrige la fecha de ingreso — solo coordinador. La base revisa el motivo, que no sea
// futura y que ni la fecha anterior ni la nueva caigan en un ciclo cerrado, y deja el
// registro de la corrección (corregir_fecha_ingreso, migración 009).
// ─────────────────────────────────────────────
router.post(
  "/:socioId/correcciones-ingreso",
  requierePermiso("socios.corregir_ingreso"),
  async (req, res) => {
    const { cajaId, socioId } = req.params
    const { fecha_ingreso, motivo } = req.body ?? {}

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_ingreso ?? ""))) {
      return res.status(400).json({ error: "Indica la fecha de ingreso (AAAA-MM-DD)" })
    }

    // La ficha tiene que ser de esta caja
    const { data: socio } = await req.db
      .from("socios")
      .select("id")
      .eq("id", socioId)
      .eq("caja_id", cajaId)
      .maybeSingle()
    if (!socio) return res.status(404).json({ error: "Socio no encontrado" })

    const { data, error } = await req.db.rpc("corregir_fecha_ingreso", {
      p_socio: socioId,
      p_fecha: fecha_ingreso,
      p_motivo: motivo ?? "",
    })
    if (error) return responderError(res, error)

    return res.status(201).json({ message: "Fecha de ingreso corregida", ...data })
  },
)

module.exports = router
