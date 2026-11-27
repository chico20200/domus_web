// backend/routes/salida.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { calcularLiquidacion } = require("../utils/liquidacion")
const { distribucionDelCiclo } = require("../utils/repartoCiclo")
const { calcularCiclos } = require("../utils/ciclos")
const { responderError } = require("../utils/errores")

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/socios/:socioId/salida
// Vista previa de la liquidación de salida (Etapa 7, T3): ahorros, interés del ciclo
// hasta hoy, deuda por crédito, neto y si puede salir. No cambia nada.
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, socioId } = req.params
  try {
    const liquidacion = await leerLiquidacion(req.db, cajaId, socioId, req.user.id)
    if (!liquidacion) return res.status(404).json({ error: "Socio no encontrado" })
    return res.json(liquidacion)
  } catch (err) {
    return responderError(res, err)
  }
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/socios/:socioId/salida
//   { neto_esperado, ahorros_entregados, interes_entregado }
// Registra la salida (Etapa 7, T4): vuelve a calcular la liquidación aquí, sin fiarse de
// lo que vio la pantalla, y si el neto es el mismo la registra toda junta con
// registrar_salida (migración 021): pagos de los créditos, retiros, cuentas cerradas,
// ficha inactiva y la liquidación guardada. Solo el coordinador.
// ─────────────────────────────────────────────
router.post("/", requierePermiso("socios.eliminar"), async (req, res) => {
  const { cajaId, socioId } = req.params
  const { neto_esperado, ahorros_entregados, interes_entregado } = req.body ?? {}

  if (ahorros_entregados !== true || interes_entregado !== true) {
    return res.status(400).json({
      error:
        "Antes de registrar la salida, confirma que se le entregaron sus ahorros y el interés del ciclo",
    })
  }
  try {
    const liq = await leerLiquidacion(req.db, cajaId, socioId, req.user.id)
    if (!liq) return res.status(404).json({ error: "Socio no encontrado" })
    if (!liq.puede_salir) {
      return res.status(409).json({ error: liq.impedimentos[0].mensaje, liquidacion: liq })
    }
    if (Number(neto_esperado) !== liq.neto) {
      return res.status(409).json({
        error:
          "La liquidación cambió mientras la revisabas. Revisa las cifras nuevas antes de registrarla.",
        liquidacion: liq,
      })
    }

    const { data, error } = await req.db.rpc("registrar_salida", {
      p_caja: cajaId,
      p_socio: socioId,
      p_plan: planDeSalida(liq, { ahorros_entregados, interes_entregado }),
    })
    if (error) return responderError(res, error)
    return res.status(201).json({ message: "Salida registrada", liquidacion: data })
  } catch (err) {
    return responderError(res, err)
  }
})

/** Lo que recibe registrar_salida: los saldos que se vieron, los pagos y el detalle */
function planDeSalida(liq, checks) {
  return {
    cuentas: liq.cuentas.map((cta) => ({ id: cta.id, saldo: cta.saldo })),
    creditos: liq.creditos.map((cr) => ({
      id: cr.id,
      saldo_pendiente: cr.saldo_pendiente,
      partes: cr.partes,
    })),
    solicitudes: liq.solicitudes.map((s) => s.id),
    interes: liq.interes && {
      monto: liq.interes.monto,
      ciclo_numero: liq.interes.ciclo?.numero ?? null,
      ciclo_inicio: liq.interes.ciclo?.inicio ?? null,
      ciclo_fin: liq.interes.ciclo?.fin ?? null,
      tipo: liq.interes.tipo,
    },
    // Lo que se muestra después en el historial y en el PDF (T6, T7)
    detalle: {
      socio: liq.socio,
      cuentas: liq.cuentas,
      creditos: liq.creditos.map(({ partes, saldo_pendiente, ...cr }) => cr), // eslint-disable-line no-unused-vars
      solicitudes: liq.solicitudes,
      interes: liq.interes,
    },
    ...checks,
  }
}

/** Lee lo que necesita la liquidación y la calcula; null si la ficha no existe */
async function leerLiquidacion(db, cajaId, socioId, usuarioId) {
  const { data: socio, error } = await db
    .from("socios")
    .select("id, nombre, apellido, cedula, activo, user_id")
    .eq("id", socioId)
    .eq("caja_id", cajaId)
    .maybeSingle()
  if (error) throw error
  if (!socio) return null

  // Si su cuenta de usuario entra a la caja, la salida le quita el acceso (022)
  let tieneAcceso = false
  if (socio.user_id) {
    const { data: m, error: e } = await db
      .from("miembros_caja")
      .select("activo")
      .eq("caja_id", cajaId)
      .eq("user_id", socio.user_id)
      .maybeSingle()
    if (e) throw e
    tieneAcceso = Boolean(m?.activo)
  }

  const [cuentas, creditos, caja] = await Promise.all([
    db
      .from("cuentas_ahorro")
      .select("id, numero_cuenta, estado, saldo")
      .eq("caja_id", cajaId)
      .eq("socio_id", socioId)
      .order("numero_cuenta"),
    db
      .from("creditos")
      .select(
        "id, numero, estado, monto_solicitado, tasa_interes, plazo_meses, fecha_desembolso, saldo_pendiente",
      )
      .eq("caja_id", cajaId)
      .eq("socio_id", socioId)
      .in("estado", ["pendiente", "activo", "vencido"])
      .order("numero"),
    db
      .from("cajas")
      .select("fecha_fundacion, mes_inicio_ciclo, duracion_ciclo")
      .eq("id", cajaId)
      .single(),
  ])
  for (const r of [cuentas, creditos, caja]) if (r.error) throw r.error

  const ids = (creditos.data ?? []).map((cr) => cr.id)
  let pagos = []
  if (ids.length) {
    const { data, error: e } = await db.from("pagos_credito").select("*").in("credito_id", ids)
    if (e) throw e
    pagos = data ?? []
  }

  return calcularLiquidacion({
    socio,
    cuentas: cuentas.data,
    creditos: (creditos.data ?? []).map((cr) => ({
      ...cr,
      pagos: pagos.filter((p) => p.credito_id === cr.id),
    })),
    interes: await interesDelCiclo(db, cajaId, caja.data, socioId),
    acceso: { tiene: tieneAcceso, propia: Boolean(socio.user_id) && socio.user_id === usuarioId },
  })
}

/** Lo que le toca del reparto del ciclo actual hasta hoy; null sin periodo configurado */
async function interesDelCiclo(db, cajaId, caja, socioId) {
  if (!caja?.fecha_fundacion) return null
  const { cicloActual } = calcularCiclos(
    caja.fecha_fundacion,
    caja.mes_inicio_ciclo,
    caja.duracion_ciclo,
  )
  if (!cicloActual) return null
  const [dist, previas] = await Promise.all([
    distribucionDelCiclo(db, cajaId, cicloActual),
    db
      .from("liquidaciones")
      .select("interes")
      .eq("socio_id", socioId)
      .eq("ciclo_inicio", cicloActual.inicio),
  ])
  if (previas.error) throw previas.error
  const suyo = (dist.por_socio ?? []).find((s) => s.socio_id === socioId)
  const total = suyo?.interes_total ?? 0
  // Si ya salió una vez en este ciclo y volvió, lo que se le entregó entonces no se repite
  const yaEntregado = (previas.data ?? []).reduce((s, l) => s + Math.round(l.interes * 100), 0)

  return {
    ciclo: {
      numero: cicloActual.numero,
      label: cicloActual.label,
      inicio: cicloActual.inicio,
      fin: cicloActual.fin,
    },
    tipo: dist.tipo,
    monto: Math.max(Math.round(total * 100) - yaEntregado, 0) / 100,
    // Mes a mes, en centavos exactos que suman su total del ciclo: la liquidación lo
    // guarda y desde ahí su interés de este ciclo queda fijo (T5)
    por_mes: porMesExacto(suyo?.por_mes ?? [], total),
  }
}

/** Ajusta el último mes con interés para que la suma sea exactamente el total */
function porMesExacto(porMes, total) {
  const meses = porMes.map((m) => ({ mes: m.mes, interes: Math.round(m.interes * 100) }))
  const diferencia = Math.round(total * 100) - meses.reduce((s, m) => s + m.interes, 0)
  const ultimo = [...meses].reverse().find((m) => m.interes > 0) ?? meses[meses.length - 1]
  if (ultimo) ultimo.interes += diferencia
  return meses.map((m) => ({ mes: m.mes, interes: m.interes / 100 }))
}

module.exports = router
module.exports.leerLiquidacion = leerLiquidacion
module.exports.planDeSalida = planDeSalida
