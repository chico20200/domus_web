// backend/utils/reportes.js
const { analizarEstadoCredito } = require("./amortizacion")

/** Último día del mes en formato ISO */
function finDeMes(mesISO) {
  const [y, m] = mesISO.split("-").map(Number)
  const d = new Date(y, m, 0) // día 0 del mes siguiente
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Si [ingreso, salida] toca [inicio, fin]: entró hasta el fin y no salió antes del inicio */
const toca = (ingreso, salida, inicio, fin) =>
  (!ingreso || ingreso <= fin) && (!salida || salida >= inicio)

/**
 * Si un socio estuvo en el periodo [inicio, fin]. Sirve para el ciclo y para cada mes.
 * Con sus periodos de membresía (migración 020), basta que uno toque el rango: quien salió
 * y volvió no cuenta en los meses en que estuvo fuera. Sin ellos, sus fechas de ingreso y
 * de salida de la ficha (T24, migración 018).
 */
function estuvoEntre(socio, inicio, fin) {
  if (socio.periodos?.length) {
    return socio.periodos.some((p) => toca(p.ingreso, p.salida, inicio, fin))
  }
  return toca(socio.fecha_ingreso, socio.fecha_salida, inicio, fin)
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
 *      - equitativa: el interés en partes iguales entre los socios que estuvieron en
 *        el mes (el de su ingreso y el de su salida cuentan enteros), tengan o no ahorro
 *
 * Las partes se acumulan sin redondear y el total de cada socio se redondea hacia abajo
 * al centavo. Lo que sobra (menos de un centavo por socio) es el `sobrante`, que va a
 * Fondos de caja. Si en un mes nadie puede recibir (sin capital en la diferenciada, sin
 * socios en la equitativa), ese interés queda `sin_repartir` y el reparto no cuadra.
 *
 * Quien salió de la caja en el ciclo (Etapa 7, T5) ya recibió su interés en la
 * liquidación, y esa cifra queda fija. `fijos[socio_id] = { hasta, por_mes, total }`: hasta
 * el mes de su salida (`hasta`, "AAAA-MM") recibe en cada mes exactamente lo que se le
 * entregó (`por_mes`), y el resto del interés de ese mes se reparte entre los demás con
 * la regla del ciclo. Lo que se cobre después de su salida ya no le toca. En los meses
 * anteriores a la salida el resultado es el mismo de antes: su parte fija es la que ya
 * tenía. Si volvió a la caja, desde el mes siguiente participa como cualquiera.
 */
function calcularDistribucionInteres({
  meses,
  socios,
  transacciones,
  pagosInteres,
  tipo = "diferenciada",
  fijos = {},
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

    // 3. Lo que ya se entregó este mes a quienes salieron (T5): sale del interés del mes
    //    y ellos no entran en el reparto del resto
    const fijoEn = (s) => fijos[s.id] && mes <= fijos[s.id].hasta
    const fijoMes = socios.filter(fijoEn).reduce((t, s) => t + (fijos[s.id].por_mes[mes] ?? 0), 0)
    const distribuible = Math.max(+(interesMes - fijoMes).toFixed(2), 0)
    const libres = socios.filter((s) => !fijoEn(s))
    const capitalLibre = +libres.reduce((t, s) => t + saldos[s.id], 0).toFixed(2)

    // 4. Tasa del mes — el corazón del modelo
    //    Si no hay capital, la tasa es 0 (evita división por cero). Sin salidas en el
    //    mes, distribuible = interés del mes y capitalLibre = capital total
    const tasaMes = capitalLibre > 0 ? +((distribuible / capitalLibre) * 100).toFixed(6) : 0

    // 5. Reparto a cada socio, sin redondear (se redondea el total del ciclo)
    const reparto = {}
    const participantes =
      tipo === "equitativa" ? libres.filter((s) => estuvoEntre(s, `${mes}-01`, corte)) : []
    const parte = participantes.length ? distribuible / participantes.length : 0
    socios.forEach((s) => {
      const cuota = fijoEn(s)
        ? (fijos[s.id].por_mes[mes] ?? 0)
        : tipo === "equitativa"
          ? participantes.includes(s)
            ? parte
            : 0
          : capitalLibre > 0
            ? (distribuible * saldos[s.id]) / capitalLibre
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
    // Quien ya salió de la caja sigue en los ciclos en que estuvo (T24)
    activo: s.activo ?? true,
    fecha_salida: s.fecha_salida ?? null,
    // Su interés de este ciclo ya se le entregó al salir y quedó fijo (T5)
    interes_entregado: Boolean(fijos[s.id]),
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

/**
 * Lo que faltó por cobrar en un ciclo (T25): de las cuotas que vencieron entre `desde` y
 * `hasta` (y antes de `antesDe`, si se da: el ciclo en curso), lo que no se había pagado
 * con los pagos recibidos (solo los del corte). Devuelve el total, la parte de interés,
 * cuántas cuotas y de cuántos créditos.
 */
function faltaPorCobrar(creditos, pagosPorCredito, { desde, hasta, antesDe = null }) {
  let total = 0
  let interes = 0
  let cuotas = 0
  let conFalta = 0
  for (const c of creditos) {
    const { filas } = analizarEstadoCredito(c, pagosPorCredito[c.id] ?? [])
    const debidas = filas.filter(
      (f) =>
        f.fecha_vencimiento >= desde &&
        f.fecha_vencimiento <= hasta &&
        (!antesDe || f.fecha_vencimiento < antesDe) &&
        f.falta_capital + f.falta_interes > 0.001,
    )
    if (debidas.length) conFalta++
    for (const f of debidas) {
      total += f.falta_capital + f.falta_interes
      interes += f.falta_interes
      cuotas++
    }
  }
  return { total: +total.toFixed(2), interes: +interes.toFixed(2), cuotas, creditos: conFalta }
}

module.exports = {
  calcularDistribucionInteres,
  estuvoEntre,
  faltaPorCobrar,
  tipoDeReparto,
  TIPOS_REPARTO,
}
