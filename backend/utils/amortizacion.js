// backend/utils/amortizacion.js

/**
 * Suma meses a una fecha y devuelve el último día de ese mes.
 * Desembolso julio → cuota 1 vence 31-ago, cuota 2 vence 30-sep, etc.
 */
function calcularVencimiento(fechaDesembolso, numeroCuota) {
  const base = new Date(fechaDesembolso + "T00:00:00")
  // Día 0 del mes siguiente = último día del mes objetivo
  const venc = new Date(base.getFullYear(), base.getMonth() + numeroCuota + 1, 0)
  const y = venc.getFullYear()
  const m = String(venc.getMonth() + 1).padStart(2, "0")
  const d = String(venc.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Tabla de amortización con interés simple.
 * La última cuota absorbe el ajuste de redondeo.
 */
function generarTablaAmortizacion(capital, tasaAnual, plazoMeses, fechaDesembolso = null) {
  const montoTotal = +(capital * (1 + (tasaAnual / 100) * (plazoMeses / 12))).toFixed(2)
  const interesTotal = +(montoTotal - capital).toFixed(2)

  const capitalCuota = +(capital / plazoMeses).toFixed(2)
  const interesCuota = +(interesTotal / plazoMeses).toFixed(2)

  const tabla = []
  let capitalAcum = 0
  let interesAcum = 0
  let saldo = montoTotal

  for (let i = 1; i <= plazoMeses; i++) {
    let capitalDelMes, interesDelMes

    if (i < plazoMeses) {
      capitalDelMes = capitalCuota
      interesDelMes = interesCuota
    } else {
      capitalDelMes = +(capital - capitalAcum).toFixed(2)
      interesDelMes = +(interesTotal - interesAcum).toFixed(2)
    }

    const cuotaDelMes = +(capitalDelMes + interesDelMes).toFixed(2)

    capitalAcum = +(capitalAcum + capitalDelMes).toFixed(2)
    interesAcum = +(interesAcum + interesDelMes).toFixed(2)
    saldo = +(saldo - cuotaDelMes).toFixed(2)

    tabla.push({
      numero_cuota: i,
      capital: capitalDelMes,
      interes: interesDelMes,
      cuota: cuotaDelMes,
      saldo_restante: saldo < 0 ? 0 : saldo,
      fecha_vencimiento: fechaDesembolso ? calcularVencimiento(fechaDesembolso, i) : null,
    })
  }

  return {
    capital,
    tasa_anual: tasaAnual,
    plazo_meses: plazoMeses,
    monto_total: montoTotal,
    interes_total: interesTotal,
    tabla,
  }
}

/**
 * ¿Está vencida? Solo si YA PASÓ el mes de vencimiento.
 * Vence 31-ago → en agosto NO está vencida, en septiembre SÍ.
 */
function estaVencida(fechaVencimiento, hoy = new Date()) {
  if (!fechaVencimiento) return false
  const venc = new Date(fechaVencimiento + "T00:00:00")
  // Compara año-mes: vencida solo si el mes actual es posterior
  const mesVenc = venc.getFullYear() * 12 + venc.getMonth()
  const mesHoy = hoy.getFullYear() * 12 + hoy.getMonth()
  return mesHoy > mesVenc
}

/**
 * Analiza el estado real del crédito cruzando la tabla con los pagos.
 * Devuelve qué cuota toca pagar, cuáles están vencidas y cuáles prepagadas.
 */
function analizarEstadoCredito(credito, pagos) {
  const { tabla } = generarTablaAmortizacion(
    parseFloat(credito.monto_solicitado),
    parseFloat(credito.tasa_interes),
    credito.plazo_meses,
    credito.fecha_desembolso,
  )

  // Agrupa pagos por cuota — ahora también recoge abonos y motivos
  const pagadoPorCuota = {}
  ;(pagos ?? []).forEach((p) => {
    const n = p.numero_cuota
    if (!pagadoPorCuota[n]) {
      pagadoPorCuota[n] = {
        capital: 0,
        interes: 0,
        prepago: false,
        fechas: [],
        movimientos: [], // ← renombrado: todos los pagos, no solo abonos
      }
    }
    pagadoPorCuota[n].capital += parseFloat(p.monto_capital ?? 0)
    pagadoPorCuota[n].interes += parseFloat(p.monto_interes ?? 0)
    if (p.es_prepago) pagadoPorCuota[n].prepago = true
    pagadoPorCuota[n].fechas.push(p.fecha_pago)

    // Guarda TODOS los movimientos de la cuota
    pagadoPorCuota[n].movimientos.push({
      monto: parseFloat(p.monto_pagado),
      capital: parseFloat(p.monto_capital ?? 0),
      interes: parseFloat(p.monto_interes ?? 0),
      es_abono: !!p.es_abono,
      es_prepago: !!p.es_prepago,
      motivo: p.motivo ?? null,
      fecha_pago: p.fecha_pago,
    })
  })

  const hoy = new Date()

  const filas = tabla.map((f) => {
    const pagado = pagadoPorCuota[f.numero_cuota] ?? {
      capital: 0,
      interes: 0,
      prepago: false,
      fechas: [],
      movimientos: [],
    }

    const esPrepago = pagado.prepago
    const interesEsperado = esPrepago ? 0 : f.interes

    const faltaCapital = +(f.capital - pagado.capital).toFixed(2)
    const faltaInteres = +(interesEsperado - pagado.interes).toFixed(2)

    const completa = faltaCapital <= 0.001 && faltaInteres <= 0.001
    const parcial = !completa && (pagado.capital > 0 || pagado.interes > 0)
    const vencida = !completa && estaVencida(f.fecha_vencimiento, hoy)

    return {
      ...f,
      interes: interesEsperado,
      interes_condonado: esPrepago ? f.interes : 0,
      cuota: +(f.capital + interesEsperado).toFixed(2),
      capital_pagado: +pagado.capital.toFixed(2),
      interes_pagado: +pagado.interes.toFixed(2),
      falta_capital: faltaCapital > 0 ? faltaCapital : 0,
      falta_interes: faltaInteres > 0 ? faltaInteres : 0,
      pagada: completa,
      parcial,
      vencida,
      es_prepago: esPrepago,
      movimientos: pagado.movimientos, // ← todos
      abonos: pagado.movimientos.filter((m) => m.es_abono), // ← solo abonos
      tiene_abonos: pagado.movimientos.some((m) => m.es_abono),
      // Muestra el detalle solo si hubo más de un pago en la cuota
      es_fraccionada: pagado.movimientos.length > 1,
      fecha_pago: pagado.fechas.length ? pagado.fechas[pagado.fechas.length - 1] : null,
    }
  })

  const cuotaCorriente = filas.find((f) => !f.pagada && !f.es_prepago) ?? null
  const vencidas = filas.filter((f) => f.vencida)
  const adelanto = estadoAdelanto(filas, cuotaCorriente, vencidas, hoy)

  const interesCondonadoTotal = +filas.reduce((s, f) => s + f.interes_condonado, 0).toFixed(2)

  // Cuenta cuántos abonos tiene el crédito en total — señal de recurrencia
  const totalAbonos = filas.reduce((s, f) => s + f.abonos.length, 0)

  return { filas, cuotaCorriente, vencidas, adelanto, interesCondonadoTotal, totalAbonos }
}

/** Año y mes de una fecha "AAAA-MM-DD" (o de un Date) como un solo número, para comparar meses */
function mesDe(fecha) {
  const d = typeof fecha === "string" ? new Date(fecha + "T00:00:00") : fecha
  return d.getFullYear() * 12 + d.getMonth()
}

/**
 * Si se puede hacer un pago adelantado y hasta cuánto (T30). Reglas del 26 nov:
 * - el crédito tiene que estar igualado: sin cuotas vencidas y con la cuota que vence
 *   este mes ya pagada;
 * - la próxima cuota por pagar no se adelanta: se paga en su mes;
 * - se adelantan las cuotas siguientes, desde la última hacia atrás.
 *
 * Devuelve { bloqueo } con el motivo para la persona, o { maximo, cuotas } con las
 * cuotas que se pueden adelantar, de la última a la primera.
 */
function estadoAdelanto(filas, cuotaCorriente, vencidas, hoy = new Date()) {
  if (vencidas.length > 0) {
    return {
      bloqueo: `Hay ${vencidas.length === 1 ? "una cuota vencida" : `${vencidas.length} cuotas vencidas`}. Primero se paga lo atrasado; después se puede adelantar.`,
    }
  }
  const mesHoy = mesDe(hoy)
  const delMes = filas.find(
    (f) => !f.pagada && f.fecha_vencimiento && mesDe(f.fecha_vencimiento) <= mesHoy,
  )
  if (delMes) {
    return {
      bloqueo: `Primero se paga la cuota ${delMes.numero_cuota}, que vence este mes: para adelantar, el crédito tiene que estar al día.`,
    }
  }
  const cuotas = filas
    .filter(
      (f) =>
        !f.pagada &&
        f.falta_capital > 0 &&
        cuotaCorriente &&
        f.numero_cuota > cuotaCorriente.numero_cuota &&
        f.fecha_vencimiento &&
        mesDe(f.fecha_vencimiento) > mesHoy,
    )
    .reverse()
    .map((f) => ({
      numero_cuota: f.numero_cuota,
      falta_capital: f.falta_capital,
      interes: f.falta_interes,
    }))
  if (cuotas.length === 0) {
    return {
      bloqueo: "No hay cuotas para adelantar: solo queda la próxima cuota, que se paga en su mes.",
    }
  }
  const centavos = cuotas.reduce((s, c) => s + Math.round(c.falta_capital * 100), 0)
  return { maximo: centavos / 100, cuotas }
}

/**
 * Reparte un adelanto de capital desde la última cuota hacia atrás (T30). `cuotas` es la
 * lista de estadoAdelanto, ya de la última a la primera. Una cuota cubierta entera
 * condona su interés; la que queda a medias recibe solo capital y conserva su interés.
 * Lo mismo calcula el frontend para la vista previa (lib/adelanto.ts).
 *
 * Devuelve las partes [{ numero_cuota, capital, interes_condonado }] o null si el monto
 * no es mayor que 0 o supera lo que se puede adelantar.
 */
function planAdelanto(cuotas, monto) {
  let resto = Math.round(monto * 100)
  const total = cuotas.reduce((s, c) => s + Math.round(c.falta_capital * 100), 0)
  if (!(resto > 0) || resto > total) return null
  const partes = []
  for (const c of cuotas) {
    if (resto <= 0) break
    const falta = Math.round(c.falta_capital * 100)
    if (resto >= falta) {
      partes.push({
        numero_cuota: c.numero_cuota,
        capital: falta / 100,
        interes_condonado: c.interes,
      })
      resto -= falta
    } else {
      partes.push({ numero_cuota: c.numero_cuota, capital: resto / 100, interes_condonado: 0 })
      resto = 0
    }
  }
  return partes
}

module.exports = {
  generarTablaAmortizacion,
  calcularVencimiento,
  estaVencida,
  analizarEstadoCredito,
  estadoAdelanto,
  planAdelanto,
}
