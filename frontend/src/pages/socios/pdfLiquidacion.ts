import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { LiquidacionGuardada } from "../../api/salida.types"
import { fecha, moneda } from "../../lib/format"

/*
 * PDF de la liquidación de salida (Etapa 7, T7; especificaciones §12): lo que recibe, lo
 * que se le retiene por cada crédito y espacio para firmar. Se arma con la liquidación
 * guardada (su `detalle` es lo que se vio al registrarla), así que se puede volver a
 * descargar igual desde el historial.
 */

// Naranja de acción del modo claro (#b26000), como los demás PDF
const NARANJA: [number, number, number] = [178, 96, 0]
const GRIS_PIE: [number, number, number] = [240, 239, 234]
const MARGEN = 14

type DocConTabla = jsPDF & { lastAutoTable: { finalY: number } }

/** El nombre del archivo, sin tildes ni espacios */
export function archivoLiquidacion(l: LiquidacionGuardada): string {
  const nombre = `${l.detalle.socio?.nombre ?? ""} ${l.detalle.socio?.apellido ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
  return `liquidacion-${nombre || "socio"}-${l.fecha}.pdf`
}

export function armarPdfLiquidacion(l: LiquidacionGuardada, nombreCaja: string): jsPDF {
  const doc = new jsPDF() as DocConTabla
  const ancho = doc.internal.pageSize.width - MARGEN * 2
  const socio = l.detalle.socio
  const nombre = socio ? `${socio.nombre} ${socio.apellido}` : "Socio"
  const interes = l.detalle.interes ?? null
  const cuentas = l.detalle.cuentas ?? []
  const creditos = l.detalle.creditos ?? []
  const solicitudes = l.detalle.solicitudes ?? []

  doc.setFontSize(16)
  doc.text("Liquidación de salida", MARGEN, 18)
  doc.setFontSize(10)
  doc.setTextColor(85)
  doc.text(nombreCaja, MARGEN, 25)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(`Socio: ${nombre}`, MARGEN, 34)
  if (socio?.cedula) doc.text(`Cédula: ${socio.cedula}`, MARGEN, 39)
  doc.text(`Fecha de salida: ${fecha(l.fecha)}`, 110, 34)
  if (interes) doc.text(`Ciclo: ${interes.ciclo.label}`, 110, 39)

  // 1. Lo que tiene a su favor
  const favor: string[][] = cuentas.map((c) => [
    `Ahorros, cuenta ${c.numero_cuenta}`,
    moneda(c.saldo),
  ])
  if (cuentas.length === 0) favor.push(["Ahorros (sin cuentas)", moneda(0)])
  favor.push([
    interes
      ? `Interés del ciclo ${interes.ciclo.label} (reparto ${interes.tipo === "equitativa" ? "equitativo" : "diferenciado"}, hasta su salida)`
      : "Interés del ciclo (la caja no tenía periodo configurado)",
    moneda(l.interes),
  ])
  let y = seccion(doc, "Lo que tiene a su favor", 50)
  autoTable(doc, {
    ...estilo(),
    startY: y,
    head: [["Concepto", "Monto"]],
    body: favor,
    foot: [["Total a su favor", moneda(sumar(l.ahorros, l.interes))]],
  })
  y = doc.lastAutoTable.finalY + 10

  // 2. Lo que se le retiene por cada crédito
  if (creditos.length > 0) {
    y = seccion(doc, "Lo que se le retiene por sus créditos", y)
    autoTable(doc, {
      ...estilo(),
      startY: y,
      head: [
        ["Crédito", "Capital pendiente", "Interés vencido", "Se retiene", "Interés no cobrado"],
      ],
      body: creditos.map((cr) => [
        `N.º ${cr.numero}`,
        moneda(cr.capital_pendiente),
        cr.cuotas_vencidas > 0
          ? `${moneda(cr.interes_vencido)} (${cr.cuotas_vencidas} ${cr.cuotas_vencidas === 1 ? "cuota" : "cuotas"})`
          : moneda(0),
        moneda(cr.deuda),
        moneda(cr.interes_condonado),
      ]),
      foot: [["Total", "", "", moneda(l.deuda), moneda(l.interes_condonado)]],
    })
    y = doc.lastAutoTable.finalY + 4
    doc.setFontSize(8)
    doc.setTextColor(85)
    const nota = doc.splitTextToSize(
      "Con lo retenido sus créditos quedan pagados. El interés de las cuotas que aún no vencían no se cobra.",
      ancho,
    )
    doc.text(nota, MARGEN, y + 3)
    y += nota.length * 4 + 8
  }

  // 3. Lo que recibe
  y = espacio(doc, y, 20)
  doc.setFillColor(...GRIS_PIE)
  doc.rect(MARGEN, y, ancho, 14, "F")
  doc.setFontSize(9)
  doc.setTextColor(85)
  doc.text(
    `${moneda(sumar(l.ahorros, l.interes))} a su favor${l.deuda > 0 ? ` - ${moneda(l.deuda)} retenidos` : ""}`,
    MARGEN + 4,
    y + 8.5,
  )
  doc.setFontSize(13)
  doc.setTextColor(0)
  doc.text(`Recibe ${moneda(l.neto)}`, MARGEN + ancho - 4, y + 9, { align: "right" })
  y += 22

  doc.setFontSize(8)
  doc.setTextColor(85)
  const notas = [
    "Sus cuentas de ahorro quedan cerradas y su ficha, inactiva.",
    solicitudes.length > 0
      ? `Se anularon sus solicitudes de crédito sin aprobar: ${solicitudes.map((s) => `N.º ${s.numero} por ${moneda(s.monto)}`).join(", ")}.`
      : null,
    l.detalle.acceso_retirado ? "Su acceso a la caja en DOMUS quedó retirado." : null,
  ].filter((n): n is string => Boolean(n))
  for (const n of notas) {
    const lineas = doc.splitTextToSize(n, ancho)
    doc.text(lineas, MARGEN, y)
    y += lineas.length * 4
  }

  // 4. Constancia y firmas
  y = espacio(doc, y + 6, 60)
  doc.setFontSize(9)
  doc.setTextColor(0)
  const constancia = doc.splitTextToSize(
    `${nombre}${socio?.cedula ? `, con cédula ${socio.cedula},` : ""} deja la caja ${nombreCaja} el ${fecha(l.fecha)} y declara haber recibido ${moneda(l.neto)}: sus ahorros y el interés del ciclo, menos lo retenido para pagar sus créditos.`,
    ancho,
  )
  doc.text(constancia, MARGEN, y)
  y += constancia.length * 4.5 + 28

  const mitad = (ancho - 16) / 2
  doc.setDrawColor(0)
  doc.line(MARGEN, y, MARGEN + mitad, y)
  doc.line(MARGEN + mitad + 16, y, MARGEN + ancho, y)
  doc.setFontSize(9)
  doc.text("Recibí conforme", MARGEN, y + 5)
  doc.text("Entregué", MARGEN + mitad + 16, y + 5)
  doc.setFontSize(8)
  doc.setTextColor(85)
  doc.text(nombre, MARGEN, y + 10)
  if (socio?.cedula) doc.text(`C.I. ${socio.cedula}`, MARGEN, y + 14)
  doc.text("Nombre:", MARGEN + mitad + 16, y + 10)
  doc.text("Por la caja", MARGEN + mitad + 16, y + 14)

  // Pie en cada página
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(85)
    doc.text(
      `Liquidación registrada el ${fecha(l.created_at)} · Generado el ${fecha(new Date())} · DOMUS${paginas > 1 ? ` · Página ${p} de ${paginas}` : ""}`,
      MARGEN,
      doc.internal.pageSize.height - 8,
    )
  }
  return doc
}

export function descargarLiquidacion(l: LiquidacionGuardada, nombreCaja: string) {
  armarPdfLiquidacion(l, nombreCaja).save(archivoLiquidacion(l))
}

/** Suma en centavos, para no arrastrar decimales de coma flotante */
function sumar(...montos: number[]): number {
  return montos.reduce((s, m) => s + Math.round(Number(m) * 100), 0) / 100
}

function seccion(doc: jsPDF, titulo: string, y: number): number {
  y = espacio(doc, y, 30)
  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.text(titulo, MARGEN, y)
  return y + 4
}

/** Si no caben `alto` mm, sigue en una página nueva */
function espacio(doc: jsPDF, y: number, alto: number): number {
  if (y + alto > doc.internal.pageSize.height - 16) {
    doc.addPage()
    return 18
  }
  return y
}

function estilo() {
  return {
    margin: { left: MARGEN, right: MARGEN },
    theme: "grid" as const,
    showFoot: "lastPage" as const,
    headStyles: { fillColor: NARANJA, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: GRIS_PIE, textColor: 0, fontStyle: "bold" as const, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    // Los montos a la derecha, también en el encabezado y el pie
    didParseCell: (d: { column: { index: number }; cell: { styles: { halign: string } } }) => {
      if (d.column.index > 0) d.cell.styles.halign = "right"
    },
  }
}
