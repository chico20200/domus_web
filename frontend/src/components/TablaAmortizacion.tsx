// src/components/TablaAmortizacion.tsx
import { useCallback } from "react"
import { Download, HandCoins } from "lucide-react"
import jsPDF from "jspdf"
import autoTable, { type RowInput } from "jspdf-autotable"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Badge, type BadgeTono } from "./Badge"
import { DataTable, type Columna } from "./DataTable"
import { LoadingState } from "./LoadingState"
import { creditosService } from "../api/creditos.service"
import type { FilaAmortizacion, GetAmortizacionResponse } from "../api/amortizacion.types"
import { fecha, moneda, porcentaje } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { nombreSocio } from "../lib/creditos"

/**
 * Tabla de amortización de un crédito, con sus pagos y abonos por cuota y descarga en PDF.
 * Se monta solo mientras está abierta.
 */

interface Props {
  cajaId: string
  creditoId: string
  nombreCaja: string
  onCerrar: () => void
}

// Naranja de acción del modo claro (#b26000): con texto blanco da 4,6:1, como el botón
const NARANJA_PDF: [number, number, number] = [178, 96, 0]

function estadoCuota(f: FilaAmortizacion): { etiqueta: string; tono: BadgeTono } {
  if (f.es_prepago) return { etiqueta: "Prepagada", tono: "ok" }
  if (f.pagada) return { etiqueta: "Pagada", tono: "ok" }
  if (f.vencida) return { etiqueta: "Vencida", tono: "destructivo" }
  if (f.parcial) return { etiqueta: "Parcial", tono: "alerta" }
  return { etiqueta: "Pendiente", tono: "neutral" }
}

function descripcionMovimiento(m: FilaAmortizacion["movimientos"][number]) {
  return [
    `${m.es_abono ? "Abono" : "Pago"} de ${moneda(m.monto)}`,
    m.capital > 0 ? `capital ${moneda(m.capital)}` : null,
    m.interes > 0 ? `interés ${moneda(m.interes)}` : null,
    m.motivo,
    fecha(m.fecha_pago),
  ]
    .filter(Boolean)
    .join(" · ")
}

function descargarPDF(data: GetAmortizacionResponse, nombreCaja: string) {
  const { credito, tabla, resumen } = data
  const socio = nombreSocio(credito.socio)

  const filas: RowInput[] = []
  tabla.forEach((f) => {
    filas.push([
      f.numero_cuota,
      fecha(f.fecha_vencimiento),
      moneda(f.capital),
      f.es_prepago ? `${moneda(f.interes_condonado)} (condonado)` : moneda(f.interes),
      moneda(f.cuota),
      moneda(f.saldo_restante),
      estadoCuota(f).etiqueta,
    ])
    if (f.es_fraccionada) {
      f.movimientos.forEach((m) => {
        filas.push([
          "",
          {
            content: descripcionMovimiento(m),
            colSpan: 6,
            styles: { fontStyle: "italic", fontSize: 7, textColor: [85, 85, 85] },
          },
        ])
      })
    }
  })

  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text("Tabla de amortización", 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(85)
  doc.text(nombreCaja, 14, 25)

  doc.setFontSize(9)
  doc.setTextColor(0)
  const y = 34
  doc.text(`Socio: ${socio}`, 14, y)
  if (credito.socio?.cedula) doc.text(`Cédula: ${credito.socio.cedula}`, 14, y + 5)
  doc.text(`Total a pagar: ${moneda(credito.monto_total)}`, 14, y + 10)
  if (credito.fecha_desembolso) {
    doc.text(`Desembolso: ${fecha(credito.fecha_desembolso)}`, 14, y + 15)
  }
  doc.text(`Monto prestado: ${moneda(credito.monto_solicitado)}`, 110, y)
  doc.text(`Tasa: ${porcentaje(credito.tasa_interes)} anual`, 110, y + 5)
  doc.text(`Plazo: ${credito.plazo_meses} meses`, 110, y + 10)

  autoTable(doc, {
    startY: y + 22,
    head: [["#", "Vence", "Capital", "Interés", "Cuota", "Saldo", "Estado"]],
    body: filas,
    foot: [
      [
        "Total",
        "",
        moneda(credito.monto_solicitado),
        moneda(credito.interes_total),
        moneda(credito.monto_total),
        "",
        "",
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: NARANJA_PDF, textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [240, 239, 234], textColor: 0, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 248] },
  })

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  doc.setFontSize(9)
  doc.text(`Cuotas pagadas: ${resumen.cuotas_pagadas} de ${resumen.cuotas_totales}`, 14, finalY)
  doc.text(`Capital pagado: ${moneda(resumen.capital_pagado)}`, 14, finalY + 5)
  doc.text(`Interés pagado: ${moneda(resumen.interes_pagado)}`, 14, finalY + 10)
  doc.text(`Saldo pendiente: ${moneda(credito.saldo_pendiente)}`, 14, finalY + 15)

  doc.setFontSize(7)
  doc.setTextColor(85)
  doc.text(`Generado el ${fecha(new Date())} · DOMUS`, 14, doc.internal.pageSize.height - 10)

  doc.save(`amortizacion-${socio.replace(/\s+/g, "-")}.pdf`)
}

const COLUMNAS = (data: GetAmortizacionResponse): Columna<FilaAmortizacion>[] => [
  { clave: "n", encabezado: "#", celda: (f) => f.numero_cuota, pie: "Total" },
  {
    clave: "vence",
    encabezado: "Vence",
    celda: (f) => <span className="whitespace-nowrap">{fecha(f.fecha_vencimiento)}</span>,
  },
  {
    clave: "capital",
    encabezado: "Capital",
    alinear: "derecha",
    celda: (f) => moneda(f.capital),
    pie: moneda(data.credito.monto_solicitado),
  },
  {
    clave: "interes",
    encabezado: "Interés",
    alinear: "derecha",
    celda: (f) =>
      f.es_prepago ? (
        <span className="text-muted line-through" title="Condonado por prepago">
          {moneda(f.interes_condonado)}
        </span>
      ) : (
        moneda(f.interes)
      ),
    pie: moneda(data.credito.interes_total),
  },
  {
    clave: "cuota",
    encabezado: "Cuota",
    alinear: "derecha",
    celda: (f) => <span className="font-medium">{moneda(f.cuota)}</span>,
    pie: moneda(data.credito.monto_total),
  },
  {
    clave: "saldo",
    encabezado: "Saldo",
    alinear: "derecha",
    celda: (f) => <span className="text-secondary">{moneda(f.saldo_restante)}</span>,
  },
  {
    clave: "estado",
    encabezado: "Estado",
    alinear: "centro",
    celda: (f) => {
      const e = estadoCuota(f)
      return <Badge tono={e.tono} label={e.etiqueta} />
    },
  },
]

export function TablaAmortizacion({ cajaId, creditoId, nombreCaja, onCerrar }: Props) {
  const cargar = useCallback(
    () => creditosService.getAmortizacion(cajaId, creditoId),
    [cajaId, creditoId],
  )
  const { datos: data, cargando, error } = useDatos(cargar)

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Tabla de amortización"
      descripcion={data ? nombreSocio(data.credito.socio) : undefined}
      ancho="amplio"
      acciones={
        <>
          <Button label="Cerrar" variant="ghost" onClick={onCerrar} />
          <Button
            label="Descargar PDF"
            variant="secondary"
            icon={Download}
            disabled={!data}
            onClick={() => data && descargarPDF(data, nombreCaja)}
          />
        </>
      }
    >
      {cargando && <LoadingState texto="Cargando la tabla…" />}
      {!cargando && error && <p className="text-sm text-destructivo">{error}</p>}

      {data && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Prestado", moneda(data.credito.monto_solicitado)],
              ["Interés total", moneda(data.credito.interes_total)],
              ["Total a pagar", moneda(data.credito.monto_total)],
              [
                "Cuotas pagadas",
                `${data.resumen.cuotas_pagadas} de ${data.resumen.cuotas_totales}`,
              ],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex flex-col gap-1 rounded-lg bg-surface-2 p-3">
                <dt className="text-xs text-secondary">{etiqueta}</dt>
                <dd className="text-sm font-medium text-primary tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>

          {(data.resumen.cuotas_vencidas > 0 || data.resumen.interes_condonado > 0) && (
            <div className="flex flex-wrap gap-2">
              {data.resumen.cuotas_vencidas > 0 && (
                <Badge
                  tono="destructivo"
                  label={`${data.resumen.cuotas_vencidas} ${data.resumen.cuotas_vencidas === 1 ? "cuota vencida" : "cuotas vencidas"}`}
                />
              )}
              {data.resumen.interes_condonado > 0 && (
                <Badge
                  tono="ok"
                  label={`Interés condonado por prepago: ${moneda(data.resumen.interes_condonado)}`}
                />
              )}
            </div>
          )}

          <DataTable
            descripcion="Cuotas del crédito con capital, interés, saldo y estado"
            filas={data.tabla}
            claveFila={(f) => f.numero_cuota}
            columnas={COLUMNAS(data)}
            detalle={(f) =>
              f.es_fraccionada ? (
                <ul className="flex flex-col gap-1">
                  {f.movimientos.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <HandCoins size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {descripcionMovimiento(m)}
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
        </div>
      )}
    </Modal>
  )
}
