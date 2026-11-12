import { Fragment, type ReactNode } from "react"
import { LoadingState } from "./LoadingState"

/**
 * Tabla de datos (especificaciones §3, DataTable). Reemplaza las tablas escritas a mano
 * de Reportes y de la tabla de amortización.
 *
 * Las columnas se declaran una vez y la tabla pone el estilo:
 *
 *   <DataTable
 *     descripcion="Interés recaudado por mes"
 *     filas={dist.meses}
 *     claveFila={(m) => m.mes}
 *     columnas={[
 *       { clave: "mes", encabezado: "Mes", celda: (m) => labelMes(m.mes), pie: "Total" },
 *       { clave: "interes", encabezado: "Interés", alinear: "derecha",
 *         celda: (m) => moneda(m.interes_mes), pie: moneda(dist.interes_total) },
 *     ]}
 *     vacio={<EmptyState titulo="Aún no hay movimientos" />}
 *   />
 *
 * - Las columnas numéricas van con `alinear: "derecha"`; usan cifras de ancho fijo para
 *   que los montos queden alineados por la coma.
 * - `fija` deja la primera columna quieta al desplazar en horizontal (tablas anchas, como
 *   el interés por socio y por mes).
 * - El pie solo se pinta si alguna columna declara `pie`.
 * - `detalle` agrega, debajo de una fila, otra que ocupa todo el ancho (los pagos de cada
 *   cuota en la tabla de amortización). Devuelve null para no agregar nada.
 * - `descripcion` va como <caption> oculto: el lector de pantalla anuncia qué es la tabla.
 */

export type Alineacion = "izquierda" | "derecha" | "centro"

export interface Columna<T> {
  clave: string
  encabezado: ReactNode
  celda: (fila: T) => ReactNode
  alinear?: Alineacion
  /** Contenido de la celda en el pie de totales */
  pie?: ReactNode
  /** Columna fija a la izquierda al desplazar. Solo tiene sentido en la primera */
  fija?: boolean
}

interface DataTableProps<T> {
  columnas: Columna<T>[]
  filas: T[]
  claveFila: (fila: T) => string | number
  /** Qué contiene la tabla, para el lector de pantalla */
  descripcion: string
  cargando?: boolean
  textoCargando?: string
  /** Lo que se muestra si no hay filas; normalmente un EmptyState */
  vacio?: ReactNode
  detalle?: (fila: T) => ReactNode
}

const ALINEACION: Record<Alineacion, string> = {
  izquierda: "text-left",
  derecha: "text-right tabular-nums",
  centro: "text-center",
}

function clasesCelda<T>(columna: Columna<T>, fondo: string) {
  return [
    "px-4 py-2",
    ALINEACION[columna.alinear ?? "izquierda"],
    // La celda fija necesita fondo propio para tapar lo que pasa por debajo
    columna.fija
      ? `sticky left-0 z-10 whitespace-nowrap shadow-[inset_-1px_0_0_var(--border-base)] ${fondo}`
      : "",
  ].join(" ")
}

export function DataTable<T>({
  columnas,
  filas,
  claveFila,
  descripcion,
  cargando = false,
  textoCargando,
  vacio,
  detalle,
}: DataTableProps<T>) {
  const conPie = columnas.some((c) => c.pie !== undefined)

  if (cargando) {
    return (
      <div className="rounded-xl border border-base bg-surface">
        <LoadingState texto={textoCargando} />
      </div>
    )
  }

  if (filas.length === 0 && vacio) {
    return <div className="rounded-xl border border-base bg-surface">{vacio}</div>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-base bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{descripcion}</caption>
        <thead>
          <tr className="border-b border-base">
            {columnas.map((c) => (
              <th
                key={c.clave}
                scope="col"
                className={`${clasesCelda(c, "bg-surface-2")} bg-surface-2 text-xs font-medium whitespace-nowrap text-secondary`}
              >
                {c.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const extra = detalle?.(fila)
            return (
              <Fragment key={claveFila(fila)}>
                <tr className="border-b border-base last:border-b-0">
                  {columnas.map((c) => (
                    <td key={c.clave} className={`${clasesCelda(c, "bg-surface")} text-primary`}>
                      {c.celda(fila)}
                    </td>
                  ))}
                </tr>
                {extra != null && extra !== false && (
                  <tr className="border-b border-base bg-surface-2 last:border-b-0">
                    <td colSpan={columnas.length} className="px-4 py-2 text-xs text-secondary">
                      {extra}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {conPie && (
          <tfoot>
            <tr className="border-t-2 border-base">
              {columnas.map((c) => (
                <td
                  key={c.clave}
                  className={`${clasesCelda(c, "bg-surface-2")} bg-surface-2 font-medium text-primary`}
                >
                  {c.pie}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
