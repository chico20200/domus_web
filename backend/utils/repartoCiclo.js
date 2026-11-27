// backend/utils/repartoCiclo.js
const { calcularDistribucionInteres, estuvoEntre, tipoDeReparto } = require("./reportes")

/*
 * Lee de la base lo que necesita el reparto de un ciclo y lo calcula. Lo usan Reportes y
 * la liquidación de salida (Etapa 7, T3), así las dos cifras son siempre la misma.
 */

/** El reparto de intereses de un ciclo, con su tipo */
async function distribucionDelCiclo(db, cajaId, ciclo) {
  // Los socios que estuvieron en el ciclo, aunque hoy estén inactivos (T24)
  const { data: fichas, error: errorSocios } = await db
    .from("socios")
    .select("id, nombre, apellido, cedula, fecha_ingreso, fecha_salida, activo")
    .eq("caja_id", cajaId)
    .order("apellido")
  if (errorSocios) throw errorSocios

  // Sus periodos de membresía (migración 020): quien salió y volvió solo cuenta en los
  // meses en que estuvo
  const { data: periodos, error: errorPeriodos } = await db
    .from("periodos_socio")
    .select("socio_id, ingreso, salida")
    .eq("caja_id", cajaId)
    .order("ingreso")
  if (errorPeriodos) throw errorPeriodos
  const periodosDe = {}
  for (const p of periodos ?? []) (periodosDe[p.socio_id] ??= []).push(p)

  const socios = (fichas ?? [])
    .map((s) => ({ ...s, periodos: periodosDe[s.id] ?? [] }))
    .filter((s) => estuvoEntre(s, ciclo.inicio, ciclo.fin))

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
    socios,
    transacciones: txPlanas,
    pagosInteres: pagosInteres ?? [],
    tipo: await tipoDeReparto(db, cajaId, ciclo.inicio),
  })
}

module.exports = { distribucionDelCiclo }
