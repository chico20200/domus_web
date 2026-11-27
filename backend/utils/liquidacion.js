// backend/utils/liquidacion.js
const { analizarEstadoCredito } = require("./amortizacion")
const { EN_CURSO } = require("./mora")

/*
 * Liquidación de salida de un socio (Etapa 7, T3; especificaciones §12).
 *
 * Recibe sus ahorros y el interés del ciclo hasta hoy, menos su deuda. La deuda de cada
 * crédito en curso es el capital pendiente más el interés de las cuotas vencidas; el
 * interés de las cuotas que aún no vencen no se cobra (se condona). No sale si sus
 * ahorros no cubren la deuda. Una solicitud sin aprobar no mueve dinero: se anula al
 * registrar la salida (T4).
 *
 * Todo en centavos para que las sumas cuadren; se devuelve en dólares.
 */

const c = (n) => Math.round(Number(n ?? 0) * 100)
const d = (centavos) => centavos / 100

/**
 * @param socio   ficha { id, nombre, apellido, cedula, activo }
 * @param cuentas [{ id, numero_cuenta, estado, saldo }]
 * @param creditos [{ id, numero, estado, monto_solicitado, tasa_interes, plazo_meses,
 *                    fecha_desembolso, pagos: [...] }]
 * @param interes { ciclo: { numero, label, inicio, fin } | null, monto, tipo } o null si la
 *                caja no tiene configurado su periodo
 */
function calcularLiquidacion({ socio, cuentas, creditos, interes }) {
  const conSaldo = (cuentas ?? []).map((cta) => ({
    id: cta.id,
    numero_cuenta: cta.numero_cuenta,
    estado: cta.estado,
    saldo: d(c(cta.saldo)),
  }))
  const ahorros = conSaldo.reduce((s, cta) => s + c(cta.saldo), 0)

  const deudas = (creditos ?? [])
    .filter((cr) => EN_CURSO.includes(cr.estado) && cr.fecha_desembolso)
    .map((cr) => {
      const { filas, vencidas } = analizarEstadoCredito(cr, cr.pagos ?? [])
      const capital = filas.reduce((s, f) => s + c(f.falta_capital), 0)
      const interesVencido = vencidas.reduce((s, f) => s + c(f.falta_interes), 0)
      const interesFuturo = filas
        .filter((f) => !f.vencida)
        .reduce((s, f) => s + c(f.falta_interes), 0)
      return {
        id: cr.id,
        numero: cr.numero,
        capital_pendiente: d(capital),
        interes_vencido: d(interesVencido),
        cuotas_vencidas: vencidas.length,
        interes_condonado: d(interesFuturo),
        deuda: d(capital + interesVencido),
      }
    })
    .filter((cr) => cr.deuda > 0 || cr.capital_pendiente > 0)
  const deuda = deudas.reduce((s, cr) => s + c(cr.deuda), 0)

  const solicitudes = (creditos ?? [])
    .filter((cr) => cr.estado === "pendiente")
    .map((cr) => ({ id: cr.id, numero: cr.numero, monto: d(c(cr.monto_solicitado)) }))

  const interesCiclo = interes ? c(interes.monto) : 0
  const neto = ahorros + interesCiclo - deuda

  const impedimentos = []
  if (!socio.activo) {
    impedimentos.push({
      codigo: "inactivo",
      mensaje: "La ficha ya está inactiva: ya salió de la caja.",
    })
  }
  if (ahorros < deuda) {
    impedimentos.push({
      codigo: "deuda",
      mensaje: `Sus ahorros (${dinero(ahorros)}) no cubren su deuda (${dinero(deuda)}): faltan ${dinero(deuda - ahorros)}. Para salir, primero tiene que pagar esa diferencia en sus créditos.`,
    })
  }

  return {
    socio: {
      id: socio.id,
      nombre: socio.nombre,
      apellido: socio.apellido,
      cedula: socio.cedula,
      activo: socio.activo,
    },
    cuentas: conSaldo,
    ahorros: d(ahorros),
    interes: interes ? { ciclo: interes.ciclo, tipo: interes.tipo, monto: d(interesCiclo) } : null,
    creditos: deudas,
    deuda: d(deuda),
    solicitudes,
    neto: d(neto),
    puede_salir: impedimentos.length === 0,
    impedimentos,
  }
}

/** $1.234,56, igual que el frontend */
function dinero(centavos) {
  const [ent, dec] = (Math.abs(centavos) / 100).toFixed(2).split(".")
  return `$${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`
}

module.exports = { calcularLiquidacion }
