// src/pages/ReportesPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarClock,
  CircleDollarSign,
  Download,
  Percent,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { SelectField } from "../components/SelectField"
import { InfoTip } from "../components/InfoTip"
import { AYUDA } from "../lib/ayuda"
import { StatCard } from "../components/StatCard"
import { Badge } from "../components/Badge"
import { DataTable, type Columna } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { LoadingState } from "../components/LoadingState"
import { Tabs } from "../components/Tabs"
import { useCaja } from "../context/CajaContext"
import { reportesService } from "../api/reportes.service"
import { ApiError } from "../api/api.client"
import type { DistribucionResponse, FilaMes, InteresSocio } from "../api/reportes.types"
import { fecha, moneda, porcentaje } from "../lib/format"
import { TIPO_REPARTO } from "../lib/reparto"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { mesCorto } from "./reportes/meses"
import { descargarReporte } from "./reportes/pdfReporte"
import { PasarSobranteModal } from "./reportes/PasarSobranteModal"
import { DetalleSocioModal } from "./reportes/DetalleSocioModal"

/**
 * Reportes del ciclo (rehecho en T25): primero la respuesta, con tres cifras (interés
 * generado, lo que faltó por cobrar y el rendimiento) y lo que recibe cada socio; al
 * pulsar un socio, de dónde sale su interés. El aviso de que el reparto no cuadra sale
 * solo cuando no cuadra. Sin periodo configurado no hay ciclos, y la página lo explica
 * en vez de mostrar un error.
 */
export default function ReportesPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  return <Reportes cajaId={cajaActiva.id} esCoordinador={tieneRol(cajaActiva.rol, "coordinador")} />
}

type Vista = "socios" | "mensual"

function Reportes({ cajaId, esCoordinador }: { cajaId: string; esCoordinador: boolean }) {
  const navigate = useNavigate()
  // null: el ciclo actual (el backend lo elige)
  const [cicloPedido, setCicloPedido] = useState<number | null>(null)
  const [vista, setVista] = useState<Vista>("socios")
  const [detalle, setDetalle] = useState<InteresSocio | null>(null)
  const [pasandoSobrante, setPasandoSobrante] = useState(false)

  const cargar = useCallback(async () => {
    const ciclo = cicloPedido ?? undefined
    try {
      const [dist, estado] = await Promise.all([
        reportesService.getDistribucion(cajaId, ciclo),
        reportesService.getEstadoCaja(cajaId, ciclo),
      ])
      return { sinPeriodo: false as const, dist, estado }
    } catch (err) {
      if (err instanceof ApiError && err.datos.requiere_configuracion) {
        return { sinPeriodo: true as const }
      }
      throw err
    }
  }, [cajaId, cicloPedido])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  if (cargando) {
    return (
      <PageShell titulo="Reportes" ancho="completo">
        <LoadingState texto="Calculando el reporte…" />
      </PageShell>
    )
  }

  if (error || !datos) {
    return (
      <PageShell titulo="Reportes" ancho="completo">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudo calcular el reporte: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      </PageShell>
    )
  }

  if (datos.sinPeriodo) {
    return (
      <PageShell titulo="Reportes" ancho="completo">
        <div className="rounded-xl border border-base bg-surface">
          <EmptyState
            icono={CalendarClock}
            titulo="La caja aún no tiene periodo configurado"
            descripcion={
              esCoordinador
                ? "Los reportes reparten los intereses por ciclo. Configura la fecha de fundación y la duración del ciclo para verlos."
                : "Los reportes reparten los intereses por ciclo. Pide al coordinador de la caja que configure el periodo."
            }
            accion={
              esCoordinador ? (
                <Button label="Configurar el periodo" onClick={() => navigate("/configuracion")} />
              ) : undefined
            }
          />
        </div>
      </PageShell>
    )
  }

  const { dist, estado } = datos
  // Mientras llega el ciclo recién elegido, se sigue viendo el anterior, atenuado
  const actualizando = cicloPedido !== null && dist.ciclo.numero !== cicloPedido
  // Un ciclo cerrado se mide a su fin; uno en curso, a hoy (T24)
  const cerrado = estado.ciclo.cerrado
  const equitativa = dist.tipo === "equitativa"
  const falta = estado.falta_por_cobrar
  const mesesConInteres = dist.meses.filter((m) => m.interes_mes > 0)

  const columnasMes: Columna<FilaMes>[] = [
    { clave: "mes", encabezado: "Mes", celda: (m) => mesCorto(m.mes), pie: "Total" },
    {
      clave: "capital",
      encabezado: "Capital de la caja",
      alinear: "derecha",
      celda: (m) => moneda(m.capital_total),
    },
    {
      clave: "interes",
      encabezado: "Interés recaudado",
      alinear: "derecha",
      celda: (m) => moneda(m.interes_mes),
      pie: moneda(dist.interes_total),
    },
    // Equitativa: entre cuántos se divide cada mes y cuánto le toca a cada uno
    ...(dist.tipo === "equitativa"
      ? ([
          {
            clave: "socios",
            encabezado: "Socios",
            alinear: "derecha",
            celda: (m) => m.participantes ?? 0,
          },
          {
            clave: "parte",
            encabezado: "Parte de cada uno",
            alinear: "derecha",
            celda: (m) => (m.parte ? moneda(m.parte) : <span className="text-muted">—</span>),
          },
        ] satisfies Columna<FilaMes>[])
      : ([
          {
            clave: "rendimiento",
            encabezado: "Rendimiento del mes",
            alinear: "derecha",
            celda: (m) => (
              <span className={m.tasa_mes > 0 ? "" : "text-muted"}>{porcentaje(m.tasa_mes)}</span>
            ),
            pie: porcentaje(dist.tasa_acumulada),
          },
        ] satisfies Columna<FilaMes>[])),
  ]

  const columnasSocio: Columna<InteresSocio>[] = [
    {
      clave: "socio",
      encabezado: "Socio",
      celda: (s) => (
        <span className="flex flex-col">
          <button
            type="button"
            onClick={() => setDetalle(s)}
            aria-label={`De dónde sale el interés de ${s.nombre}`}
            className="w-fit text-left font-medium text-accion-texto hover:underline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {s.nombre}
          </button>
          {!s.activo && s.fecha_salida && (
            <span className="text-xs text-secondary">Salió el {fecha(s.fecha_salida)}</span>
          )}
        </span>
      ),
      fija: true,
      pie: "Total repartido",
    },
    {
      clave: "ahorro",
      encabezado: cerrado ? "Ahorro al cierre" : "Ahorro hoy",
      alinear: "derecha",
      celda: (s) => <span className="text-secondary">{moneda(s.saldo_final)}</span>,
    },
    // Diferenciada: lo que generó cada socio cada mes. Equitativa: sin ese dato (se
    // reparte en partes iguales), solo en cuántos de los meses con interés recibió
    ...(equitativa
      ? [
          {
            clave: "meses",
            encabezado: "Meses con parte",
            alinear: "derecha",
            celda: (s) =>
              `${s.por_mes.filter((p, i) => p.interes > 0 && dist.meses[i].interes_mes > 0).length} de ${mesesConInteres.length}`,
          } satisfies Columna<InteresSocio>,
        ]
      : dist.meses.map((m, i): Columna<InteresSocio> => ({
          clave: m.mes,
          encabezado: mesCorto(m.mes),
          alinear: "derecha",
          celda: (s) => {
            const interes = s.por_mes[i]?.interes ?? 0
            return interes > 0 ? moneda(interes) : <span className="text-muted">—</span>
          },
          pie: moneda(m.interes_mes),
        }))),
    {
      clave: "total",
      encabezado: "Recibe",
      alinear: "derecha",
      celda: (s) => <span className="font-medium">{moneda(s.interes_total)}</span>,
      pie: moneda(dist.validacion.interes_repartido),
    },
  ]

  return (
    <PageShell titulo="Reportes" ancho="completo">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-primary">
            Distribución de intereses
            <InfoTip ayuda={AYUDA.distribucionIntereses} />
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-secondary">
            <span>
              Ciclo {dist.ciclo.numero} · {dist.ciclo.label} · {TIPO_REPARTO[dist.tipo].etiqueta}
            </span>
            <Badge
              tono={cerrado ? "neutral" : "ok"}
              label={cerrado ? "Cerrado" : `En curso, hasta hoy ${fecha(estado.corte)}`}
            />
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {dist.ciclos_disponibles.length > 1 && (
            <div className="w-80">
              <SelectField
                label="Ciclo"
                value={String(cicloPedido ?? dist.ciclo.numero)}
                onChange={(e) => setCicloPedido(Number(e.target.value))}
                options={dist.ciclos_disponibles.map((c) => ({
                  value: String(c.numero),
                  label: `Ciclo ${c.numero} · ${c.label}${c.actual ? " (actual)" : ""}`,
                }))}
              />
            </div>
          )}
          <Button
            label="Descargar PDF"
            icon={Download}
            disabled={actualizando}
            onClick={() => descargarReporte(dist, estado)}
          />
        </div>
      </div>

      <div
        aria-busy={actualizando}
        className={`flex flex-col gap-8 transition-opacity ${actualizando ? "opacity-50" : ""}`}
      >
        <section
          aria-label="La respuesta del ciclo"
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <StatCard
            etiqueta="Interés generado"
            valor={moneda(dist.interes_total)}
            detalle={`Cobrado en el ciclo${cerrado ? "" : " hasta hoy"}; se reparte entre ${dist.por_socio.length} ${dist.por_socio.length === 1 ? "socio" : "socios"}`}
            icono={TrendingUp}
            destacada
          />
          <StatCard
            etiqueta="Faltó por cobrar"
            valor={moneda(falta.total)}
            detalle={
              falta.cuotas === 0
                ? `Se pagaron todas las cuotas que vencieron en el ciclo${cerrado ? "" : " hasta hoy"}`
                : `${falta.cuotas} ${falta.cuotas === 1 ? "cuota vencida" : "cuotas vencidas"} de ${falta.creditos} ${falta.creditos === 1 ? "crédito" : "créditos"}; ${moneda(falta.interes)} de interés`
            }
            icono={CircleDollarSign}
          />
          <StatCard
            etiqueta="Rendimiento del ciclo"
            valor={porcentaje(dist.tasa_acumulada)}
            detalle="Suma del rendimiento de cada mes: interés sobre el ahorro de la caja"
            icono={Percent}
          />
        </section>

        {!dist.validacion.cuadra && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border-l-[3px] border-destructivo bg-surface-2 p-4"
          >
            <span className="flex h-5 shrink-0 items-center">
              <TriangleAlert size={18} className="text-destructivo" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium text-primary">
                El reparto no cuadra con el interés generado
              </p>
              <p className="text-secondary">
                Quedaron {moneda(dist.validacion.diferencia)} sin repartir: hubo meses con interés y
                sin {equitativa ? "socios en la caja" : "ahorro en la caja"}. Se repartieron{" "}
                {moneda(dist.validacion.interes_repartido)} de{" "}
                {moneda(dist.validacion.interes_generado)}.
              </p>
            </div>
          </div>
        )}

        <Tabs<Vista>
          etiqueta="Vista del reporte"
          valor={vista}
          onCambio={setVista}
          pestanas={[
            { id: "socios", titulo: "Lo que recibe cada socio" },
            { id: "mensual", titulo: "Mes a mes" },
          ]}
        >
          {vista === "socios" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-secondary">
                Pulsa un socio para ver de dónde sale su interés.
              </p>
              <DataTable<InteresSocio>
                descripcion={
                  equitativa
                    ? "Lo que recibe cada socio en el ciclo"
                    : "Interés que generó cada socio, por mes, y lo que recibe en el ciclo"
                }
                filas={dist.por_socio}
                claveFila={(s) => s.socio_id}
                columnas={columnasSocio}
                vacio={
                  <EmptyState
                    icono={Users}
                    titulo="No hubo socios en este ciclo"
                    descripcion="El interés se reparte entre los socios con ahorros."
                  />
                }
              />
              <Sobrante
                dist={dist}
                onPasar={() => setPasandoSobrante(true)}
                deshabilitado={actualizando}
              />
            </div>
          ) : (
            <DataTable<FilaMes>
              descripcion={
                dist.tipo === "equitativa"
                  ? "Interés recaudado de cada mes y la parte que le toca a cada socio activo"
                  : "Capital, interés recaudado y rendimiento de cada mes del ciclo"
              }
              filas={dist.meses}
              claveFila={(m) => m.mes}
              columnas={columnasMes}
            />
          )}
        </Tabs>
      </div>
      {detalle && (
        <DetalleSocioModal dist={dist} socio={detalle} onCerrar={() => setDetalle(null)} />
      )}
      {pasandoSobrante && (
        <PasarSobranteModal
          cajaId={cajaId}
          ciclo={dist.ciclo}
          monto={dist.validacion.sobrante}
          onCerrar={() => setPasandoSobrante(false)}
          onPasado={recargar}
        />
      )}
    </PageShell>
  )
}

/**
 * Qué pasa con los centavos que sobran (T23): en un ciclo en curso, todavía cambian; en
 * uno cerrado, se pasan a un fondo una sola vez; si ya se pasaron, a cuál y cuándo.
 */
function Sobrante({
  dist,
  onPasar,
  deshabilitado,
}: {
  dist: DistribucionResponse
  onPasar: () => void
  deshabilitado: boolean
}) {
  const registrado = dist.sobrante_registrado
  if (registrado) {
    return (
      <p className="text-sm text-secondary">
        Los {moneda(registrado.monto)} que sobraron se pasaron a {registrado.fondo} el{" "}
        {fecha(registrado.fecha)}.
      </p>
    )
  }
  if (!(dist.validacion.sobrante > 0)) return null
  if (!dist.ciclo.cerrado) {
    return (
      <p className="text-sm text-secondary">
        Al redondear cada parte sobran {moneda(dist.validacion.sobrante)} hasta hoy; van a Fondos de
        caja cuando el ciclo cierre.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <p className="text-sm text-secondary">
        Al redondear cada parte sobraron {moneda(dist.validacion.sobrante)}; van a Fondos de caja.
      </p>
      <Button
        label={`Pasar ${moneda(dist.validacion.sobrante)} a Fondos`}
        variant="secondary"
        compacto
        disabled={deshabilitado}
        onClick={onPasar}
      />
    </div>
  )
}
