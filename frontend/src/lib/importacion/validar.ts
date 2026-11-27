// src/lib/importacion/validar.ts
import { MODULOS, type Columna, type ModuloImportacion } from "./modulos"
import type { ArchivoCrudo, Crudo } from "./leer"
import { validarCedula, validarCorreo, validarTelefono, soloDigitos } from "../validacion"
import { normalizar } from "../texto"
import { moneda } from "../format"

/**
 * Valida un archivo leído contra los datos de la caja (T21). Revisa cada celda (tipo,
 * obligatoria, formato), cada fila (fechas dentro de lo posible, socio que exista) y el
 * archivo entero (repetidos, saldos que no quedan en negativo, créditos con más capital
 * pagado que prestado). Le pone a cada fila su ciclo.
 *
 * No depende de exceljs ni de React: se prueba con datos sueltos. La base vuelve a
 * revisar todo al importar (T22); esto es para avisar antes, fila por fila.
 */

export interface Problema {
  hoja: string
  /** Fila de Excel; null si el problema es del archivo entero */
  fila: number | null
  columna?: string
  mensaje: string
}

export interface CicloContexto {
  numero: number
  inicio: string
  fin: string
  cerrado: boolean
}

export interface Contexto {
  /** Hoy en "aaaa-mm-dd" */
  hoy: string
  /** Fundación de la caja; sin ella no hay ciclos y no se importa */
  fundacion: string | null
  ciclos: CicloContexto[]
  socios: {
    id: string
    cedula: string
    nombre: string
    apellido: string
    fecha_ingreso: string
    activo: boolean
  }[]
  cuentas?: { id: string; socio_id: string; saldo: number; estado: string }[]
  fondos?: { id: string; nombre: string; saldo: number; activo: boolean }[]
}

interface Base {
  fila: number
  ciclo: number | null
}

export interface SocioImportado extends Base {
  cedula: string
  nombre: string
  apellido: string
  fecha_ingreso: string
  telefono: string
  email: string
  direccion: string
}

export interface MovimientoAhorroImportado extends Base {
  socio_id: string
  socio: string
  cedula: string
  /** null: el socio no tiene cuenta activa y se le abre una */
  cuenta_id: string | null
  fecha: string
  tipo: "deposito" | "retiro"
  monto: number
  descripcion: string
  saldo_posterior: number
}

export interface PagoImportado extends Base {
  fecha: string
  capital: number
  interes: number
}

export interface CreditoImportado extends Base {
  referencia: number
  socio_id: string
  socio: string
  cedula: string
  monto: number
  tasa_interes: number
  plazo_meses: number
  fecha_desembolso: string
  pagos: PagoImportado[]
  capital_pagado: number
  interes_pagado: number
  estado: "activo" | "pagado"
}

export interface MovimientoFondoImportado extends Base {
  /** Nombre como está en DOMUS o, si es nuevo, como viene en el archivo */
  fondo: string
  /** null: el fondo no existe y se crea */
  fondo_id: string | null
  fecha: string
  tipo: "deposito" | "retiro"
  monto: number
  descripcion: string
  saldo_posterior: number
}

export type Datos =
  | { modulo: "socios"; socios: SocioImportado[] }
  | { modulo: "ahorros"; movimientos: MovimientoAhorroImportado[] }
  | { modulo: "creditos"; creditos: CreditoImportado[] }
  | { modulo: "fondos"; movimientos: MovimientoFondoImportado[] }

export interface Validacion {
  errores: Problema[]
  avisos: Problema[]
  /** Filas con datos, de todas las hojas */
  filas: number
  datos: Datos
}

// ── Conversión de celdas ─────────────────────────────────────────

type Conv<T> = { valor: T } | { error: string }

const ISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

function fechaValida(y: number, m: number, d: number) {
  const f = new Date(Date.UTC(y, m - 1, d))
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d
}

/**
 * Fecha de Excel a "aaaa-mm-dd". Acepta una celda de fecha (exceljs la da en UTC), el
 * número de serie de Excel, y texto "15/03/2024", "15-03-2024" o "2024-03-15".
 */
export function aFecha(v: Crudo): Conv<string> {
  const mal = { error: "Escribe la fecha como día/mes/año, por ejemplo 15/03/2024" }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return mal
    return { valor: ISO(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) }
  }
  if (typeof v === "number") {
    // Serie de Excel: días desde el 30/12/1899
    if (!Number.isInteger(v) || v < 1 || v > 2958465) return mal
    const f = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return { valor: ISO(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()) }
  }
  const t = String(v).trim()
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const [d, mes, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return fechaValida(y, mes, d) ? { valor: ISO(y, mes, d) } : mal
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [y, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return fechaValida(y, mes, d) ? { valor: ISO(y, mes, d) } : mal
  }
  return mal
}

/**
 * Número de una celda. Acepta número de Excel o texto con coma o punto decimal
 * ("1.234,56", "1234.56", "$ 25"). Devuelve el número sin redondear.
 */
export function aNumero(v: Crudo): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null
  if (v instanceof Date || v === null) return null
  let t = String(v).replace(/[$\s]/g, "")
  if (!t) return null
  const coma = t.lastIndexOf(",")
  const punto = t.lastIndexOf(".")
  if (coma >= 0 && punto >= 0) {
    // El último separador es el decimal; el otro, de miles
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "")
  } else if (coma >= 0) {
    t = t.replace(",", ".")
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** Monto en dólares con hasta dos decimales. Excel guarda 83,33 como 83.3299999…: se tolera */
function aMonto(v: Crudo, permiteCero: boolean): Conv<number> {
  const n = aNumero(v)
  if (n === null) return { error: "Escribe un número, sin letras" }
  const centavos = Math.round(n * 100)
  if (Math.abs(n * 100 - centavos) > 1e-6) return { error: "Usa como máximo dos decimales" }
  if (permiteCero ? centavos < 0 : centavos <= 0) {
    return { error: permiteCero ? "No puede ser negativo" : "Debe ser mayor que 0" }
  }
  if (centavos > 99999999999) return { error: "El monto es demasiado grande" }
  return { valor: centavos / 100 }
}

function aEntero(v: Crudo, min: number, max: number): Conv<number> {
  const n = aNumero(v)
  if (n === null || !Number.isInteger(n)) return { error: "Escribe un número entero" }
  if (n < min || n > max) return { error: `Va de ${min} a ${max}` }
  return { valor: n }
}

function aTexto(v: Crudo): string {
  if (v === null) return ""
  if (v instanceof Date) return ""
  return String(v).trim()
}

/** Cédula como texto de 10 dígitos. Si Excel la guardó como número, se le devuelve el 0 */
export function aCedula(v: Crudo): Conv<string> {
  let t = typeof v === "number" ? String(v) : soloDigitos(aTexto(v))
  if (typeof v === "number" && t.length === 9) t = "0" + t
  const error = validarCedula(t)
  return error ? { error } : { valor: t }
}

// ── Validación ───────────────────────────────────────────────────

export function validar(
  modulo: ModuloImportacion,
  archivo: ArchivoCrudo,
  ctx: Contexto,
): Validacion {
  const r = revisar(modulo, archivo, ctx)
  // En el orden del archivo: primero lo del archivo entero, después hoja por hoja y fila por fila
  const orden = MODULOS[modulo].hojas.map((h) => h.nombre)
  const comparar = (a: Problema, b: Problema) =>
    (a.fila === null ? -1 : orden.indexOf(a.hoja)) -
      (b.fila === null ? -1 : orden.indexOf(b.hoja)) || (a.fila ?? 0) - (b.fila ?? 0)
  r.errores.sort(comparar)
  r.avisos.sort(comparar)
  return r
}

function revisar(modulo: ModuloImportacion, archivo: ArchivoCrudo, ctx: Contexto): Validacion {
  const errores: Problema[] = archivo.errores.map((mensaje) => ({ hoja: "", fila: null, mensaje }))
  const avisos: Problema[] = []
  const def = MODULOS[modulo]
  const filas = Object.values(archivo.hojas).reduce((s, h) => s + h.filas.length, 0)

  const vacio = (): Datos =>
    modulo === "socios"
      ? { modulo, socios: [] }
      : modulo === "creditos"
        ? { modulo, creditos: [] }
        : { modulo, movimientos: [] }

  if (!ctx.fundacion) {
    errores.push({
      hoja: "",
      fila: null,
      mensaje:
        "La caja no tiene fecha de fundación. Configúrala en Configuración, Periodo de la caja: sin ella no se sabe en qué ciclo cae cada fila.",
    })
  }
  if (errores.length) return { errores, avisos, filas, datos: vacio() }
  if (filas === 0) {
    errores.push({
      hoja: "",
      fila: null,
      mensaje: "El archivo no tiene datos: llena la plantilla desde la fila 2.",
    })
    return { errores, avisos, filas, datos: vacio() }
  }

  const fundacion = ctx.fundacion as string
  const cicloDe = (f: string) => ctx.ciclos.find((c) => c.inicio <= f && f <= c.fin)?.numero ?? null
  const sociosPorCedula = new Map(ctx.socios.map((s) => [s.cedula, s]))
  const nombre = (s: { nombre: string; apellido: string }) => `${s.nombre} ${s.apellido}`

  /** Convierte las celdas de una fila según sus columnas; anota los errores */
  function leerFila(
    hoja: string,
    fila: number,
    columnas: Columna[],
    celdas: Record<string, Crudo>,
  ) {
    const valores: Record<string, string | number> = {}
    let ok = true
    const error = (c: Columna, mensaje: string) => {
      errores.push({ hoja, fila, columna: c.encabezado, mensaje })
      ok = false
    }
    for (const c of columnas) {
      const v = celdas[c.clave]
      if (v === null || v === undefined) {
        if (c.obligatoria) {
          error(
            c,
            c.tipo === "fecha"
              ? "Falta la fecha. Si no la sabes, pon una aproximada para que los cálculos del ciclo salgan realistas"
              : "Falta este dato",
          )
        } else valores[c.clave] = ""
        continue
      }
      let r: Conv<string | number>
      switch (c.tipo) {
        case "cedula":
          r = aCedula(v)
          break
        case "fecha": {
          r = aFecha(v)
          if ("valor" in r) {
            if (r.valor > ctx.hoy) r = { error: "La fecha es posterior a hoy" }
            else if (r.valor < fundacion) {
              r = { error: `La fecha es anterior a la fundación de la caja (${dma(fundacion)})` }
            }
          }
          break
        }
        case "monto":
        case "monto0":
          r = aMonto(v, c.tipo === "monto0")
          break
        case "porcentaje": {
          const n = aNumero(v)
          r =
            n === null
              ? { error: "Escribe un número, sin el signo %" }
              : n < 0.01 || n > 100
                ? { error: "La tasa va de 0,01 a 100" }
                : Math.abs(n * 100 - Math.round(n * 100)) > 1e-6
                  ? { error: "Usa como máximo dos decimales" }
                  : { valor: n }
          break
        }
        case "entero":
          r = c.clave === "plazo_meses" ? aEntero(v, 1, 120) : aEntero(v, 1, 999999)
          break
        case "lista": {
          const t = normalizar(aTexto(v))
          const op = (c.opciones ?? []).find((o) => normalizar(o) === t)
          r = op ? { valor: op } : { error: `Escribe ${(c.opciones ?? []).join(" o ")}` }
          break
        }
        default:
          r = { valor: aTexto(v) }
      }
      if ("error" in r) error(c, r.error)
      else valores[c.clave] = r.valor
    }
    return ok ? valores : null
  }

  function socioDe(hoja: string, fila: number, cedula: string, fecha: string, queFecha: string) {
    const s = sociosPorCedula.get(cedula)
    if (!s) {
      errores.push({
        hoja,
        fila,
        columna: "Cédula",
        mensaje: `No hay un socio con la cédula ${cedula} en la caja. Regístralo o impórtalo primero en Socios`,
      })
      return null
    }
    if (!s.activo) {
      errores.push({ hoja, fila, columna: "Cédula", mensaje: `${nombre(s)} está inactivo` })
      return null
    }
    if (fecha < s.fecha_ingreso) {
      errores.push({
        hoja,
        fila,
        mensaje: `${queFecha} es anterior al ingreso de ${nombre(s)} (${dma(s.fecha_ingreso)})`,
      })
      return null
    }
    return s
  }

  const [h1, h2] = def.hojas
  const filas1 = archivo.hojas[h1.nombre]?.filas ?? []

  // ── Socios ─────────────────────────────────────────────────────
  if (modulo === "socios") {
    const socios: SocioImportado[] = []
    const vistas = new Map<string, number>()
    for (const { fila, celdas } of filas1) {
      const v = leerFila(h1.nombre, fila, h1.columnas, celdas)
      if (!v) continue
      const cedula = v.cedula as string
      const yaEsta = sociosPorCedula.get(cedula)
      if (yaEsta) {
        errores.push({
          hoja: h1.nombre,
          fila,
          columna: "Cédula",
          mensaje: `Ya está en la caja: ${nombre(yaEsta)}`,
        })
        continue
      }
      if (vistas.has(cedula)) {
        errores.push({
          hoja: h1.nombre,
          fila,
          columna: "Cédula",
          mensaje: `Repetida: también está en la fila ${vistas.get(cedula)}`,
        })
        continue
      }
      vistas.set(cedula, fila)
      const tel = validarTelefono(String(v.telefono))
      const correo = validarCorreo(String(v.email))
      if (tel) errores.push({ hoja: h1.nombre, fila, columna: "Teléfono", mensaje: tel })
      if (correo) errores.push({ hoja: h1.nombre, fila, columna: "Correo", mensaje: correo })
      if (tel || correo) continue
      socios.push({
        fila,
        ciclo: cicloDe(v.fecha_ingreso as string),
        cedula,
        nombre: String(v.nombre),
        apellido: String(v.apellido),
        fecha_ingreso: v.fecha_ingreso as string,
        telefono: soloDigitos(String(v.telefono)),
        email: String(v.email),
        direccion: String(v.direccion),
      })
    }
    return { errores, avisos, filas, datos: { modulo, socios } }
  }

  // ── Ahorros ────────────────────────────────────────────────────
  if (modulo === "ahorros") {
    const movimientos: MovimientoAhorroImportado[] = []
    for (const { fila, celdas } of filas1) {
      const v = leerFila(h1.nombre, fila, h1.columnas, celdas)
      if (!v) continue
      const s = socioDe(h1.nombre, fila, v.cedula as string, v.fecha as string, "La fecha")
      if (!s) continue
      const activas = (ctx.cuentas ?? []).filter(
        (c) => c.socio_id === s.id && c.estado === "activa",
      )
      if (activas.length > 1) {
        errores.push({
          hoja: h1.nombre,
          fila,
          columna: "Cédula",
          mensaje: `${nombre(s)} tiene ${activas.length} cuentas activas: la importación no sabe en cuál poner el movimiento`,
        })
        continue
      }
      movimientos.push({
        fila,
        ciclo: cicloDe(v.fecha as string),
        socio_id: s.id,
        socio: nombre(s),
        cedula: s.cedula,
        cuenta_id: activas[0]?.id ?? null,
        fecha: v.fecha as string,
        tipo: v.tipo === "Depósito" ? "deposito" : "retiro",
        monto: v.monto as number,
        descripcion: String(v.descripcion),
        saldo_posterior: 0,
      })
    }
    // Saldos en orden de fecha (y de fila en el mismo día), desde el saldo de hoy
    simularSaldos(
      movimientos,
      (m) => m.socio_id,
      (m) => Number(ctx.cuentas?.find((c) => c.id === m.cuenta_id)?.saldo ?? 0),
      (m, antes) =>
        `El ${dma(m.fecha)} la cuenta de ${m.socio} tiene ${moneda(antes)}: no alcanza para retirar ${moneda(m.monto)}`,
      h1.nombre,
      errores,
    )
    for (const id of new Set(movimientos.filter((m) => !m.cuenta_id).map((m) => m.socio_id))) {
      const m = movimientos.find((x) => x.socio_id === id)!
      avisos.push({
        hoja: h1.nombre,
        fila: m.fila,
        mensaje: `${m.socio} no tiene cuenta de ahorro activa: se le abrirá una`,
      })
    }
    return { errores, avisos, filas, datos: { modulo, movimientos } }
  }

  // ── Fondos ─────────────────────────────────────────────────────
  if (modulo === "fondos") {
    const movimientos: MovimientoFondoImportado[] = []
    const fondos = ctx.fondos ?? []
    for (const { fila, celdas } of filas1) {
      const v = leerFila(h1.nombre, fila, h1.columnas, celdas)
      if (!v) continue
      const nombreFondo = String(v.fondo).replace(/\s+/g, " ")
      const desc = String(v.descripcion)
      if (nombreFondo.length < 3 || nombreFondo.length > 60) {
        errores.push({
          hoja: h1.nombre,
          fila,
          columna: "Fondo",
          mensaje: "El nombre del fondo va de 3 a 60 caracteres",
        })
        continue
      }
      if (desc.length < 3 || desc.length > 200) {
        errores.push({
          hoja: h1.nombre,
          fila,
          columna: "Descripción",
          mensaje: "La descripción va de 3 a 200 caracteres",
        })
        continue
      }
      const existente = fondos.find((f) => normalizar(f.nombre.trim()) === normalizar(nombreFondo))
      if (existente && !existente.activo) {
        errores.push({
          hoja: h1.nombre,
          fila,
          columna: "Fondo",
          mensaje: `${existente.nombre} está cerrado. Ábrelo de nuevo en Fondos antes de importar`,
        })
        continue
      }
      // El mismo fondo nuevo escrito distinto en dos filas se junta con el primero
      const previo = movimientos.find(
        (m) => !m.fondo_id && normalizar(m.fondo) === normalizar(nombreFondo),
      )
      movimientos.push({
        fila,
        ciclo: cicloDe(v.fecha as string),
        fondo: existente?.nombre ?? previo?.fondo ?? nombreFondo,
        fondo_id: existente?.id ?? null,
        fecha: v.fecha as string,
        tipo: v.tipo === "Depósito" ? "deposito" : "retiro",
        monto: v.monto as number,
        descripcion: desc,
        saldo_posterior: 0,
      })
    }
    simularSaldos(
      movimientos,
      (m) => normalizar(m.fondo),
      (m) => Number(fondos.find((f) => f.id === m.fondo_id)?.saldo ?? 0),
      (m, antes) =>
        `El ${dma(m.fecha)} ${m.fondo} tiene ${moneda(antes)}: no alcanza para retirar ${moneda(m.monto)}`,
      h1.nombre,
      errores,
    )
    for (const nombreNuevo of new Set(movimientos.filter((m) => !m.fondo_id).map((m) => m.fondo))) {
      const m = movimientos.find((x) => x.fondo === nombreNuevo)!
      avisos.push({
        hoja: h1.nombre,
        fila: m.fila,
        mensaje: `${nombreNuevo} no existe en DOMUS: se creará`,
      })
    }
    return { errores, avisos, filas, datos: { modulo, movimientos } }
  }

  // ── Créditos y pagos ───────────────────────────────────────────
  const creditos: CreditoImportado[] = []
  const porReferencia = new Map<number, CreditoImportado>()
  const referenciasConError = new Set<number>()
  for (const { fila, celdas } of filas1) {
    const ref = aNumero(celdas.referencia)
    const v = leerFila(h1.nombre, fila, h1.columnas, celdas)
    if (!v) {
      if (ref !== null) referenciasConError.add(ref)
      continue
    }
    const referencia = v.referencia as number
    const previo = porReferencia.get(referencia)
    if (previo || referenciasConError.has(referencia)) {
      errores.push({
        hoja: h1.nombre,
        fila,
        columna: "N.º",
        mensaje: previo
          ? `Repetido: el N.º ${referencia} ya está en la fila ${previo.fila}`
          : `Repetido: el N.º ${referencia} ya se usó`,
      })
      continue
    }
    const s = socioDe(
      h1.nombre,
      fila,
      v.cedula as string,
      v.fecha_desembolso as string,
      "El desembolso",
    )
    if (!s) {
      referenciasConError.add(referencia)
      continue
    }
    const credito: CreditoImportado = {
      fila,
      ciclo: cicloDe(v.fecha_desembolso as string),
      referencia,
      socio_id: s.id,
      socio: nombre(s),
      cedula: s.cedula,
      monto: v.monto as number,
      tasa_interes: v.tasa_interes as number,
      plazo_meses: v.plazo_meses as number,
      fecha_desembolso: v.fecha_desembolso as string,
      pagos: [],
      capital_pagado: 0,
      interes_pagado: 0,
      estado: "activo",
    }
    porReferencia.set(referencia, credito)
    creditos.push(credito)
  }

  for (const { fila, celdas } of archivo.hojas[h2.nombre]?.filas ?? []) {
    const v = leerFila(h2.nombre, fila, h2.columnas, celdas)
    if (!v) continue
    const referencia = v.referencia as number
    const c = porReferencia.get(referencia)
    if (!c) {
      // Si el crédito tiene su propio error, basta con ese
      if (!referenciasConError.has(referencia)) {
        errores.push({
          hoja: h2.nombre,
          fila,
          columna: "N.º del crédito",
          mensaje: `No hay un crédito con el N.º ${referencia} en la hoja Créditos`,
        })
      }
      continue
    }
    const capital = v.capital as number
    const interes = v.interes as number
    if (capital === 0 && interes === 0) {
      errores.push({
        hoja: h2.nombre,
        fila,
        mensaje: "El pago necesita capital o interés mayor que 0",
      })
      continue
    }
    if ((v.fecha as string) < c.fecha_desembolso) {
      errores.push({
        hoja: h2.nombre,
        fila,
        columna: "Fecha",
        mensaje: `Es anterior al desembolso del crédito N.º ${referencia} (${dma(c.fecha_desembolso)})`,
      })
      continue
    }
    c.pagos.push({
      fila,
      ciclo: cicloDe(v.fecha as string),
      fecha: v.fecha as string,
      capital,
      interes,
    })
  }

  for (const c of creditos) {
    c.pagos.sort((a, b) => (a.fecha === b.fecha ? a.fila - b.fila : a.fecha < b.fecha ? -1 : 1))
    const capital = c.pagos.reduce((s, p) => s + Math.round(p.capital * 100), 0)
    const interes = c.pagos.reduce((s, p) => s + Math.round(p.interes * 100), 0)
    c.capital_pagado = capital / 100
    c.interes_pagado = interes / 100
    const monto = Math.round(c.monto * 100)
    if (capital > monto) {
      errores.push({
        hoja: h2.nombre,
        fila: c.pagos[c.pagos.length - 1].fila,
        mensaje: `Los pagos del crédito N.º ${c.referencia} suman ${moneda(capital / 100)} de capital, más que los ${moneda(c.monto)} prestados`,
      })
    }
    c.estado = capital >= monto ? "pagado" : "activo"
    if (!c.pagos.length) {
      avisos.push({
        hoja: h1.nombre,
        fila: c.fila,
        mensaje: `El crédito N.º ${c.referencia} no tiene pagos en la hoja Pagos: entra sin nada pagado`,
      })
    }
  }
  return { errores, avisos, filas, datos: { modulo: "creditos", creditos } }
}

/**
 * Recorre los movimientos de cada cuenta o fondo en orden de fecha y anota el saldo
 * después de cada uno. Un retiro que deja el saldo en negativo es un error en su fila.
 */
function simularSaldos<
  T extends { fila: number; fecha: string; tipo: string; monto: number; saldo_posterior: number },
>(
  movs: T[],
  clave: (m: T) => string,
  saldoInicial: (m: T) => number,
  /** Recibe el saldo antes del retiro que no alcanza */
  mensaje: (m: T, antes: number) => string,
  hoja: string,
  errores: Problema[],
) {
  const grupos = new Map<string, T[]>()
  for (const m of movs) grupos.set(clave(m), [...(grupos.get(clave(m)) ?? []), m])
  for (const lista of grupos.values()) {
    lista.sort((a, b) => (a.fecha === b.fecha ? a.fila - b.fila : a.fecha < b.fecha ? -1 : 1))
    let saldo = Math.round(saldoInicial(lista[0]) * 100)
    for (const m of lista) {
      const antes = saldo
      saldo += (m.tipo === "deposito" ? 1 : -1) * Math.round(m.monto * 100)
      m.saldo_posterior = saldo / 100
      if (saldo < 0) {
        errores.push({ hoja, fila: m.fila, columna: "Monto", mensaje: mensaje(m, antes / 100) })
        break
      }
    }
  }
}

function dma(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
