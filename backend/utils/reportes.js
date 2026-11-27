// backend/utils/reportes.js

/** Último día del mes en formato ISO */
function finDeMes(mesISO) {
  const [y, m] = mesISO.split("-").map(Number)
  const d = new Date(y, m, 0) // día 0 del mes siguiente
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Los dos tipos de reparto (T23). Sin elegir, la diferenciada: la de siempre */
const TIPOS_REPARTO = ["diferenciada", "equitativa"]

/**
 * CÁLCULO PRINCIPAL — reparte entre los socios el interés cobrado en cada mes del ciclo.
 *
 * Para cada mes del periodo:
 *   1. saldo acumulado de cada socio al cierre del mes
 *   2. capital total de la caja = suma de esos saldos
 *   3. interés recaudado ese mes (de pagos_credito)
 *   4. tasa del mes = interés / capital × 100
 *   5. la parte de cada socio:
 *      - diferenciada: tasa × su saldo / 100 (modelo del Excel de la caja)
 *      - equitativa: el interés en partes iguales entre los socios que ya habían
 *        ingresado al cierre del mes (fecha_ingreso), tengan o no ahorro
 *
 * Las partes se acumulan sin redondear y el total de cada socio se redondea hacia abajo
 * al centavo. Lo que sobra (menos de un centavo por socio) es el `sobrante`, que va a
 * Fondos de caja. Si en un mes nadie puede recibir (sin capital en la diferenciada, sin
 * socios en la equitativa), ese interés queda `sin_repartir` y el reparto no cuadra.
 */
function calcularDistribucionInteres({
  meses,
  socios,
  transacciones,
  pagosInteres,
  tipo = "diferenciada",
}) {
  // ── Índice de transacciones por socio ────────────────────────
  // Cada transacción tiene: socio_id, tipo (deposito/retiro), monto y fecha (el día del
  // movimiento, migración 015; antes se usaba la hora de registro)
  const txPorSocio = {}
  socios.forEach((s) => {
    txPorSocio[s.id] = []
  })

  transacciones.forEach((t) => {
    if (!txPorSocio[t.socio_id]) txPorSocio[t.socio_id] = []
    txPorSocio[t.socio_id].push({
      fecha: t.fecha,
      signo: t.tipo === "deposito" ? 1 : -1,
      monto: parseFloat(t.monto),
    })
  })

  // ── Índice de interés recaudado por mes ──────────────────────
  const interesPorMes = {}
  meses.forEach((m) => {
    interesPorMes[m] = 0
  })

  pagosInteres.forEach((p) => {
    const mes = p.fecha_pago.slice(0, 7) // '2024-05-13' → '2024-05'
    if (interesPorMes[mes] !== undefined) {
      interesPorMes[mes] += parseFloat(p.monto_interes ?? 0)
    }
  })

  // ── Cálculo mes a mes ────────────────────────────────────────
  const filasMes = [] // una fila por mes
  const acumSocio = {} // interés total acumulado por socio

  socios.forEach((s) => {
    acumSocio[s.id] = 0
  })

  meses.forEach((mes) => {
    const corte = finDeMes(mes)

    // 1. Saldo acumulado de cada socio al cierre de este mes
    const saldos = {}
    let capitalTotal = 0

    socios.forEach((s) => {
      const movimientos = txPorSocio[s.id] ?? []
      const saldo = movimientos
        .filter((t) => t.fecha <= corte) // todo lo anterior al corte
        .reduce((acc, t) => acc + t.signo * t.monto, 0)
      saldos[s.id] = +saldo.toFixed(2)
      capitalTotal += saldo
    })

    capitalTotal = +capitalTotal.toFixed(2)

    // 2. Interés recaudado en este mes
    const interesMes = +(interesPorMes[mes] ?? 0).toFixed(2)

    // 3. Tasa del mes — el corazón del modelo
    //    Si no hay capital, la tasa es 0 (evita división por cero)
    const tasaMes = capitalTotal > 0 ? +((interesMes / capitalTotal) * 100).toFixed(6) : 0

    // 4. Reparto a cada socio, sin redondear (se redondea el total del ciclo)
    const reparto = {}
    const participantes =
      tipo === "equitativa"
        ? socios.filter((s) => !s.fecha_ingreso || s.fecha_ingreso <= corte)
        : []
    const parte = participantes.length ? interesMes / participantes.length : 0
    socios.forEach((s) => {
      const cuota =
        tipo === "equitativa"
          ? participantes.includes(s)
            ? parte
            : 0
          : capitalTotal > 0
            ? (interesMes * saldos[s.id]) / capitalTotal
            : 0
      reparto[s.id] = cuota
      acumSocio[s.id] += cuota
    })

    filasMes.push({
      mes,
      capital_total: capitalTotal,
      interes_mes: interesMes,
      tasa_mes: tasaMes, // % de rendimiento de ese mes
      // Equitativa: cuántos socios se reparten el mes y cuánto le toca a cada uno
      participantes: tipo === "equitativa" ? participantes.length : null,
      parte: tipo === "equitativa" ? +parte.toFixed(6) : null,
      saldos, // saldo de cada socio
      reparto, // interés que le tocó a cada socio
    })
  })

  // ── Totales del periodo ──────────────────────────────────────
  const interesTotal = +filasMes.reduce((s, f) => s + f.interes_mes, 0).toFixed(2)
  const tasaAcumulada = +filasMes.reduce((s, f) => s + f.tasa_mes, 0).toFixed(4)

  // Tabla por socio con su acumulado
  const porSocio = socios.map((s) => ({
    socio_id: s.id,
    nombre: `${s.nombre} ${s.apellido}`,
    cedula: s.cedula,
    // Saldo final del socio (último mes del periodo)
    saldo_final: filasMes.length ? filasMes[filasMes.length - 1].saldos[s.id] : 0,
    // Interés mes a mes
    por_mes: filasMes.map((f) => ({ mes: f.mes, interes: +f.reparto[s.id].toFixed(2) })),
    // Total del periodo, hacia abajo al centavo: lo que falta va al sobrante
    interes_total: abajoAlCentavo(acumSocio[s.id]),
  }))

  // ── Validación de cuadre ─────────────────────────────────────
  // En centavos: generado = repartido + sobrante + sin repartir
  const centavos = (n) => Math.round(n * 100)
  const generadoC = centavos(interesTotal)
  const repartidoC = porSocio.reduce((s, p) => s + centavos(p.interes_total), 0)
  const asignadoC = centavos(Object.values(acumSocio).reduce((s, v) => s + v, 0))
  const sinRepartirC = Math.max(generadoC - asignadoC, 0)
  const sobranteC = generadoC - repartidoC - sinRepartirC

  return {
    tipo,
    meses: filasMes,
    por_socio: porSocio,
    interes_total: interesTotal,
    tasa_acumulada: tasaAcumulada,
    validacion: {
      interes_generado: interesTotal,
      interes_repartido: repartidoC / 100,
      // Centavos que sobran al redondear cada parte: van a Fondos de caja
      sobrante: sobranteC / 100,
      // Interés que nadie pudo recibir (debe ser 0)
      diferencia: sinRepartirC / 100,
      cuadra: sinRepartirC === 0,
    },
  }
}

/**
 * El tipo de reparto de un ciclo (T23, migración 017): el de la fila más reciente con
 * inicio igual o anterior al del ciclo; sin filas, la diferenciada.
 */
async function tipoDeReparto(db, cajaId, inicio) {
  const { data, error } = await db
    .from("repartos_ciclo")
    .select("tipo")
    .eq("caja_id", cajaId)
    .lte("inicio", inicio)
    .order("inicio", { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0]?.tipo ?? "diferenciada"
}

/** Hacia abajo al centavo, sin que el error del punto flotante quite uno de más */
function abajoAlCentavo(n) {
  return Math.floor(n * 100 + 1e-6) / 100
}

module.exports = { calcularDistribucionInteres, tipoDeReparto, TIPOS_REPARTO }
