import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { DistribucionResponse, EstadoCajaResponse } from "../../api/reportes.types"
import { fecha, moneda, porcentaje } from "../../lib/format"
import { armarReporte, type TablaReporte, type TipoValor, type Valor } from "./contenidoReporte"

// Naranja de acción del modo claro (#b26000): con texto blanco da 4,6:1
const NARANJA: [number, number, number] = [178, 96, 0]
const GRIS_PIE: [number, number, number] = [240, 239, 234]
const MARGEN = 14

type DocConTabla = jsPDF & { lastAutoTable: { finalY: number } }

function texto(v: Valor, tipo: TipoValor): string {
  if (v == null) return "—"
  if (typeof v === "string") return v
  if (tipo === "moneda") return moneda(v)
  if (tipo === "porcentaje") return porcentaje(v)
  return String(v)
}

/**
 * PDF horizontal del ciclo (actualizado en T26): las tres cifras, los avisos que hagan
 * falta, lo que recibe cada socio y el mes a mes, con el contenido de `armarReporte`.
 */
export function descargarReporte(dist: DistribucionResponse, estado: EstadoCajaResponse) {
  const r = armarReporte(dist, estado)
  const doc = new jsPDF({ orientation: "landscape" }) as DocConTabla
  const ancho = doc.internal.pageSize.width - MARGEN * 2

  doc.setFontSize(15)
  doc.text(r.titulo, MARGEN, 16)
  doc.setFontSize(9)
  doc.setTextColor(85)
  doc.text(`${r.caja} · ${r.ciclo} · ${r.tipo} · ${r.estado}`, MARGEN, 22)

  // Las tres cifras, una por columna
  const col = ancho / r.cifras.length
  r.cifras.forEach((c, i) => {
    const x = MARGEN + col * i
    doc.setFontSize(8)
    doc.setTextColor(85)
    doc.text(c.etiqueta, x, 31)
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text(c.tipo === "moneda" ? moneda(c.valor) : porcentaje(c.valor), x, 38)
    doc.setFontSize(7)
    doc.setTextColor(85)
    doc.text(doc.splitTextToSize(c.detalle, col - 6), x, 43)
  })

  let y = 52
  doc.setFontSize(8)
  doc.setTextColor(0)
  for (const aviso of r.avisos) {
    const lineas = doc.splitTextToSize(aviso, ancho)
    doc.text(lineas, MARGEN, y)
    y += lineas.length * 4 + 1
  }

  y = tabla(doc, r.socios, y + 4, 7)
  tabla(doc, r.meses, y + 10, 8)

  // Pie en cada página
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(85)
    doc.text(
      `Generado el ${fecha(new Date())} · DOMUS${paginas > 1 ? ` · Página ${p} de ${paginas}` : ""}`,
      MARGEN,
      doc.internal.pageSize.height - 8,
    )
  }

  doc.save(`${r.archivo}.pdf`)
}

/** Dibuja una tabla con su título y devuelve dónde termina */
function tabla(doc: DocConTabla, t: TablaReporte, y: number, letra: number): number {
  // Si el título no cabe con al menos un par de filas, la tabla empieza en otra página
  if (y + 30 > doc.internal.pageSize.height) {
    doc.addPage()
    y = 16
  }
  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text(t.titulo, MARGEN, y)
  autoTable(doc, {
    startY: y + 4,
    margin: { left: MARGEN, right: MARGEN },
    head: [t.columnas.map((c) => c.encabezado)],
    body: t.filas.map((f) => f.map((v, i) => texto(v, t.columnas[i].tipo))),
    foot: [t.pie.map((v, i) => (v == null ? "" : texto(v, t.columnas[i].tipo)))],
    theme: "grid",
    // El total, una sola vez al final; el encabezado, en cada página
    showFoot: "lastPage",
    headStyles: { fillColor: NARANJA, textColor: 255, fontSize: letra },
    footStyles: { fillColor: GRIS_PIE, textColor: 0, fontStyle: "bold", fontSize: letra },
    bodyStyles: { fontSize: letra },
    columnStyles: { 0: { cellWidth: t.columnas.length > 6 ? 44 : "auto" } },
    // Todo menos la primera columna va a la derecha, también el encabezado y el pie
    didParseCell: (d) => {
      if (d.column.index > 0) d.cell.styles.halign = "right"
    },
  })
  return doc.lastAutoTable.finalY
}
