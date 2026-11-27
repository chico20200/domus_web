// backend/routes/pagos.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { fechaLocal } = require("../utils/fechas")
const { analizarEstadoCredito, planAdelanto } = require("../utils/amortizacion")
const { responderError } = require("../utils/errores")
const { errorMonto } = require("../utils/validacion")
const { leerImagen, subirYAdjuntar, enviarEnlace } = require("../utils/comprobantes")
const { puedeVerDelSocio } = require("../utils/fichas")

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/creditos/:creditoId/pagos
// Lista los pagos de un crédito
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { data, error } = await req.db
    .from("pagos_credito")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("credito_id", creditoId)
    .order("numero_cuota", { ascending: true })

  if (error) return responderError(res, error)

  return res.json({ pagos: data ?? [] })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/creditos/:creditoId/pagos
// Registra un pago de cuota separando capital e interés
// ─────────────────────────────────────────────
router.post("/", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { tipo_pago } = req.body

  // 1. Lee el crédito
  const { data: credito } = await req.db
    .from("creditos")
    .select("*")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" })
  if (credito.estado === "pagado") {
    return res.status(400).json({ error: "Este crédito ya está pagado" })
  }
  if (!["activo", "vencido"].includes(credito.estado)) {
    return res.status(400).json({ error: "Solo se registran pagos de créditos activos" })
  }

  // 2. Lee todos los pagos ya hechos y busca la primera cuota que debe algo, con la misma
  // regla que el detalle del crédito (adelantos y cuotas importadas incluidas)
  const { data: pagosPrevios } = await req.db
    .from("pagos_credito")
    .select("*")
    .eq("credito_id", creditoId)
  const { cuotaCorriente } = analizarEstadoCredito(credito, pagosPrevios ?? [])
  const numeroCuota = cuotaCorriente?.numero_cuota ?? null
  const faltaCapital = cuotaCorriente?.falta_capital ?? 0
  const faltaInteres = cuotaCorriente?.falta_interes ?? 0

  if (!numeroCuota) {
    return res.status(400).json({ error: "Todas las cuotas ya están pagadas" })
  }

  // 3. Determina cuánto se paga según el tipo — solo lo que falta
  let montoCapital = 0
  let montoInteres = 0

  if (tipo_pago === "solo_capital") {
    if (faltaCapital <= 0) {
      return res.status(400).json({ error: `El capital de la cuota ${numeroCuota} ya está pagado` })
    }
    montoCapital = faltaCapital
  } else if (tipo_pago === "solo_interes") {
    if (faltaInteres <= 0) {
      return res.status(400).json({ error: `El interés de la cuota ${numeroCuota} ya está pagado` })
    }
    montoInteres = faltaInteres
  } else {
    // completo: paga lo que falte de ambos
    montoCapital = faltaCapital
    montoInteres = faltaInteres
  }

  const montoPagado = +(montoCapital + montoInteres).toFixed(2)

  if (montoPagado <= 0) {
    return res.status(400).json({ error: "No hay nada pendiente por pagar en esta cuota" })
  }

  // 4. Saldo del crédito tal como se vio al calcular la cuota
  const saldoAntes = parseFloat(credito.saldo_pendiente)

  // 5. Registra el pago y el saldo del crédito juntos (registrar_pago_credito, migración
  // 004). Si otro pago cambió el saldo desde que se calculó la cuota, la base lo rechaza.
  const { data: registro, error } = await req.db.rpc("registrar_pago_credito", {
    p_caja: cajaId,
    p_credito: creditoId,
    p_saldo_esperado: saldoAntes,
    p_numero_cuota: numeroCuota,
    p_capital: montoCapital,
    p_interes: montoInteres,
    p_tipo: "cuota",
    p_fecha: fechaLocal(),
  })
  if (error) return responderError(res, error)
  const { pago } = registro

  return res.status(201).json({
    message: "Pago registrado correctamente",
    pago,
    desglose: {
      cuota: numeroCuota,
      capital: montoCapital,
      interes: montoInteres,
      total: montoPagado,
    },
    saldo_pendiente: Number(registro.saldo_pendiente),
    credito_pagado: registro.credito_pagado,
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/creditos/:creditoId/pagos/proxima-cuota
// Devuelve exactamente cuánto falta pagar de la cuota actual. El socio la ve en sus
// propios créditos (T27), sin poder pagar
// ─────────────────────────────────────────────
router.get("/proxima-cuota", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { data: credito } = await req.db
    .from("creditos")
    .select("*, socios ( user_id )")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .maybeSingle()

  if (!credito || !puedeVerDelSocio(req, credito.socios?.user_id)) {
    return res.status(404).json({ error: "Crédito no encontrado" })
  }
  if (credito.estado === "pagado") {
    return res.json({ pendiente: false, mensaje: "Crédito pagado por completo" })
  }

  const { data: pagos } = await req.db.from("pagos_credito").select("*").eq("credito_id", creditoId)

  const { cuotaCorriente, vencidas, adelanto } = analizarEstadoCredito(credito, pagos)

  if (!cuotaCorriente) {
    return res.json({ pendiente: false, mensaje: "No hay cuotas pendientes" })
  }

  return res.json({
    pendiente: true,
    numero_cuota: cuotaCorriente.numero_cuota,
    total_cuotas: credito.plazo_meses,
    es_ultima: cuotaCorriente.numero_cuota === credito.plazo_meses,
    fecha_vencimiento: cuotaCorriente.fecha_vencimiento,
    vencida: cuotaCorriente.vencida,
    falta_capital: cuotaCorriente.falta_capital,
    falta_interes: cuotaCorriente.falta_interes,
    falta_total: +(cuotaCorriente.falta_capital + cuotaCorriente.falta_interes).toFixed(2),

    // Cuotas atrasadas
    cuotas_vencidas: vencidas.map((v) => ({
      numero_cuota: v.numero_cuota,
      fecha_vencimiento: v.fecha_vencimiento,
      falta_total: +(v.falta_capital + v.falta_interes).toFixed(2),
    })),

    // Pago adelantado (T30): hasta cuánto se puede adelantar y a qué cuotas, o por qué no
    adelanto: datosAdelanto(credito, adelanto),
  })
})

/** Lo que proxima-cuota dice del pago adelantado */
function datosAdelanto(credito, adelanto) {
  // Un crédito marcado vencido en la base tampoco adelanta, aunque ya esté al día
  if (credito.estado !== "activo") {
    return {
      disponible: false,
      motivo: "Solo se puede hacer un pago adelantado en un crédito activo y al día.",
    }
  }
  if (adelanto.bloqueo) return { disponible: false, motivo: adelanto.bloqueo }
  return { disponible: true, maximo: adelanto.maximo, cuotas: adelanto.cuotas }
}

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/creditos/:creditoId/pagos/prepago   { monto }
// Pago adelantado por monto (T30): el capital se aplica desde la última cuota hacia
// atrás. Las cuotas cubiertas enteras condonan su interés; la que queda a medias lo
// conserva. Todo se registra junto (registrar_pago_adelantado, migración 013).
// ─────────────────────────────────────────────
router.post("/prepago", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const problemaMonto = errorMonto(req.body?.monto)
  if (problemaMonto) return res.status(400).json({ error: problemaMonto })
  const monto = Number(req.body.monto)

  const { data: credito } = await req.db
    .from("creditos")
    .select("*")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()
  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" })

  const { data: pagos } = await req.db.from("pagos_credito").select("*").eq("credito_id", creditoId)
  const adelanto = datosAdelanto(credito, analizarEstadoCredito(credito, pagos).adelanto)
  if (!adelanto.disponible) return res.status(400).json({ error: adelanto.motivo })

  const partes = planAdelanto(adelanto.cuotas, monto)
  if (!partes) {
    return res.status(400).json({
      error: `Se pueden adelantar hasta $${adelanto.maximo.toFixed(2)} de capital.`,
    })
  }

  const { data: registro, error } = await req.db.rpc("registrar_pago_adelantado", {
    p_caja: cajaId,
    p_credito: creditoId,
    p_saldo_esperado: parseFloat(credito.saldo_pendiente),
    p_partes: partes,
    p_fecha: fechaLocal(),
  })
  if (error) return responderError(res, error)

  const enteras = partes.filter((p) => p.interes_condonado > 0).map((p) => p.numero_cuota)
  const aMedias = partes.find((p) => p.interes_condonado === 0) ?? null

  return res.status(201).json({
    message: "Pago adelantado registrado",
    pagos: registro.pagos,
    capital_pagado: Number(registro.capital_pagado),
    interes_condonado: Number(registro.interes_condonado),
    cuotas_adelantadas: enteras,
    cuota_a_medias: aMedias
      ? { numero_cuota: aMedias.numero_cuota, capital: aMedias.capital }
      : null,
    saldo_pendiente: Number(registro.saldo_pendiente),
    credito_pagado: registro.credito_pagado,
  })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/creditos/:creditoId/pagos/abono
// Abono parcial de monto libre — se aplica primero a capital
// ─────────────────────────────────────────────
router.post("/abono", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { monto, motivo } = req.body

  const problemaMonto = errorMonto(monto)
  if (problemaMonto) return res.status(400).json({ error: problemaMonto })
  const montoNum = Number(monto)
  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: "El motivo del abono es requerido" })
  }

  // 1. Lee el crédito
  const { data: credito } = await req.db
    .from("creditos")
    .select("*")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" })
  // Un crédito vencido también recibe abonos: es justamente el que necesita ponerse al día
  if (!["activo", "vencido"].includes(credito.estado)) {
    return res.status(400).json({ error: "Solo se puede abonar a un crédito activo" })
  }

  // 2. Analiza el estado real
  const { data: pagosPrevios } = await req.db
    .from("pagos_credito")
    .select("*")
    .eq("credito_id", creditoId)

  const { cuotaCorriente } = analizarEstadoCredito(credito, pagosPrevios)

  if (!cuotaCorriente) {
    return res.status(400).json({ error: "No hay cuotas pendientes" })
  }

  // 3. Aplica el abono: PRIMERO a capital, el sobrante a interés
  const faltaCapital = cuotaCorriente.falta_capital
  const faltaInteres = cuotaCorriente.falta_interes
  const totalPendienteCuota = +(faltaCapital + faltaInteres).toFixed(2)

  // No permite abonar más de lo que falta en esta cuota
  if (montoNum > totalPendienteCuota + 0.001) {
    return res.status(400).json({
      error: `El abono excede lo pendiente de la cuota ${cuotaCorriente.numero_cuota} ($${totalPendienteCuota.toFixed(2)}). Usa el pago completo de cuota.`,
    })
  }

  // Si alcanza solo para capital, todo va a capital; si sobra, el resto va a interés
  const cubreCapital = montoNum > faltaCapital
  const montoCapital = cubreCapital ? faltaCapital : +montoNum.toFixed(2)
  const montoInteres = cubreCapital ? +(montoNum - faltaCapital).toFixed(2) : 0

  const montoPagado = +(montoCapital + montoInteres).toFixed(2)

  // 4. Saldo tal como se vio al calcular el abono
  const saldoAntes = parseFloat(credito.saldo_pendiente)

  // 5. Registra el abono y el saldo del crédito juntos (migración 004)
  const { data: registro, error } = await req.db.rpc("registrar_pago_credito", {
    p_caja: cajaId,
    p_credito: creditoId,
    p_saldo_esperado: saldoAntes,
    p_numero_cuota: cuotaCorriente.numero_cuota,
    p_capital: montoCapital,
    p_interes: montoInteres,
    p_tipo: "abono",
    p_motivo: motivo.trim(),
    p_fecha: fechaLocal(),
  })
  if (error) return responderError(res, error)
  const { pago } = registro

  // Cuánto queda pendiente de esa cuota tras el abono
  const restaCapital = +(faltaCapital - montoCapital).toFixed(2)
  const restaInteres = +(faltaInteres - montoInteres).toFixed(2)

  return res.status(201).json({
    message: "Abono registrado correctamente",
    pago,
    aplicado: {
      cuota: cuotaCorriente.numero_cuota,
      capital: montoCapital,
      interes: montoInteres,
      total: montoPagado,
    },
    resta_en_cuota: {
      capital: restaCapital > 0 ? restaCapital : 0,
      interes: restaInteres > 0 ? restaInteres : 0,
      total: +(
        (restaCapital > 0 ? restaCapital : 0) + (restaInteres > 0 ? restaInteres : 0)
      ).toFixed(2),
    },
    saldo_pendiente: Number(registro.saldo_pendiente),
    credito_pagado: registro.credito_pagado,
  })
})

// ─────────────────────────────────────────────
// Comprobante de un pago (T16): cuota, prepago o abono. Igual que en los movimientos.
// POST /api/cajas/:cajaId/creditos/:creditoId/pagos/:pagoId/comprobante  (imagen)
// GET  …/comprobante  → { url } firmada y corta
// ─────────────────────────────────────────────
async function leerPago(req) {
  const { cajaId, creditoId, pagoId } = req.params
  const { data } = await req.db
    .from("pagos_credito")
    .select("id, comprobante, creditos!inner ( socio_id )")
    .eq("id", pagoId)
    .eq("credito_id", creditoId)
    .eq("caja_id", cajaId)
    .maybeSingle()
  return data
}

router.post(
  "/:pagoId/comprobante",
  requierePermiso("movimientos.registrar"),
  leerImagen,
  async (req, res) => {
    const pago = await leerPago(req)
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" })
    if (pago.comprobante)
      return res.status(409).json({ error: "Este pago ya tiene su comprobante" })
    return subirYAdjuntar(req, res, {
      tipo: "pago",
      id: pago.id,
      cajaId: req.params.cajaId,
      socioId: pago.creditos.socio_id,
    })
  },
)

router.get("/:pagoId/comprobante", requierePermiso("caja.ver"), async (req, res) => {
  const pago = await leerPago(req)
  if (!pago) return res.status(404).json({ error: "Pago no encontrado" })
  return enviarEnlace(req, res, pago.comprobante)
})

module.exports = router
