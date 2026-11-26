// backend/routes/creditos.routes.js
const express = require("express")
const { responderError } = require("../utils/errores")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { fechaLocal, leerFecha } = require("../utils/fechas")
const { errorMonto, errorEntero } = require("../utils/validacion")
const { generarTablaAmortizacion, analizarEstadoCredito } = require("../utils/amortizacion")

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/creditos
// Lista créditos de la caja
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId } = req.params

  const { data, error } = await req.db
    .from("creditos")
    .select(`*, socios ( nombre, apellido, cedula )`)
    .eq("caja_id", cajaId)
    .order("created_at", { ascending: false })

  if (error) return responderError(res, error)

  return res.json({ creditos: data ?? [] })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/creditos/:creditoId
// Detalle de un crédito y sus pagos
// ─────────────────────────────────────────────
router.get("/:creditoId", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { data: credito, error } = await req.db
    .from("creditos")
    .select(`*, socios ( nombre, apellido, cedula )`)
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (error || !credito) return res.status(404).json({ error: "Crédito no encontrado" })

  const { data: pagos } = await req.db
    .from("pagos_credito")
    .select("*")
    .eq("credito_id", creditoId)
    .order("created_at", { ascending: false })

  return res.json({ credito, pagos: pagos ?? [] })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/creditos/socio/:socioId
// Créditos por socio
// ─────────────────────────────────────────────
router.get("/socio/:socioId", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params

  const { data, error } = await req.db
    .from("creditos")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("socio_id", socioId)
    .order("created_at", { ascending: false })

  if (error) return responderError(res, error)

  return res.json({ creditos: data ?? [] })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/creditos
// Crear solicitud de crédito (estado: 'pendiente')
// ─────────────────────────────────────────────
router.post("/", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId } = req.params

  const { socio_id, monto_solicitado, tasa_interes, plazo_meses } = req.body
  if (!socio_id) return res.status(400).json({ error: "Elige el socio" })
  // Los límites (tasa hasta 100 %, plazo hasta 120 meses) los revisa también la base (005)
  const problema =
    errorMonto(monto_solicitado) ||
    errorMonto(tasa_interes, "La tasa") ||
    (Number(tasa_interes) > 100 ? "La tasa anual va de 0,01 % a 100 %" : "") ||
    errorEntero(plazo_meses, 1, 120, "El plazo es un número entero de 1 a 120 meses")
  if (problema) return res.status(400).json({ error: problema })

  // Valida que el socio pertenezca a la caja
  const { data: socio } = await req.db
    .from("socios")
    .select("id")
    .eq("id", socio_id)
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .single()

  if (!socio) return res.status(404).json({ error: "Socio no encontrado en esta caja" })

  // El total, la cuota y el saldo los calcula la base con interés simple (migración 005),
  // y la solicitud nace pendiente
  const { data, error } = await req.db
    .from("creditos")
    .insert({
      caja_id: cajaId,
      socio_id,
      monto_solicitado: Number(monto_solicitado),
      tasa_interes: Number(tasa_interes),
      plazo_meses: Number(plazo_meses),
    })
    .select()
    .single()

  if (error) return responderError(res, error)

  return res.status(201).json({ message: "Solicitud registrada", credito: data })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/creditos/:creditoId/aprobar
// Aprueba el crédito: establece fechas y pone estado 'activo'
// ─────────────────────────────────────────────
router.put("/:creditoId/aprobar", requierePermiso("creditos.aprobar"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { fecha_desembolso } = req.body
  const fecha = fecha_desembolso ? leerFecha(fecha_desembolso) : new Date()

  // Lee el crédito
  const { data: credito } = await req.db
    .from("creditos")
    .select("*")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" })
  if (credito.estado !== "pendiente")
    return res.status(400).json({ error: "Sólo se pueden aprobar solicitudes pendientes" })

  const fecha_vencimiento = new Date(fecha)
  fecha_vencimiento.setMonth(fecha_vencimiento.getMonth() + parseInt(credito.plazo_meses, 10))

  const { data: dataUpd, error: errorUpd } = await req.db
    .from("creditos")
    .update({
      estado: "activo",
      fecha_desembolso: fechaLocal(fecha),
      fecha_vencimiento: fechaLocal(fecha_vencimiento),
      aprobado_por: req.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .select()
    .single()

  if (errorUpd) return responderError(res, errorUpd)

  return res.json({ message: "Crédito aprobado", credito: dataUpd })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/creditos/:creditoId/estado
// Cambia el estado del crédito (coordinador)
// ─────────────────────────────────────────────
router.put("/:creditoId/estado", requierePermiso("creditos.cambiar_estado"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { estado } = req.body
  // Aprobar va por /aprobar y "pagado" lo pone el último pago; aquí solo se marca o se
  // quita el vencimiento. La base rechaza cualquier otro cambio (migración 005).
  const estadosValidos = ["activo", "vencido"]
  if (!estadosValidos.includes(estado)) return res.status(400).json({ error: "Estado inválido" })

  const { data, error } = await req.db
    .from("creditos")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .select()
    .single()

  if (error) return responderError(res, error)

  return res.json({ message: "Estado actualizado", credito: data })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/creditos/:creditoId/amortizacion
// Tabla de amortización con estado de cada cuota
// ─────────────────────────────────────────────
router.get("/:creditoId/amortizacion", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { data: credito, error } = await req.db
    .from("creditos")
    .select("*, socios ( nombre, apellido, cedula )")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (error || !credito) return res.status(404).json({ error: "Crédito no encontrado" })

  const { data: pagos } = await req.db.from("pagos_credito").select("*").eq("credito_id", creditoId)

  const { filas, interesCondonadoTotal, totalAbonos } = analizarEstadoCredito(credito, pagos)

  const base = generarTablaAmortizacion(
    parseFloat(credito.monto_solicitado),
    parseFloat(credito.tasa_interes),
    credito.plazo_meses,
    credito.fecha_desembolso,
  )

  return res.json({
    credito: {
      id: credito.id,
      socio: credito.socios,
      monto_solicitado: parseFloat(credito.monto_solicitado),
      tasa_interes: parseFloat(credito.tasa_interes),
      plazo_meses: credito.plazo_meses,
      monto_total: base.monto_total,
      interes_total: base.interes_total,
      estado: credito.estado,
      saldo_pendiente: parseFloat(credito.saldo_pendiente),
      fecha_desembolso: credito.fecha_desembolso,
    },
    tabla: filas,
    resumen: {
      capital_pagado: +filas.reduce((s, f) => s + f.capital_pagado, 0).toFixed(2),
      interes_pagado: +filas.reduce((s, f) => s + f.interes_pagado, 0).toFixed(2),
      interes_condonado: interesCondonadoTotal,
      cuotas_pagadas: filas.filter((f) => f.pagada).length,
      cuotas_vencidas: filas.filter((f) => f.vencida).length,
      cuotas_totales: credito.plazo_meses,
      total_abonos: totalAbonos,
    },
  })
})

module.exports = router
