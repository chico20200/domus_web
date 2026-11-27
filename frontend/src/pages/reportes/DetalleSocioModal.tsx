import { Modal } from "../../components/Modal"
import { DataTable, type Columna } from "../../components/DataTable"
import type { DistribucionResponse, FilaMes, InteresSocio } from "../../api/reportes.types"
import { moneda, monedaExacta, porcentaje } from "../../lib/format"
import { mesCorto } from "./meses"

interface Props {
  dist: DistribucionResponse
  socio: InteresSocio
  onCerrar: () => void
}

const sinDato = <span className="text-muted">—</span>

/**
 * De dónde sale el interés de un socio (T25), mes a mes:
 * - diferenciada: su ahorro al cierre del mes por el rendimiento del mes;
 * - equitativa: el interés del mes dividido entre los socios que estuvieron ese mes.
 * Las partes se suman sin redondear y el total se redondea hacia abajo al centavo.
 */
export function DetalleSocioModal({ dist, socio, onCerrar }: Props) {
  const id = socio.socio_id
  const equitativa = dist.tipo === "equitativa"
  const exacto = dist.meses.reduce((s, m) => s + (m.reparto[id] ?? 0), 0)

  const columnas: Columna<FilaMes>[] = equitativa
    ? [
        { clave: "mes", encabezado: "Mes", celda: (m) => mesCorto(m.mes), pie: "Total" },
        {
          clave: "interes",
          encabezado: "Interés del mes",
          alinear: "derecha",
          celda: (m) => (m.interes_mes > 0 ? moneda(m.interes_mes) : sinDato),
        },
        {
          clave: "socios",
          encabezado: "Socios",
          alinear: "derecha",
          celda: (m) => (m.interes_mes > 0 ? (m.participantes ?? 0) : sinDato),
        },
        {
          clave: "parte",
          encabezado: "Su parte",
          alinear: "derecha",
          celda: (m) =>
            m.interes_mes <= 0 ? (
              sinDato
            ) : (m.reparto[id] ?? 0) > 0 ? (
              moneda(m.reparto[id])
            ) : (
              <span className="text-secondary">No estaba en la caja</span>
            ),
          pie: moneda(socio.interes_total),
        },
      ]
    : [
        { clave: "mes", encabezado: "Mes", celda: (m) => mesCorto(m.mes), pie: "Total" },
        {
          clave: "ahorro",
          encabezado: "Su ahorro al cierre del mes",
          alinear: "derecha",
          celda: (m) => moneda(m.saldos[id] ?? 0),
        },
        {
          clave: "tasa",
          encabezado: "Rendimiento del mes",
          alinear: "derecha",
          celda: (m) => (m.tasa_mes > 0 ? porcentaje(m.tasa_mes) : sinDato),
        },
        {
          clave: "interes",
          encabezado: "Interés",
          alinear: "derecha",
          celda: (m) => ((m.reparto[id] ?? 0) > 0 ? moneda(m.reparto[id]) : sinDato),
          pie: moneda(socio.interes_total),
        },
      ]

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      ancho="amplio"
      titulo={`De dónde sale el interés de ${socio.nombre}`}
      descripcion={
        equitativa
          ? "Distribución equitativa: el interés de cada mes se divide en partes iguales entre los socios que estuvieron en la caja ese mes."
          : "Distribución diferenciada: cada mes, su ahorro al cierre del mes por el rendimiento de la caja ese mes."
      }
    >
      <div className="flex flex-col gap-3">
        <DataTable<FilaMes>
          descripcion={`Interés de ${socio.nombre}, mes a mes`}
          filas={dist.meses}
          claveFila={(m) => m.mes}
          columnas={columnas}
        />
        <p className="text-sm text-secondary">
          Las partes suman {monedaExacta(exacto)}. Recibe {moneda(socio.interes_total)}: el total se
          redondea hacia abajo al centavo y lo que sobra va a Fondos de caja.
        </p>
      </div>
    </Modal>
  )
}
