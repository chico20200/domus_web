// backend/routes/pagos.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { fechaLocal } = require("../utils/fechas")
const { generarTablaAmortizacion, analizarEstadoCredito } = require("../utils/amortizacion")
const { responderError } = require("../utils/errores")
const { errorMonto } = require("../utils/validacion")

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

  // 2. Genera la tabla teórica
  const { tabla } = generarTablaAmortizacion(
    parseFloat(credito.monto_solicitado),
    parseFloat(credito.tasa_interes),
    credito.plazo_meses,
  )

  // 3. Lee TODOS los pagos ya hechos
  const { data: pagosPrevios } = await req.db
    .from("pagos_credito")
    .select("numero_cuota, monto_capital, monto_interes")
    .eq("credito_id", creditoId)

  // 4. Suma lo pagado por cada cuota
  const pagadoPorCuota = {}
  ;(pagosPrevios ?? []).forEach((p) => {
    const n = p.numero_cuota
    if (!pagadoPorCuota[n]) pagadoPorCuota[n] = { capital: 0, interes: 0 }
    pagadoPorCuota[n].capital += parseFloat(p.monto_capital)
    pagadoPorCuota[n].interes += parseFloat(p.monto_interes)
  })

  // 5. Encuentra la primera cuota que aún debe capital o interés
  let numeroCuota = null
  let faltaCapital = 0
  let faltaInteres = 0

  for (const fila of tabla) {
    const pagado = pagadoPorCuota[fila.numero_cuota] ?? { capital: 0, interes: 0 }
    const pendienteCapital = +(fila.capital - pagado.capital).toFixed(2)
    const pendienteInteres = +(fila.interes - pagado.interes).toFixed(2)

    // Si esta cuota todavía debe algo, es la que toca pagar
    if (pendienteCapital > 0.001 || pendienteInteres > 0.001) {
      numeroCuota = fila.numero_cuota
      faltaCapital = pendienteCapital > 0 ? pendienteCapital : 0
      faltaInteres = pendienteInteres > 0 ? pendienteInteres : 0
      break
    }
  }

  if (!numeroCuota) {
    return res.status(400).json({ error: "Todas las cuotas ya están pagadas" })
  }

  // 6. Determina cuánto se paga según el tipo — solo lo que falta
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

  // 7. Saldo del crédito tal como se vio al calcular la cuota
  const saldoAntes = parseFloat(credito.saldo_pendiente)

  // 8. Registra el pago y el saldo del crédito juntos (registrar_pago_credito, migración
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
// Devuelve exactamente cuánto falta pagar de la cuota actual
// ─────────────────────────────────────────────
router.get("/proxima-cuota", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { data: credito } = await req.db
    .from("creditos")
    .select("*")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" })
  if (credito.estado === "pagado") {
    return res.json({ pendiente: false, mensaje: "Crédito pagado por completo" })
  }

  const { data: pagos } = await req.db.from("pagos_credito").select("*").eq("credito_id", creditoId)

  const { cuotaCorriente, vencidas, prepagable } = analizarEstadoCredito(credito, pagos)

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

    // Prepago disponible (última cuota sin tocar). Con cuotas vencidas no se ofrece:
    // POST /prepago lo rechaza hasta ponerse al día (T8)
    prepago_disponible:
      prepagable && vencidas.length === 0
        ? {
            numero_cuota: prepagable.numero_cuota,
            capital: prepagable.capital,
            interes_a_condonar: prepagable.interes,
          }
        : null,
  })
})

// POST /api/cajas/:cajaId/creditos/:creditoId/pagos/prepago
// Prepaga el capital de la última cuota disponible — sin interés
router.post("/prepago", requierePermiso("movimientos.registrar"), async (req, res) => {
  const { cajaId, creditoId } = req.params

  const { data: credito } = await req.db
    .from("creditos")
    .select("*")
    .eq("id", creditoId)
    .eq("caja_id", cajaId)
    .single()

  if (!credito) return res.status(404).json({ error: "Crédito no encontrado" })
  if (credito.estado !== "activo") {
    return res.status(400).json({ error: "Solo se puede prepagar un crédito activo" })
  }

  const { data: pagos } = await req.db.from("pagos_credito").select("*").eq("credito_id", creditoId)

  const { prepagable, vencidas } = analizarEstadoCredito(credito, pagos)

  // Adelantar cuotas futuras con una atrasada dejaría la atrasada sin cobrar y le
  // condonaría interés a quien está en mora
  if (vencidas.length > 0) {
    return res.status(400).json({
      error: `Hay ${vencidas.length === 1 ? "una cuota vencida" : `${vencidas.length} cuotas vencidas`}. Primero se paga lo atrasado; después se puede prepagar.`,
    })
  }

  if (!prepagable) {
    return res.status(400).json({
      error:
        "No hay cuotas disponibles para prepagar. Solo se prepagan cuotas futuras, no la corriente.",
    })
  }

  const montoCapital = prepagable.capital
  const interesCondonado = prepagable.interes

  const saldoAntes = parseFloat(credito.saldo_pendiente)

  // El pago, el saldo y el interés condonado se escriben juntos (migración 004)
  const { data: registro, error } = await req.db.rpc("registrar_pago_credito", {
    p_caja: cajaId,
    p_credito: creditoId,
    p_saldo_esperado: saldoAntes,
    p_numero_cuota: prepagable.numero_cuota,
    p_capital: montoCapital,
    p_interes: 0, // el prepago no paga interés
    p_tipo: "prepago",
    p_interes_condonado: interesCondonado,
    p_fecha: fechaLocal(),
  })
  if (error) return responderError(res, error)
  const { pago } = registro

  return res.status(201).json({
    message: `Prepago de la cuota ${prepagable.numero_cuota} registrado`,
    pago,
    cuota_prepagada: prepagable.numero_cuota,
    capital_pagado: montoCapital,
    interes_condonado: interesCondonado,
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

module.exports = router
