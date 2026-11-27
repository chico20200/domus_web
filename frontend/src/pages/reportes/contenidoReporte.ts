import type { DistribucionResponse, EstadoCajaResponse } from "../../api/reportes.types"
import { fecha, moneda } from "../../lib/format"
import { TIPO_REPARTO } from "../../lib/reparto"
import { mesCorto } from "./meses"

/**
 * Contenido del reporte del ciclo para exportarlo (T26). El PDF y el Excel salen de aquí,
 * así los dos dicen lo mismo que la pantalla de Reportes (T25): tres cifras, los avisos
 * solo cuando hacen falta, lo que recibe cada socio y el mes a mes, con las columnas que
 * corresponden al tipo de reparto del ciclo.
 *
 * Los valores van sin formato (número o texto): el PDF los formatea con `lib/format` y el
 * Excel los guarda como número con su formato de celda, para que se pueda sumar con ellos.
 * Los porcentajes van en puntos porcentuales, como los da el backend (1.25 = 1,25 %).
 */

export type TipoValor = "texto" | "moneda" | "porcentaje" | "entero"
export type Valor = string | number | null

export interface ColumnaReporte {
  encabezado: string
  tipo: TipoValor
  /** Ancho en caracteres, para el Excel */
  ancho: number
}

export interface TablaReporte {
  titulo: string
  columnas: ColumnaReporte[]
  filas: Valor[][]
  pie: Valor[]
}

export interface Reporte {
  titulo: string
  caja: string
  ciclo: string
  tipo: string
  estado: string
  cifras: { etiqueta: string; valor: number; tipo: "moneda" | "porcentaje"; detalle: string }[]
  avisos: string[]
  socios: TablaReporte
  meses: TablaReporte
  /** Nombre del archivo, sin extensión */
  archivo: string
}

export function armarReporte(dist: DistribucionResponse, estado: EstadoCajaResponse): Reporte {
  const cerrado = estado.ciclo.cerrado
  const equitativa = dist.tipo === "equitativa"
  const falta = estado.falta_por_cobrar
  const v = dist.validacion
  const n = dist.por_socio.length
  const mesesConInteres = dist.meses.filter((m) => m.interes_mes > 0).length

  const cifras: Reporte["cifras"] = [
    {
      etiqueta: "Interés generado",
      valor: dist.interes_total,
      tipo: "moneda",
      detalle: `Cobrado en el ciclo${cerrado ? "" : " hasta hoy"}; se reparte entre ${n} ${n === 1 ? "socio" : "socios"}`,
    },
    {
      etiqueta: "Faltó por cobrar",
      valor: falta.total,
      tipo: "moneda",
      detalle:
        falta.cuotas === 0
          ? `Se pagaron todas las cuotas que vencieron en el ciclo${cerrado ? "" : " hasta hoy"}`
          : `${falta.cuotas} ${falta.cuotas === 1 ? "cuota vencida" : "cuotas vencidas"} de ${falta.creditos} ${falta.creditos === 1 ? "crédito" : "créditos"}; ${moneda(falta.interes)} de interés`,
    },
    {
      etiqueta: "Rendimiento del ciclo",
      valor: dist.tasa_acumulada,
      tipo: "porcentaje",
      detalle: "Suma del rendimiento de cada mes: interés sobre el ahorro de la caja",
    },
  ]

  // Los mismos textos que la pantalla: el aviso de que no cuadra y lo del sobrante
  const avisos: string[] = []
  if (!v.cuadra) {
    avisos.push(
      `El reparto no cuadra con el interés generado: quedaron ${moneda(v.diferencia)} sin repartir, porque hubo meses con interés y sin ${equitativa ? "socios en la caja" : "ahorro en la caja"}. Se repartieron ${moneda(v.interes_repartido)} de ${moneda(v.interes_generado)}.`,
    )
  }
  const registrado = dist.sobrante_registrado
  if (registrado) {
    avisos.push(
      `Los ${moneda(registrado.monto)} que sobraron al redondear se pasaron a ${registrado.fondo} el ${fecha(registrado.fecha)}.`,
    )
  } else if (v.sobrante > 0) {
    avisos.push(
      cerrado
        ? `Al redondear cada parte sobraron ${moneda(v.sobrante)}; van a Fondos de caja.`
        : `Al redondear cada parte sobran ${moneda(v.sobrante)} hasta hoy; van a Fondos de caja cuando el ciclo cierre.`,
    )
  }

  const nombreSocio = (s: DistribucionResponse["por_socio"][number]) =>
    !s.activo && s.fecha_salida ? `${s.nombre} (salió el ${fecha(s.fecha_salida)})` : s.nombre

  const socios: TablaReporte = equitativa
    ? {
        titulo: "Lo que recibe cada socio",
        columnas: [
          { encabezado: "Socio", tipo: "texto", ancho: 34 },
          { encabezado: cerrado ? "Ahorro al cierre" : "Ahorro hoy", tipo: "moneda", ancho: 16 },
          { encabezado: "Meses con parte", tipo: "texto", ancho: 16 },
          { encabezado: "Recibe", tipo: "moneda", ancho: 14 },
        ],
        filas: dist.por_socio.map((s) => [
          nombreSocio(s),
          s.saldo_final,
          `${s.por_mes.filter((p, i) => p.interes > 0 && dist.meses[i].interes_mes > 0).length} de ${mesesConInteres}`,
          s.interes_total,
        ]),
        pie: ["Total repartido", null, null, v.interes_repartido],
      }
    : {
        titulo: "Interés que generó cada socio, por mes, y lo que recibe",
        columnas: [
          { encabezado: "Socio", tipo: "texto", ancho: 34 },
          { encabezado: cerrado ? "Ahorro al cierre" : "Ahorro hoy", tipo: "moneda", ancho: 16 },
          ...dist.meses.map((m): ColumnaReporte => ({
            encabezado: mesCorto(m.mes),
            tipo: "moneda",
            ancho: 11,
          })),
          { encabezado: "Recibe", tipo: "moneda", ancho: 14 },
        ],
        filas: dist.por_socio.map((s) => [
          nombreSocio(s),
          s.saldo_final,
          // Sin interés ese mes: celda vacía, como el «—» de la pantalla
          ...dist.meses.map((_, i) => s.por_mes[i]?.interes || null),
          s.interes_total,
        ]),
        pie: [
          "Total repartido",
          null,
          ...dist.meses.map((m) => m.interes_mes),
          v.interes_repartido,
        ],
      }

  const meses: TablaReporte = {
    titulo: "Mes a mes",
    columnas: [
      { encabezado: "Mes", tipo: "texto", ancho: 10 },
      { encabezado: "Capital de la caja", tipo: "moneda", ancho: 18 },
      { encabezado: "Interés recaudado", tipo: "moneda", ancho: 18 },
      ...(equitativa
        ? ([
            { encabezado: "Socios", tipo: "entero", ancho: 9 },
            { encabezado: "Parte de cada uno", tipo: "moneda", ancho: 18 },
          ] satisfies ColumnaReporte[])
        : ([
            { encabezado: "Rendimiento del mes", tipo: "porcentaje", ancho: 20 },
          ] satisfies ColumnaReporte[])),
    ],
    filas: dist.meses.map((m) => [
      mesCorto(m.mes),
      m.capital_total,
      m.interes_mes,
      ...(equitativa ? [m.participantes ?? 0, m.parte || null] : [m.tasa_mes]),
    ]),
    pie: [
      "Total",
      null,
      dist.interes_total,
      ...(equitativa ? [null, null] : [dist.tasa_acumulada]),
    ],
  }

  return {
    titulo: "Reporte de distribución de intereses",
    caja: dist.caja.nombre,
    ciclo: `Ciclo ${dist.ciclo.numero}: ${dist.ciclo.label}`,
    tipo: TIPO_REPARTO[dist.tipo].etiqueta,
    estado: cerrado
      ? `Cerrado; saldos al ${fecha(estado.corte)}`
      : `En curso, hasta hoy ${fecha(estado.corte)}`,
    cifras,
    avisos,
    socios,
    meses,
    archivo: `reporte-${dist.caja.nombre.trim().replace(/\s+/g, "-")}-ciclo-${dist.ciclo.numero}`,
  }
}
