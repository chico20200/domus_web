import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { DistribucionResponse, EstadoCajaResponse } from "../../api/reportes.types"
import { fecha, moneda, porcentaje } from "../../lib/format"
import { mesCorto } from "./meses"

// Naranja de acción del modo claro (#b26000): con texto blanco da 4,6:1
const NARANJA: [number, number, number] = [178, 96, 0]
const GRIS_PIE: [number, number, number] = [240, 239, 234]

type DocConTabla = jsPDF & { lastAutoTable: { finalY: number } }

/** PDF horizontal con el resumen del ciclo, el interés por mes y el interés por socio */
export function descargarReporte(dist: DistribucionResponse, estado: EstadoCajaResponse) {
  const doc = new jsPDF({ orientation: "landscape" }) as DocConTabla

  doc.setFontSize(15)
  doc.text("Reporte de distribución de intereses", 14, 16)
  doc.setFontSize(9)
  doc.setTextColor(85)
  doc.text(`${dist.caja.nombre} · Ciclo ${dist.ciclo.numero}: ${dist.ciclo.label}`, 14, 22)

  doc.setTextColor(0)
  const y = 32
  doc.text(`Total ahorrado: ${moneda(estado.total_ahorros)}`, 14, y)
  doc.text(`Interés del ciclo: ${moneda(estado.interes_recaudado)}`, 90, y)
  doc.text(`Por cobrar: ${moneda(estado.por_cobrar)}`, 170, y)
  doc.text(`Disponible en caja: ${moneda(estado.en_caja)}`, 230, y)

  autoTable(doc, {
    startY: y + 8,
    head: [["Mes", "Capital de la caja", "Interés recaudado", "Rendimiento"]],
    body: dist.meses.map((m) => [
      mesCorto(m.mes),
      moneda(m.capital_total),
      moneda(m.interes_mes),
      porcentaje(m.tasa_mes, 4),
    ]),
    foot: [["Total", "", moneda(dist.interes_total), porcentaje(dist.tasa_acumulada, 4)]],
    theme: "grid",
    headStyles: { fillColor: NARANJA, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: GRIS_PIE, textColor: 0, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  })

  const y2 = doc.lastAutoTable.finalY + 10
  doc.setFontSize(11)
  doc.text("Interés por socio", 14, y2)

  autoTable(doc, {
    startY: y2 + 4,
    head: [["Socio", ...dist.meses.map((m) => mesCorto(m.mes)), "Total"]],
    body: dist.por_socio.map((s) => [
      s.nombre,
      ...s.por_mes.map((p) => moneda(p.interes)),
      moneda(s.interes_total),
    ]),
    foot: [
      [
        "Total repartido",
        ...dist.meses.map((m) => moneda(m.interes_mes)),
        moneda(dist.validacion.interes_repartido),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: NARANJA, textColor: 255, fontSize: 7 },
    footStyles: { fillColor: GRIS_PIE, textColor: 0, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    columnStyles: { 0: { cellWidth: 40 } },
  })

  doc.setFontSize(7)
  doc.setTextColor(85)
  doc.text(`Generado el ${fecha(new Date())} · DOMUS`, 14, doc.internal.pageSize.height - 8)

  doc.save(`reporte-${dist.caja.nombre.replace(/\s+/g, "-")}-ciclo-${dist.ciclo.numero}.pdf`)
}
