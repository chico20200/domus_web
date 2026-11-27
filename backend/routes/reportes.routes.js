// backend/routes/reportes.routes.js
const express = require("express")
const { responderError } = require("../utils/errores")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { faltaPorCobrar } = require("../utils/reportes")
const { distribucionDelCiclo } = require("../utils/repartoCiclo")
const { fechaLocal } = require("../utils/fechas")
const { calcularCiclos } = require("../utils/ciclos")
const { EN_CURSO, agregarMora } = require("../utils/mora")

router.use(verifyToken)

/**
 * La caja, sus ciclos y el ciclo pedido (o el actual). Responde el error y devuelve null
 * si no se puede seguir.
 */
async function cicloPedido(req, res, numero) {
  const { data: caja } = await req.db
    .from("cajas")
    .select("id, nombre, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo")
    .eq("id", req.params.cajaId)
    .single()
  if (!caja) {
    res.status(404).json({ error: "Caja no encontrada" })
    return null
  }
  // Si no está configurado el ciclo, no se puede calcular
  if (!caja.fecha_fundacion) {
    res.status(400).json({
      error: "Configura el periodo de la caja antes de generar reportes",
      requiere_configuracion: true,
    })
    return null
  }
  const { ciclos, cicloActual } = calcularCiclos(
    caja.fecha_fundacion,
    caja.mes_inicio_ciclo,
    caja.duracion_ciclo,
  )
  // Si pidió un ciclo específico, úsalo; si no, el actual
  const ciclo = numero ? ciclos.find((c) => c.numero === parseInt(numero)) : cicloActual
  if (!ciclo) {
    res.status(404).json({ error: "Ciclo no encontrado" })
    return null
  }
  return { caja, ciclos, ciclo }
}

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/reportes/distribucion-interes?ciclo=2
// El reporte completo del ciclo (el actual si no se pide otro)
// ─────────────────────────────────────────────
router.get("/distribucion-interes", requierePermiso("reportes.generar"), async (req, res) => {
  try {
    const pedido = await cicloPedido(req, res, req.query.ciclo)
    if (!pedido) return
    const { caja, ciclos, ciclo } = pedido

    const resultado = await distribucionDelCiclo(req.db, caja.id, ciclo)

    // Si el sobrante de este ciclo ya se pasó a un fondo
    const { data: sobrante, error } = await req.db
      .from("sobrantes_ciclo")
      .select("monto, created_at, fondos_caja ( nombre )")
      .eq("caja_id", caja.id)
      .eq("inicio", ciclo.inicio)
      .maybeSingle()
    if (error) throw error

    return res.json({
      caja: {
        id: caja.id,
        nombre: caja.nombre,
      },
      ciclo,
      ciclos_disponibles: ciclos.map((c) => ({
        numero: c.numero,
        label: c.label,
        cerrado: c.cerrado,
        actual: c.actual,
      })),
      ...resultado,
      sobrante_registrado: sobrante
        ? {
            monto: Number(sobrante.monto),
            fondo: sobrante.fondos_caja?.nombre ?? "",
            fecha: sobrante.created_at,
          }
        : null,
    })
  } catch (err) {
    console.error("Error en distribución:", err.message)
    return responderError(res, err)
  }
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/reportes/sobrante   { ciclo, fondo_id }
// Pasa a un fondo los centavos que sobraron del reparto de un ciclo cerrado (T23). El
// monto lo calcula el backend con el mismo reparto que muestra Reportes; la base
// comprueba que el ciclo cerró y que no se pasó antes.
// ─────────────────────────────────────────────
router.post("/sobrante", requierePermiso("fondos.gestionar"), async (req, res) => {
  const { ciclo: numero, fondo_id } = req.body ?? {}
  if (!numero || !fondo_id) {
    return res.status(400).json({ error: "Indica el ciclo y el fondo" })
  }
  try {
    const pedido = await cicloPedido(req, res, numero)
    if (!pedido) return
    const { caja, ciclo } = pedido
    if (!ciclo.cerrado) {
      return res.status(400).json({ error: "El sobrante se pasa cuando el ciclo ya cerró" })
    }

    const { validacion } = await distribucionDelCiclo(req.db, caja.id, ciclo)
    if (!(validacion.sobrante > 0)) {
      return res.status(400).json({ error: "En este ciclo no sobraron centavos" })
    }

    const { data, error } = await req.db.rpc("pasar_sobrante_a_fondo", {
      p_caja: caja.id,
      p_inicio: ciclo.inicio,
      p_fin: ciclo.fin,
      p_monto: validacion.sobrante,
      p_fondo: fondo_id,
    })
    if (error) return responderError(res, error)

    return res.status(201).json({
      message: "Sobrante pasado a Fondos",
      sobrante: { monto: Number(data.monto), fecha: data.created_at },
    })
  } catch (err) {
    return responderError(res, err)
  }
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/reportes/estado-caja?ciclo=2
// Resumen financiero del ciclo (o el actual por defecto)
// ─────────────────────────────────────────────
router.get("/estado-caja", requierePermiso("reportes.generar"), async (req, res) => {
  const { cajaId } = req.params
  const { ciclo } = req.query

  // 1. Configuración del ciclo
  const { data: caja } = await req.db
    .from("cajas")
    .select("fecha_fundacion, mes_inicio_ciclo, duracion_ciclo")
    .eq("id", cajaId)
    .single()

  if (!caja) return res.status(404).json({ error: "Caja no encontrada" })
  if (!caja.fecha_fundacion) {
    return res.status(400).json({
      error: "Configura el periodo de la caja antes de generar reportes",
      requiere_configuracion: true,
    })
  }

  const { ciclos, cicloActual } = calcularCiclos(
    caja.fecha_fundacion,
    caja.mes_inicio_ciclo,
    caja.duracion_ciclo,
  )

  const cicloSel = ciclo ? ciclos.find((c) => c.numero === parseInt(ciclo)) : cicloActual

  if (!cicloSel) return res.status(404).json({ error: "Ciclo no encontrado" })

  // Todo se mide a una fecha de corte (T24): el fin del ciclo si ya cerró, hoy si está
  // en curso. Así un ciclo anterior muestra sus saldos al cierre, no los de hoy.
  const hoy = fechaLocal()
  const corte = cicloSel.cerrado ? cicloSel.fin : hoy

  try {
    // 2. Ahorros al corte: suma de los movimientos hasta esa fecha (cuadra con el saldo
    //    de las cuentas cuando el corte es hoy)
    const { data: movimientos, error: errorMov } = await req.db
      .from("transacciones")
      .select("tipo, monto")
      .eq("caja_id", cajaId)
      .lte("fecha", corte)
    if (errorMov) throw errorMov
    const totalAhorros = +(movimientos ?? [])
      .reduce((s, t) => s + (t.tipo === "deposito" ? 1 : -1) * parseFloat(t.monto), 0)
      .toFixed(2)

    // 3. Créditos al corte: desembolsados hasta esa fecha, con el saldo del último pago
    //    hasta el corte (saldo_despues ya descuenta lo condonado), o el total si no
    //    pagaron nada todavía
    const { data: creditos, error: errorCred } = await req.db
      .from("creditos")
      .select(
        "id, estado, monto_solicitado, tasa_interes, plazo_meses, fecha_desembolso, monto_total, saldo_pendiente, interes_condonado",
      )
      .eq("caja_id", cajaId)
    if (errorCred) throw errorCred

    const { data: pagos, error: errorPagos } = await req.db
      .from("pagos_credito")
      .select(
        "credito_id, numero_cuota, fecha_pago, created_at, saldo_despues, monto_pagado, monto_interes, monto_capital, es_prepago, es_importado",
      )
      .eq("caja_id", cajaId)
      .lte("fecha_pago", corte)
      .order("fecha_pago")
      .order("created_at")
    if (errorPagos) throw errorPagos

    const saldoAlCorte = {}
    ;(pagos ?? []).forEach((p) => {
      saldoAlCorte[p.credito_id] = parseFloat(p.saldo_despues)
    })
    const desembolsados = (creditos ?? [])
      .filter((c) => c.fecha_desembolso && c.fecha_desembolso <= corte)
      .map((c) => ({ ...c, saldo: saldoAlCorte[c.id] ?? parseFloat(c.monto_total) }))
    const enCursoAlCorte = desembolsados.filter((c) => c.saldo > 0)
    const porCobrar = +enCursoAlCorte.reduce((s, c) => s + c.saldo, 0).toFixed(2)

    // Lo que faltó por cobrar en el ciclo (T25): lo que no se había pagado al corte de las
    // cuotas que vencieron dentro del ciclo. En uno en curso, solo las que ya vencieron
    // antes de hoy. Mismo análisis de cuotas que la mora, con los pagos hasta el corte.
    const pagosPorCredito = {}
    for (const p of pagos ?? []) (pagosPorCredito[p.credito_id] ??= []).push(p)
    const faltante = faltaPorCobrar(desembolsados, pagosPorCredito, {
      desde: cicloSel.inicio,
      hasta: cicloSel.fin,
      antesDe: cicloSel.cerrado ? null : hoy,
    })

    // La mora es de hoy: solo tiene sentido en el ciclo en curso (T13)
    let enMora = 0
    if (!cicloSel.cerrado) {
      const activos = (creditos ?? []).filter((c) => EN_CURSO.includes(c.estado))
      const conMora = await agregarMora(req.db, activos)
      if (conMora.error) return responderError(res, conMora.error)
      enMora = conMora.creditos.filter((c) => c.mora).length
    }

    const condonado = +(creditos ?? [])
      .reduce((s, c) => s + parseFloat(c.interes_condonado ?? 0), 0)
      .toFixed(2)

    // 4. Interés y capital cobrados dentro del ciclo, hasta el corte
    const delCiclo = (pagos ?? []).filter((p) => p.fecha_pago >= cicloSel.inicio)
    const interesRecaudado = +delCiclo
      .reduce((s, p) => s + parseFloat(p.monto_interes ?? 0), 0)
      .toFixed(2)
    const capitalRecuperado = +delCiclo
      .reduce((s, p) => s + parseFloat(p.monto_capital ?? 0), 0)
      .toFixed(2)

    // 5. Interés cobrado desde que nació la caja hasta el corte
    const interesHistorico = +(pagos ?? [])
      .reduce((s, p) => s + parseFloat(p.monto_interes ?? 0), 0)
      .toFixed(2)

    // 6. Dinero disponible en caja (para prestar) al corte. No incluye los Fondos de caja
    //    (T18): ese dinero es de la organización para sus actividades y no se presta
    const enCaja = +(totalAhorros + interesHistorico - porCobrar).toFixed(2)

    return res.json({
      ciclo: {
        numero: cicloSel.numero,
        label: cicloSel.label,
        inicio: cicloSel.inicio,
        fin: cicloSel.fin,
        cerrado: cicloSel.cerrado,
      },
      corte, // ← fecha a la que se miden los saldos
      total_ahorros: totalAhorros,
      interes_recaudado: interesRecaudado, // ← del ciclo
      capital_recuperado: capitalRecuperado, // ← del ciclo
      interes_historico: interesHistorico, // ← hasta el corte
      por_cobrar: porCobrar,
      interes_condonado: condonado,
      en_caja: enCaja,
      falta_por_cobrar: faltante,
      creditos: {
        total: creditos?.length ?? 0,
        activos: enCursoAlCorte.length,
        pagados: desembolsados.filter((c) => c.saldo <= 0).length,
        pendientes: (creditos ?? []).filter((c) => c.estado === "pendiente").length,
        vencidos: (creditos ?? []).filter((c) => c.estado === "vencido").length,
        en_mora: enMora,
      },
    })
  } catch (err) {
    return responderError(res, err)
  }
})

module.exports = router
