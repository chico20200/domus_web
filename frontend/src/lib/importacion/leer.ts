// src/lib/importacion/leer.ts
import type { CellValue } from "exceljs"
import { MODULOS, type ModuloImportacion } from "./modulos"
import { normalizar } from "../texto"

/**
 * Lee un .xlsx lleno con la plantilla de un módulo (T21). Solo saca los valores de las
 * celdas; qué vale y qué no lo decide `validar.ts`, que no depende de exceljs y se puede
 * probar aparte.
 */

/** Valor de una celda tal como viene: texto, número, fecha o vacío */
export type Crudo = string | number | Date | null

export interface FilaCruda {
  /** Número de fila en Excel, para los mensajes ("fila 7") */
  fila: number
  celdas: Record<string, Crudo>
}

export interface HojaCruda {
  nombre: string
  filas: FilaCruda[]
}

export interface ArchivoCrudo {
  hojas: Record<string, HojaCruda>
  /** Problemas del archivo entero: hoja que falta, encabezados cambiados */
  errores: string[]
}

/** Más filas no caben en una importación de una vez */
export const MAX_FILAS = 2000
/** 5 MB: una plantilla llena con 2.000 filas pesa unos 200 kB */
export const MAX_BYTES = 5 * 1024 * 1024

const quitarOpcional = (t: string) => normalizar(t.replace(/\(opcional\)/i, "")).trim()

export async function leerArchivo(archivo: File, modulo: ModuloImportacion): Promise<ArchivoCrudo> {
  const def = MODULOS[modulo]
  const errores: string[] = []
  const hojas: Record<string, HojaCruda> = {}

  if (!/\.xlsx$/i.test(archivo.name)) {
    return {
      hojas,
      errores: ["El archivo debe ser un Excel .xlsx. Guárdalo con ese formato y súbelo de nuevo."],
    }
  }
  if (archivo.size > MAX_BYTES) {
    return {
      hojas,
      errores: ["El archivo pesa más de 5 MB. Revisa que sea la plantilla de DOMUS."],
    }
  }

  const { default: ExcelJS } = await import("exceljs")
  const libro = new ExcelJS.Workbook()
  try {
    await libro.xlsx.load(await archivo.arrayBuffer())
  } catch {
    return {
      hojas,
      errores: ["No se pudo abrir el archivo. Revisa que sea un Excel .xlsx que se abra bien."],
    }
  }

  for (const h of def.hojas) {
    const ws = libro.worksheets.find((w) => normalizar(w.name) === normalizar(h.nombre))
    if (!ws) {
      errores.push(
        `Falta la hoja «${h.nombre}». Usa la plantilla de ${def.titulo} sin cambiarle el nombre a las hojas.`,
      )
      continue
    }

    // Encabezados: los mismos y en el mismo orden que la plantilla
    const cab = ws.getRow(1)
    const malos = h.columnas.filter(
      (c, i) => quitarOpcional(texto(cab.getCell(i + 1).value)) !== quitarOpcional(c.encabezado),
    )
    if (malos.length) {
      errores.push(
        `En la hoja «${h.nombre}» cambiaron los encabezados: se esperaba ${h.columnas.map((c) => `«${c.encabezado}»`).join(", ")}, en ese orden.`,
      )
      continue
    }

    const filas: FilaCruda[] = []
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return
      const celdas: Record<string, Crudo> = {}
      let alguna = false
      h.columnas.forEach((c, i) => {
        const v = crudo(row.getCell(i + 1).value)
        celdas[c.clave] = v
        if (v !== null) alguna = true
      })
      if (alguna) filas.push({ fila: n, celdas })
    })
    if (filas.length > MAX_FILAS) {
      errores.push(
        `La hoja «${h.nombre}» tiene ${filas.length} filas; el máximo es ${MAX_FILAS}. Divídela en dos archivos.`,
      )
    }
    hojas[h.nombre] = { nombre: h.nombre, filas }
  }

  return { hojas, errores }
}

/** Valor de la celda sin formato: resuelve fórmulas, texto enriquecido y enlaces */
function crudo(v: CellValue): Crudo {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === "number") return v
  if (typeof v === "string") return v.trim() === "" ? null : v.trim()
  if (typeof v === "boolean") return String(v)
  if (typeof v === "object") {
    if ("result" in v) return crudo((v.result ?? null) as CellValue)
    if ("richText" in v) return crudo(v.richText.map((r) => r.text).join(""))
    if ("text" in v) return crudo(String(v.text))
    if ("error" in v) return null
  }
  return null
}

function texto(v: CellValue): string {
  const c = crudo(v)
  return c === null ? "" : String(c)
}
