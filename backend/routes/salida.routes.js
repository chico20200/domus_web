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
    const liquidacion = await leerLiquidacion(req.db, cajaId, socioId)
    if (!liquidacion) return res.status(404).json({ error: "Socio no encontrado" })
    return res.json(liquidacion)
  } catch (err) {
    return responderError(res, err)
  }
})

/** Lee lo que necesita la liquidación y la calcula; null si la ficha no existe */
async function leerLiquidacion(db, cajaId, socioId) {
  const { data: socio, error } = await db
    .from("socios")
    .select("id, nombre, apellido, cedula, activo")
    .eq("id", socioId)
    .eq("caja_id", cajaId)
    .maybeSingle()
  if (error) throw error
  if (!socio) return null

  const [cuentas, creditos, caja] = await Promise.all([
    db
      .from("cuentas_ahorro")
      .select("id, numero_cuenta, estado, saldo")
      .eq("caja_id", cajaId)
      .eq("socio_id", socioId)
      .order("numero_cuenta"),
    db
      .from("creditos")
      .select("id, numero, estado, monto_solicitado, tasa_interes, plazo_meses, fecha_desembolso")
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
  const dist = await distribucionDelCiclo(db, cajaId, cicloActual)
  const suyo = (dist.por_socio ?? []).find((s) => s.socio_id === socioId)
  return {
    ciclo: {
      numero: cicloActual.numero,
      label: cicloActual.label,
      inicio: cicloActual.inicio,
      fin: cicloActual.fin,
    },
    tipo: dist.tipo,
    monto: suyo?.interes_total ?? 0,
  }
}

module.exports = router
module.exports.leerLiquidacion = leerLiquidacion
