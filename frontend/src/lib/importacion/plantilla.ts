// src/lib/importacion/plantilla.ts
import type { Worksheet } from "exceljs"
import { MODULOS, type Columna, type ModuloImportacion } from "./modulos"
import { descargarBlob, TIPO_XLSX } from "../descargar"

/**
 * Arma y descarga la plantilla de Excel de un módulo (T20). La primera hoja explica cómo
 * llenarla; las siguientes son las hojas de datos, con encabezados fijos y sin filas de
 * ejemplo (los ejemplos van en las instrucciones, así no se importan por error).
 *
 * exceljs pesa cerca de 1 MB: se carga solo al descargar o leer un archivo.
 */

/** Filas con validación y formato en cada hoja de datos */
const FILAS = 2000

const NARANJA = "FFB26000" // el mismo de los PDF (ESTADO, 12 nov)

const FORMATO: Partial<Record<Columna["tipo"], string>> = {
  cedula: "@",
  texto: "@",
  fecha: "dd/mm/yyyy",
  monto: "#,##0.00",
  monto0: "#,##0.00",
  porcentaje: "0.00",
  entero: "0",
}

export async function descargarPlantilla(modulo: ModuloImportacion) {
  const { default: ExcelJS } = await import("exceljs")
  const def = MODULOS[modulo]
  const libro = new ExcelJS.Workbook()
  libro.creator = "DOMUS"
  libro.created = new Date()

  // ── Instrucciones ──────────────────────────────────────────────
  const ins = libro.addWorksheet("Instrucciones", {
    views: [{ showGridLines: false }],
    // Impresa, cabe a lo ancho de una hoja
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  ins.columns = [{ width: 22 }, { width: 13 }, { width: 70 }, { width: 22 }]
  const titulo = ins.addRow([`Plantilla de ${def.titulo} para DOMUS`])
  titulo.font = { bold: true, size: 16 }
  ins.addRow([def.resumen])
  ins.addRow([])

  const pasos = [
    "Cómo llenarla",
    `1. Escribe los datos en ${def.hojas.length === 1 ? "la hoja" : "las hojas"} ${def.hojas.map((h) => `«${h.nombre}»`).join(" y ")}, desde la fila 2. No cambies los encabezados ni el orden de las columnas.`,
    "2. Las columnas marcadas «Sí» son obligatorias. La fecha también: si no la sabes, pon una aproximada para que los cálculos de cada ciclo salgan realistas.",
    "3. Guarda el archivo como .xlsx y súbelo en DOMUS, en «Importar desde Excel».",
    "4. Antes de guardar, DOMUS te muestra cómo queda todo. Si una fila tiene un error, no se importa nada: corriges el archivo y lo subes de nuevo.",
  ]
  pasos.forEach((texto, i) => {
    const fila = ins.addRow([texto])
    if (i === 0) fila.font = { bold: true, size: 12 }
  })

  for (const hoja of def.hojas) {
    ins.addRow([])
    const t = ins.addRow([`Hoja «${hoja.nombre}»: ${hoja.fila}`])
    t.font = { bold: true, size: 12 }
    const cab = ins.addRow(["Columna", "Obligatoria", "Qué poner", "Ejemplo"])
    estiloEncabezado(cab)
    for (const c of hoja.columnas) {
      const fila = ins.addRow([c.encabezado, c.obligatoria ? "Sí" : "No", c.ayuda, c.ejemplo])
      fila.alignment = { vertical: "top", wrapText: true }
      fila.getCell(1).font = { bold: true }
    }
  }

  ins.addRow([])
  const r = ins.addRow(["Reglas"])
  r.font = { bold: true, size: 12 }
  def.reglas.forEach((regla) => ins.addRow([`• ${regla}`]))

  // Los textos largos de una sola celda se leen enteros juntando las cuatro columnas
  ins.eachRow((fila) => {
    const c2 = fila.getCell(2).value
    if (fila.getCell(1).value && c2 == null) {
      ins.mergeCells(fila.number, 1, fila.number, 4)
      fila.alignment = { vertical: "top", wrapText: true }
      const largo = String(fila.getCell(1).value).length
      if (largo > 120) fila.height = 15 * Math.ceil(largo / 120)
    }
  })

  // ── Hojas de datos ─────────────────────────────────────────────
  for (const hoja of def.hojas) {
    const ws = libro.addWorksheet(hoja.nombre, {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    ws.columns = hoja.columnas.map((c) => ({
      header: c.obligatoria ? c.encabezado : `${c.encabezado} (opcional)`,
      key: c.clave,
      width: Math.max(c.ancho, c.encabezado.length + (c.obligatoria ? 3 : 14)),
      style: FORMATO[c.tipo] ? { numFmt: FORMATO[c.tipo] } : {},
    }))
    estiloEncabezado(ws.getRow(1))
    hoja.columnas.forEach((c, i) => validar(ws, i + 1, c))
  }

  const buffer = await libro.xlsx.writeBuffer()
  descargarBlob(new Blob([buffer], { type: TIPO_XLSX }), `${def.archivo}.xlsx`)
}

function estiloEncabezado(fila: ReturnType<Worksheet["getRow"]>) {
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } }
  fila.alignment = { vertical: "middle", wrapText: true }
  fila.height = 20
  fila.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NARANJA } }
  })
}

/** Validación de Excel en la columna: ayuda a llenar bien, pero quien decide es DOMUS */
function validar(ws: Worksheet, col: number, c: Columna) {
  const base = {
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "stop" as const,
    errorTitle: c.encabezado,
    showInputMessage: true,
    promptTitle: c.encabezado,
    prompt: c.ayuda.slice(0, 255),
  }
  let regla: Record<string, unknown>
  switch (c.tipo) {
    case "lista":
      regla = {
        type: "list",
        formulae: [`"${(c.opciones ?? []).join(",")}"`],
        error: `Elige una opción de la lista: ${(c.opciones ?? []).join(" o ")}.`,
      }
      break
    case "fecha":
      regla = {
        type: "date",
        operator: "greaterThan",
        formulae: [new Date(2000, 0, 1)],
        error: "Escribe una fecha con formato día/mes/año.",
      }
      break
    case "monto":
    case "monto0":
      regla = {
        type: "decimal",
        operator: c.tipo === "monto" ? "greaterThan" : "greaterThanOrEqual",
        formulae: [0],
        error:
          c.tipo === "monto" ? "Escribe un monto mayor que 0." : "Escribe un monto de 0 o más.",
      }
      break
    case "porcentaje":
      regla = {
        type: "decimal",
        operator: "between",
        formulae: [0.01, 100],
        error: "La tasa va de 0,01 a 100.",
      }
      break
    case "entero":
      regla = {
        type: "whole",
        operator: "greaterThan",
        formulae: [0],
        error: "Escribe un número entero mayor que 0.",
      }
      break
    default:
      regla = { type: "custom", formulae: ["TRUE"], showErrorMessage: false }
  }
  for (let f = 2; f <= FILAS + 1; f++) {
    const celda = ws.getCell(f, col)
    celda.dataValidation = { ...base, ...regla } as typeof celda.dataValidation
  }
}
