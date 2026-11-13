// backend/routes/ahorros.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const supabaseAdmin = require("../config/supabaseAdmin")
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso, NIVEL } = require("../middlewares/permisos.middleware")
const { fichaDelUsuario } = require("../utils/fichas")
const { fechaLocal } = require("../utils/fechas")

router.use(verifyToken)

// ── Helper: genera número de cuenta único por caja ────────────
async function generarNumeroCuenta(cajaId) {
  const { count } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select("*", { count: "exact", head: true })
    .eq("caja_id", cajaId)
  const numero = String((count ?? 0) + 1).padStart(4, "0")
  return `CA-${numero}`
}

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/cuentas
// Lista todas las cuentas de la caja con datos del socio
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId } = req.params

  const { data, error } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select(
      `
      *,
      socios ( nombre, apellido, cedula )
    `,
    )
    .eq("caja_id", cajaId)
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ cuentas: data })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/cuentas/mias
// Las cuentas del usuario en esta caja ("Mis ahorros" del socio). La ficha se resuelve
// aquí: la vinculada a su cuenta o la que tiene su correo, que queda vinculada.
// ─────────────────────────────────────────────
router.get("/mias", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId } = req.params

  const ficha = await fichaDelUsuario(cajaId, req.user)
  if (!ficha) return res.json({ vinculado: false, cuentas: [] })

  const { data, error } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("socio_id", ficha.id)
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  return res.json({
    vinculado: true,
    socio: { id: ficha.id, nombre: ficha.nombre, apellido: ficha.apellido },
    cuentas: data ?? [],
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/cuentas/:cuentaId
// Detalle de una cuenta con sus transacciones. El tesorero y el coordinador ven
// cualquiera; el socio, solo las suyas.
// ─────────────────────────────────────────────
router.get("/:cuentaId", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId, cuentaId } = req.params

  const { data: cuenta, error } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select(`*, socios ( nombre, apellido, cedula, user_id )`)
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)
    .single()

  // Una cuenta ajena se responde igual que una que no existe
  const esSuya = cuenta?.socios?.user_id === req.user.id
  if (error || !cuenta || (!(NIVEL[req.rol] >= NIVEL.tesorero) && !esSuya)) {
    return res.status(404).json({ error: "Cuenta no encontrada" })
  }
  delete cuenta.socios.user_id

  const { data: transacciones } = await supabaseAdmin
    .from("transacciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })

  return res.json({ cuenta, transacciones: transacciones ?? [] })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios/:socioId/cuentas
// Cuentas de un socio específico
// ─────────────────────────────────────────────
router.get("/socio/:socioId", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { data, error } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("socio_id", socioId)
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ cuentas: data ?? [] })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/cuentas
// Abre una nueva cuenta de ahorro para un socio
// ─────────────────────────────────────────────
router.post("/", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId } = req.params

  const { socio_id } = req.body
  if (!socio_id) return res.status(400).json({ error: "El socio_id es requerido" })

  // Verifica que el socio pertenece a la caja
  const { data: socio } = await supabaseAdmin
    .from("socios")
    .select("id")
    .eq("id", socio_id)
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .single()

  if (!socio) return res.status(404).json({ error: "Socio no encontrado en esta caja" })

  const numero_cuenta = await generarNumeroCuenta(cajaId)

  const { data, error } = await supabaseAdmin
    .from("cuentas_ahorro")
    .insert({
      caja_id: cajaId,
      socio_id,
      numero_cuenta,
      saldo: 0.0,
      estado: "activa",
      fecha_apertura: fechaLocal(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ message: "Cuenta abierta correctamente", cuenta: data })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/cuentas/:cuentaId/deposito
// Registra un depósito
// ─────────────────────────────────────────────
router.post("/:cuentaId/deposito", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId, cuentaId } = req.params

  const { monto, descripcion } = req.body
  if (!monto || isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "El monto debe ser mayor a 0" })
  }

  // Lee el saldo actual
  const { data: cuenta } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select("saldo, estado")
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)
    .single()

  if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" })
  if (cuenta.estado !== "activa") return res.status(400).json({ error: "La cuenta no está activa" })

  const saldoAnterior = parseFloat(cuenta.saldo)
  const saldoPosterior = saldoAnterior + parseFloat(monto)

  // Actualiza el saldo
  await supabaseAdmin
    .from("cuentas_ahorro")
    .update({ saldo: saldoPosterior, updated_at: new Date().toISOString() })
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)

  // Registra la transacción
  const { data: tx, error } = await supabaseAdmin
    .from("transacciones")
    .insert({
      caja_id: cajaId,
      cuenta_id: cuentaId,
      tipo: "deposito",
      monto: parseFloat(monto),
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      descripcion: descripcion ?? "",
      registrado_por: req.user.id,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.json({
    message: "Depósito registrado correctamente",
    transaccion: tx,
    saldo_anterior: saldoAnterior,
    saldo_posterior: saldoPosterior,
  })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/cuentas/:cuentaId/retiro
// Registra un retiro
// ─────────────────────────────────────────────
router.post("/:cuentaId/retiro", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId, cuentaId } = req.params

  const { monto, descripcion } = req.body
  if (!monto || isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "El monto debe ser mayor a 0" })
  }

  const { data: cuenta } = await supabaseAdmin
    .from("cuentas_ahorro")
    .select("saldo, estado")
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)
    .single()

  if (!cuenta) return res.status(404).json({ error: "Cuenta no encontrada" })
  if (cuenta.estado !== "activa") return res.status(400).json({ error: "La cuenta no está activa" })

  const saldoAnterior = parseFloat(cuenta.saldo)

  // Valida que haya saldo suficiente
  if (parseFloat(monto) > saldoAnterior) {
    return res
      .status(400)
      .json({ error: `Saldo insuficiente. Saldo disponible: $${saldoAnterior.toFixed(2)}` })
  }

  const saldoPosterior = saldoAnterior - parseFloat(monto)

  await supabaseAdmin
    .from("cuentas_ahorro")
    .update({ saldo: saldoPosterior, updated_at: new Date().toISOString() })
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)

  const { data: tx, error } = await supabaseAdmin
    .from("transacciones")
    .insert({
      caja_id: cajaId,
      cuenta_id: cuentaId,
      tipo: "retiro",
      monto: parseFloat(monto),
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      descripcion: descripcion ?? "",
      registrado_por: req.user.id,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.json({
    message: "Retiro registrado correctamente",
    transaccion: tx,
    saldo_anterior: saldoAnterior,
    saldo_posterior: saldoPosterior,
  })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/cuentas/:cuentaId/estado
// Cambia estado de cuenta — solo coordinador
// ─────────────────────────────────────────────
router.put("/:cuentaId/estado", requierePermiso("cuentas.cambiar_estado"), async (req, res) => {
  const { cajaId, cuentaId } = req.params

  const { estado } = req.body
  const estadosValidos = ["activa", "cerrada", "suspendida"]
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" })
  }

  const { data, error } = await supabaseAdmin
    .from("cuentas_ahorro")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.json({ message: "Estado actualizado", cuenta: data })
})

module.exports = router
