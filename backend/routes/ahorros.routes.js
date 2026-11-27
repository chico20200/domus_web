// backend/routes/ahorros.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso, NIVEL } = require("../middlewares/permisos.middleware")
const { fichaDelUsuario } = require("../utils/fichas")
const { fechaLocal } = require("../utils/fechas")
const { responderError } = require("../utils/errores")
const { leerImagen, subirYAdjuntar, enviarEnlace } = require("../utils/comprobantes")

router.use(verifyToken)

// ── Helper: genera número de cuenta único por caja ────────────
async function generarNumeroCuenta(db, cajaId) {
  const { count } = await db
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

  const { data, error } = await req.db
    .from("cuentas_ahorro")
    .select(
      `
      *,
      socios ( nombre, apellido, cedula )
    `,
    )
    .eq("caja_id", cajaId)
    .order("created_at", { ascending: false })

  if (error) return responderError(res, error)

  return res.json({ cuentas: data })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/cuentas/mias
// Las cuentas del usuario en esta caja ("Mis ahorros" del socio). La ficha se resuelve
// aquí: la vinculada a su cuenta o la que tiene su correo, que queda vinculada.
// ─────────────────────────────────────────────
router.get("/mias", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId } = req.params

  let ficha
  try {
    ficha = await fichaDelUsuario(req.db, cajaId)
  } catch (err) {
    return responderError(res, err)
  }
  if (!ficha) return res.json({ vinculado: false, cuentas: [] })

  const { data, error } = await req.db
    .from("cuentas_ahorro")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("socio_id", ficha.id)
    .order("created_at", { ascending: false })

  if (error) return responderError(res, error)

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

  const { data: cuenta, error } = await req.db
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

  const { data: transacciones } = await req.db
    .from("transacciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })

  return res.json({ cuenta, transacciones: transacciones ?? [] })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios/:socioId/cuentas
// Cuentas de un socio específico
// ─────────────────────────────────────────────
router.get("/socio/:socioId", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { data, error } = await req.db
    .from("cuentas_ahorro")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("socio_id", socioId)
    .order("created_at", { ascending: false })

  if (error) return responderError(res, error)

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
  const { data: socio } = await req.db
    .from("socios")
    .select("id")
    .eq("id", socio_id)
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .single()

  if (!socio) return res.status(404).json({ error: "Socio no encontrado en esta caja" })

  const numero_cuenta = await generarNumeroCuenta(req.db, cajaId)

  const { data, error } = await req.db
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

  if (error) return responderError(res, error)

  return res.status(201).json({ message: "Cuenta abierta correctamente", cuenta: data })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/cuentas/:cuentaId/deposito
// POST /api/cajas/:cajaId/cuentas/:cuentaId/retiro
// Registra un depósito o un retiro. Lo hace registrar_movimiento (migración 004): bloquea
// la cuenta, comprueba el saldo y escribe el movimiento y el saldo nuevo juntos, así dos
// operaciones a la vez no se pisan y un fallo no deja el saldo sin su movimiento.
// ─────────────────────────────────────────────
function registrarMovimiento(tipo) {
  const exito =
    tipo === "deposito" ? "Depósito registrado correctamente" : "Retiro registrado correctamente"
  return async (req, res) => {
    const { cajaId, cuentaId } = req.params
    const { monto, descripcion } = req.body

    const montoNum = Number(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0" })
    }

    const { data, error } = await req.db.rpc("registrar_movimiento", {
      p_caja: cajaId,
      p_cuenta: cuentaId,
      p_tipo: tipo,
      p_monto: montoNum,
      p_descripcion: typeof descripcion === "string" ? descripcion.trim() : "",
    })
    if (error) return responderError(res, error)

    return res.json({
      message: exito,
      transaccion: data.transaccion,
      saldo_anterior: Number(data.saldo_anterior),
      saldo_posterior: Number(data.saldo_posterior),
    })
  }
}

router.post(
  "/:cuentaId/deposito",
  requierePermiso("movimientos.registrar"),
  registrarMovimiento("deposito"),
)
router.post(
  "/:cuentaId/retiro",
  requierePermiso("movimientos.registrar"),
  registrarMovimiento("retiro"),
)

// ─────────────────────────────────────────────
// Comprobante de un depósito o retiro (T16). La foto va en el cuerpo, como imagen.
// POST: el tesorero la agrega al registrar el movimiento o después; una sola vez.
// GET: enlace firmado para verla. El socio ve los de su propia cuenta (lo decide la
// política del bucket); a los demás la base no les muestra el movimiento.
// ─────────────────────────────────────────────
async function leerMovimiento(req) {
  const { cajaId, cuentaId, movimientoId } = req.params
  const { data } = await req.db
    .from("transacciones")
    .select("id, comprobante, cuentas_ahorro!inner ( socio_id )")
    .eq("id", movimientoId)
    .eq("cuenta_id", cuentaId)
    .eq("caja_id", cajaId)
    .maybeSingle()
  return data
}

router.post(
  "/:cuentaId/movimientos/:movimientoId/comprobante",
  requierePermiso("movimientos.registrar"),
  leerImagen,
  async (req, res) => {
    const mov = await leerMovimiento(req)
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" })
    if (mov.comprobante)
      return res.status(409).json({ error: "Este movimiento ya tiene su comprobante" })
    return subirYAdjuntar(req, res, {
      tipo: "movimiento",
      id: mov.id,
      cajaId: req.params.cajaId,
      socioId: mov.cuentas_ahorro.socio_id,
    })
  },
)

router.get(
  "/:cuentaId/movimientos/:movimientoId/comprobante",
  requierePermiso("caja.ver"),
  async (req, res) => {
    const mov = await leerMovimiento(req)
    if (!mov) return res.status(404).json({ error: "Movimiento no encontrado" })
    return enviarEnlace(req, res, mov.comprobante)
  },
)

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

  const { data, error } = await req.db
    .from("cuentas_ahorro")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", cuentaId)
    .eq("caja_id", cajaId)
    .select()
    .single()

  if (error) return responderError(res, error)

  return res.json({ message: "Estado actualizado", cuenta: data })
})

module.exports = router
