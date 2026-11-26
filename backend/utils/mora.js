/**
 * Mora calculada al leer (Etapa 6, T13).
 *
 * Un crédito está en mora cuando tiene al menos una cuota vencida sin pagar: la misma
 * regla de analizarEstadoCredito (vence a fin de mes y está vencida desde el mes
 * siguiente). No se guarda en la base: se calcula con la tabla y los pagos cada vez que
 * se lee, así nunca queda desactualizada ni depende de que alguien la marque.
 *
 * El estado guardado (pendiente, activo, pagado, vencido) sigue siendo el de la base.
 */
const { analizarEstadoCredito } = require("./amortizacion")

// Desembolsados y sin terminar de pagar: los únicos que pueden atrasarse
const EN_CURSO = ["activo", "vencido"]

/** { cuotas_vencidas, monto_vencido, desde } o null si está al día */
function calcularMora(credito, pagos) {
  if (!EN_CURSO.includes(credito.estado) || !credito.fecha_desembolso) return null
  const { vencidas } = analizarEstadoCredito(credito, pagos)
  if (vencidas.length === 0) return null
  return {
    cuotas_vencidas: vencidas.length,
    monto_vencido: +vencidas.reduce((s, f) => s + f.falta_capital + f.falta_interes, 0).toFixed(2),
    desde: vencidas[0].fecha_vencimiento,
  }
}

/**
 * Agrega `mora` a cada crédito. Lee los pagos de los créditos en curso en una sola
 * consulta. Devuelve { creditos, error }.
 */
async function agregarMora(db, creditos) {
  const lista = creditos ?? []
  const ids = lista.filter((c) => EN_CURSO.includes(c.estado)).map((c) => c.id)
  let pagos = []
  if (ids.length > 0) {
    const { data, error } = await db
      .from("pagos_credito")
      .select(
        "credito_id, numero_cuota, monto_pagado, monto_capital, monto_interes, es_prepago, fecha_pago",
      )
      .in("credito_id", ids)
    if (error) return { creditos: lista, error }
    pagos = data ?? []
  }
  const porCredito = {}
  for (const p of pagos) (porCredito[p.credito_id] ??= []).push(p)
  return {
    creditos: lista.map((c) => ({ ...c, mora: calcularMora(c, porCredito[c.id] ?? []) })),
    error: null,
  }
}

module.exports = { EN_CURSO, calcularMora, agregarMora }
