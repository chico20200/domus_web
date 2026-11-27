import type { Worksheet } from "exceljs"
import type { DistribucionResponse, EstadoCajaResponse } from "../../api/reportes.types"
import { descargarBlob, TIPO_XLSX } from "../../lib/descargar"
import { fecha } from "../../lib/format"
import { armarReporte, type TablaReporte, type TipoValor, type Valor } from "./contenidoReporte"

const NARANJA = "FFB26000" // el mismo del PDF y de las plantillas
const GRIS_PIE = "FFF0EFEA"

const FORMATO: Record<TipoValor, string | undefined> = {
  texto: undefined,
  moneda: '"$"#,##0.00',
  porcentaje: "0.00%",
  entero: "0",
}

/** En Excel el porcentaje va como fracción (0,0125) con formato de porcentaje */
function celda(v: Valor, tipo: TipoValor) {
  if (v == null || typeof v === "string") return v
  return tipo === "porcentaje" ? v / 100 : v
}

/**
 * Reporte del ciclo en Excel (T26), con el mismo contenido que el PDF: una hoja de
 * resumen y una por tabla. Los montos van como número, para poder sumar y filtrar.
 * exceljs se carga solo al descargar, como en las plantillas.
 */
export async function descargarReporteExcel(
  dist: DistribucionResponse,
  estado: EstadoCajaResponse,
) {
  const r = armarReporte(dist, estado)
  const { default: ExcelJS } = await import("exceljs")
  const libro = new ExcelJS.Workbook()
  libro.creator = "DOMUS"
  libro.created = new Date()

  // ── Resumen ────────────────────────────────────────────────────
  const res = libro.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  res.columns = [{ width: 26 }, { width: 18 }, { width: 80 }]
  res.addRow([r.titulo]).font = { bold: true, size: 16 }
  for (const [k, v] of [
    ["Caja", r.caja],
    ["Ciclo", r.ciclo],
    ["Tipo de reparto", r.tipo],
    ["Estado", r.estado],
  ]) {
    res.addRow([k, v]).getCell(1).font = { bold: true }
  }
  res.addRow([])
  for (const c of r.cifras) {
    const fila = res.addRow([c.etiqueta, celda(c.valor, c.tipo), c.detalle])
    fila.getCell(1).font = { bold: true }
    fila.getCell(2).numFmt = FORMATO[c.tipo]!
    fila.getCell(2).font = { bold: true, size: 12 }
    fila.getCell(3).alignment = { indent: 1 }
  }
  if (r.avisos.length) {
    res.addRow([])
    for (const aviso of r.avisos) {
      const fila = res.addRow([aviso])
      res.mergeCells(fila.number, 1, fila.number, 3)
      fila.alignment = { wrapText: true, vertical: "top" }
      fila.height = 15 * Math.ceil(aviso.length / 110)
    }
  }
  res.addRow([])
  res.addRow([`Generado el ${fecha(new Date())} · DOMUS`]).font = {
    size: 9,
    color: { argb: "FF555555" },
  }

  hoja(libro.addWorksheet("Por socio"), r.socios)
  hoja(libro.addWorksheet("Mes a mes"), r.meses)

  const buffer = await libro.xlsx.writeBuffer()
  descargarBlob(new Blob([buffer], { type: TIPO_XLSX }), `${r.archivo}.xlsx`)
}

function hoja(ws: Worksheet, t: TablaReporte) {
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }]
  // Como en la pantalla y el PDF: todo menos la primera columna va a la derecha
  ws.columns = t.columnas.map((c, i) => ({
    header: c.encabezado,
    width: c.ancho,
    style: {
      ...(FORMATO[c.tipo] ? { numFmt: FORMATO[c.tipo] } : {}),
      ...(i > 0 ? { alignment: { horizontal: "right" as const } } : {}),
    },
  }))
  const cab = ws.getRow(1)
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } }
  cab.eachCell((c, i) => {
    c.alignment = { vertical: "middle", wrapText: true, horizontal: i > 1 ? "right" : "left" }
  })
  cab.height = 20
  cab.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NARANJA } }
  })

  for (const f of t.filas) ws.addRow(f.map((v, i) => celda(v, t.columnas[i].tipo)))

  const pie = ws.addRow(t.pie.map((v, i) => celda(v, t.columnas[i].tipo)))
  pie.font = { bold: true }
  pie.eachCell({ includeEmpty: true }, (c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_PIE } }
  })

  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
}
