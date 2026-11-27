// backend/routes/pendientes.routes.js
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso, NIVEL } = require("../middlewares/permisos.middleware")
const { fichaDelUsuario } = require("../utils/fichas")
const { analizarEstadoCredito } = require("../utils/amortizacion")
const { agregarMora, EN_CURSO } = require("../utils/mora")
const { calcularCiclos } = require("../utils/ciclos")
const { fechaLocal, leerFecha } = require("../utils/fechas")
const { responderError } = require("../utils/errores")

router.use(verifyToken)

// Ventanas de la campana: un ciclo "por cerrar" y un miembro "nuevo"
const DIAS_CICLO = 30
const DIAS_MIEMBRO = 14

/** Días entre hoy y una fecha "AAAA-MM-DD" (0 = hoy) */
function diasHasta(fecha) {
  const hoy = leerFecha(fechaLocal())
  return Math.round((leerFecha(fecha) - hoy) / 86_400_000)
}

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/pendientes
// Lo que la campana de la barra superior muestra (T29). Se calcula al leer; no se guarda
// ni se marca como leído. El tesorero y el coordinador ven lo de la caja; quien tenga
// ficha de socio, además, su próxima cuota. Con el token de la persona: el RLS decide.
// ─────────────────────────────────────────────
router.get("/", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId } = req.params
  const deLaCaja = NIVEL[req.rol] >= NIVEL.tesorero

  try {
    const [caja, mias, laCaja] = await Promise.all([
      leerCaja(req.db, cajaId),
      misCuotas(req.db, cajaId),
      deLaCaja ? pendientesDeLaCaja(req.db, cajaId) : null,
    ])
    return res.json({
      ...(laCaja ?? { solicitudes: null, mora: null, nuevos_miembros: null }),
      ciclo_por_cerrar: deLaCaja ? cicloPorCerrar(caja) : null,
      mis_cuotas: mias,
    })
  } catch (err) {
    return responderError(res, err)
  }
})

async function leerCaja(db, cajaId) {
  const { data, error } = await db
    .from("cajas")
    .select("fecha_fundacion, mes_inicio_ciclo, duracion_ciclo")
    .eq("id", cajaId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** El ciclo actual si cierra dentro de DIAS_CICLO días, o null */
function cicloPorCerrar(caja) {
  if (!caja?.fecha_fundacion || !caja.mes_inicio_ciclo || !caja.duracion_ciclo) return null
  const { cicloActual: c } = calcularCiclos(
    caja.fecha_fundacion,
    caja.mes_inicio_ciclo,
    caja.duracion_ciclo,
  )
  if (!c?.actual) return null
  const dias = diasHasta(c.fin)
  return dias <= DIAS_CICLO ? { numero: c.numero, label: c.label, fin: c.fin, dias } : null
}

/** Solicitudes por aprobar, créditos en mora y miembros nuevos de la caja */
async function pendientesDeLaCaja(db, cajaId) {
  const desde = new Date(Date.now() - DIAS_MIEMBRO * 86_400_000).toISOString()
  const [creditos, miembros] = await Promise.all([
    db
      .from("creditos")
      .select("id, estado, monto_solicitado, tasa_interes, plazo_meses, fecha_desembolso")
      .eq("caja_id", cajaId)
      .in("estado", ["pendiente", ...EN_CURSO]),
    db
      .from("miembros_caja")
      .select("user_id")
      .eq("caja_id", cajaId)
      .eq("activo", true)
      .gte("created_at", desde),
  ])
  if (creditos.error) throw creditos.error
  if (miembros.error) throw miembros.error

  const lista = creditos.data ?? []
  const conMora = await agregarMora(
    db,
    lista.filter((c) => c.estado !== "pendiente"),
  )
  if (conMora.error) throw conMora.error
  const enMora = conMora.creditos.filter((c) => c.mora)

  // Miembros nuevos y cuántos todavía no tienen ficha vinculada: el tesorero la registra
  // con su correo y se vincula sola al entrar
  const nuevos = (miembros.data ?? []).map((m) => m.user_id)
  let sinFicha = 0
  if (nuevos.length > 0) {
    const { data, error } = await db
      .from("socios")
      .select("user_id")
      .eq("caja_id", cajaId)
      .in("user_id", nuevos)
    if (error) throw error
    const conFicha = new Set((data ?? []).map((s) => s.user_id))
    sinFicha = nuevos.filter((id) => !conFicha.has(id)).length
  }

  return {
    solicitudes: lista.filter((c) => c.estado === "pendiente").length,
    mora: enMora.length
      ? {
          creditos: enMora.length,
          cuotas: enMora.reduce((s, c) => s + c.mora.cuotas_vencidas, 0),
          monto: +enMora.reduce((s, c) => s + c.mora.monto_vencido, 0).toFixed(2),
        }
      : null,
    nuevos_miembros: nuevos.length
      ? { total: nuevos.length, sin_ficha: sinFicha, dias: DIAS_MIEMBRO }
      : null,
  }
}

/**
 * La próxima cuota de cada crédito en curso de quien consulta (su ficha en esta caja), y
 * cuántas tiene vencidas. Sin ficha, ninguna.
 */
async function misCuotas(db, cajaId) {
  const ficha = await fichaDelUsuario(db, cajaId)
  if (!ficha) return []
  const { data: creditos, error } = await db
    .from("creditos")
    .select("*")
    .eq("caja_id", cajaId)
    .eq("socio_id", ficha.id)
    .in("estado", EN_CURSO)
  if (error) throw error
  if (!creditos?.length) return []

  const { data: pagos, error: e2 } = await db
    .from("pagos_credito")
    .select("*")
    .in(
      "credito_id",
      creditos.map((c) => c.id),
    )
  if (e2) throw e2

  return creditos
    .filter((c) => c.fecha_desembolso)
    .map((c) => {
      const propios = (pagos ?? []).filter((p) => p.credito_id === c.id)
      const { cuotaCorriente, vencidas } = analizarEstadoCredito(c, propios)
      if (!cuotaCorriente) return null
      return {
        credito_id: c.id,
        numero: c.numero,
        numero_cuota: cuotaCorriente.numero_cuota,
        fecha_vencimiento: cuotaCorriente.fecha_vencimiento,
        falta_total: +(cuotaCorriente.falta_capital + cuotaCorriente.falta_interes).toFixed(2),
        dias: diasHasta(cuotaCorriente.fecha_vencimiento),
        vencidas: vencidas.length,
        monto_vencido: +vencidas
          .reduce((s, v) => s + v.falta_capital + v.falta_interes, 0)
          .toFixed(2),
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.fecha_vencimiento < b.fecha_vencimiento ? -1 : 1))
}

module.exports = router
