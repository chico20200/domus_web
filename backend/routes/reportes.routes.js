// backend/routes/reportes.routes.js
const express = require("express")
const { responderError } = require("../utils/errores")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { calcularDistribucionInteres, tipoDeReparto } = require("../utils/reportes")
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

/** El reparto de intereses de un ciclo, con su tipo */
async function distribucionDelCiclo(db, cajaId, ciclo) {
  // Socios activos
  const { data: socios, error: errorSocios } = await db
    .from("socios")
    .select("id, nombre, apellido, cedula, fecha_ingreso")
    .eq("caja_id", cajaId)
    .eq("activo", true)
    .order("apellido")
  if (errorSocios) throw errorSocios

  // Transacciones de ahorro
  const { data: transacciones, error: errorTx } = await db
    .from("transacciones")
    .select("tipo, monto, fecha, cuentas_ahorro!inner ( socio_id )")
    .eq("caja_id", cajaId)
    .order("fecha")
  if (errorTx) throw errorTx

  const txPlanas = (transacciones ?? []).map((t) => ({
    socio_id: t.cuentas_ahorro.socio_id,
    tipo: t.tipo,
    monto: t.monto,
    fecha: t.fecha,
  }))

  // Pagos de interés dentro del ciclo — con la fecha fin correcta
  const { data: pagosInteres, error: errorPagos } = await db
    .from("pagos_credito")
    .select("monto_interes, fecha_pago")
    .eq("caja_id", cajaId)
    .gte("fecha_pago", ciclo.inicio)
    .lte("fecha_pago", ciclo.fin)
  if (errorPagos) throw errorPagos

  return calcularDistribucionInteres({
    meses: ciclo.meses,
    socios: socios ?? [],
    transacciones: txPlanas,
    pagosInteres: pagosInteres ?? [],
    tipo: await tipoDeReparto(db, cajaId, ciclo.inicio),
  })
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

  // 2. Ahorros — saldo actual de las cuentas (no depende del ciclo)
  const { data: cuentas } = await req.db
    .from("cuentas_ahorro")
    .select("saldo")
    .eq("caja_id", cajaId)
    .eq("estado", "activa")

  const totalAhorros = +(cuentas ?? []).reduce((s, c) => s + parseFloat(c.saldo), 0).toFixed(2)

  // 3. Créditos — estado actual de la cartera
  const { data: creditos } = await req.db
    .from("creditos")
    .select(
      "id, estado, monto_solicitado, tasa_interes, plazo_meses, fecha_desembolso, saldo_pendiente, interes_condonado",
    )
    .eq("caja_id", cajaId)

  // Por cobrar: desembolsados y sin terminar de pagar, al día o atrasados (T13)
  const activos = (creditos ?? []).filter((c) => EN_CURSO.includes(c.estado))
  const conMora = await agregarMora(req.db, activos)
  if (conMora.error) return responderError(res, conMora.error)
  const porCobrar = +activos.reduce((s, c) => s + parseFloat(c.saldo_pendiente), 0).toFixed(2)

  const condonado = +(creditos ?? [])
    .reduce((s, c) => s + parseFloat(c.interes_condonado ?? 0), 0)
    .toFixed(2)

  // 4. Interés y capital — SOLO DEL CICLO SELECCIONADO
  const { data: pagosCiclo } = await req.db
    .from("pagos_credito")
    .select("monto_interes, monto_capital")
    .eq("caja_id", cajaId)
    .gte("fecha_pago", cicloSel.inicio)
    .lte("fecha_pago", cicloSel.fin)

  const interesRecaudado = +(pagosCiclo ?? [])
    .reduce((s, p) => s + parseFloat(p.monto_interes ?? 0), 0)
    .toFixed(2)
  const capitalRecuperado = +(pagosCiclo ?? [])
    .reduce((s, p) => s + parseFloat(p.monto_capital ?? 0), 0)
    .toFixed(2)

  // 5. Interés histórico total — para contexto
  const { data: pagosTodos } = await req.db
    .from("pagos_credito")
    .select("monto_interes")
    .eq("caja_id", cajaId)

  const interesHistorico = +(pagosTodos ?? [])
    .reduce((s, p) => s + parseFloat(p.monto_interes ?? 0), 0)
    .toFixed(2)

  // 6. Dinero disponible en caja (para prestar). No incluye los Fondos de caja (T18):
  // ese dinero es de la organización para sus actividades y no se presta
  const enCaja = +(totalAhorros + interesHistorico - porCobrar).toFixed(2)

  return res.json({
    ciclo: {
      numero: cicloSel.numero,
      label: cicloSel.label,
      inicio: cicloSel.inicio,
      fin: cicloSel.fin,
    },
    total_ahorros: totalAhorros,
    interes_recaudado: interesRecaudado, // ← del ciclo
    capital_recuperado: capitalRecuperado, // ← del ciclo
    interes_historico: interesHistorico, // ← de toda la vida de la caja
    por_cobrar: porCobrar,
    interes_condonado: condonado,
    en_caja: enCaja,
    creditos: {
      total: creditos?.length ?? 0,
      activos: activos.length,
      pagados: (creditos ?? []).filter((c) => c.estado === "pagado").length,
      pendientes: (creditos ?? []).filter((c) => c.estado === "pendiente").length,
      vencidos: (creditos ?? []).filter((c) => c.estado === "vencido").length,
      en_mora: conMora.creditos.filter((c) => c.mora).length,
    },
  })
})

module.exports = router
