// src/pages/ReportesPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarClock,
  CircleCheck,
  CreditCard,
  Download,
  PieChart,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { SelectField } from "../components/SelectField"
import { StatCard } from "../components/StatCard"
import { DataTable, type Columna } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { LoadingState } from "../components/LoadingState"
import { Tabs } from "../components/Tabs"
import { useCaja } from "../context/CajaContext"
import { reportesService } from "../api/reportes.service"
import { ApiError } from "../api/api.client"
import type { FilaMes, InteresSocio } from "../api/reportes.types"
import { moneda, porcentaje } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { mesCorto } from "./reportes/meses"
import { descargarReporte } from "./reportes/pdfReporte"

/**
 * Reportes del ciclo: si el reparto de intereses cuadra, el estado de la caja, el interés
 * por mes y el interés que le toca a cada socio. Sin periodo configurado no hay ciclos, y
 * la página lo explica en vez de mostrar un error.
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

type Vista = "mensual" | "socios"

function Reportes({ cajaId, esCoordinador }: { cajaId: string; esCoordinador: boolean }) {
  const navigate = useNavigate()
  // null: el ciclo actual (el backend lo elige)
  const [cicloPedido, setCicloPedido] = useState<number | null>(null)
  const [vista, setVista] = useState<Vista>("mensual")

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
    {
      clave: "rendimiento",
      encabezado: "Rendimiento del mes",
      alinear: "derecha",
      celda: (m) => (
        <span className={m.tasa_mes > 0 ? "" : "text-muted"}>{porcentaje(m.tasa_mes, 4)}</span>
      ),
      pie: porcentaje(dist.tasa_acumulada, 4),
    },
  ]

  const columnasSocio: Columna<InteresSocio>[] = [
    {
      clave: "socio",
      encabezado: "Socio",
      celda: (s) => s.nombre,
      fija: true,
      pie: "Total repartido",
    },
    {
      clave: "ahorro",
      encabezado: "Ahorro final",
      alinear: "derecha",
      celda: (s) => <span className="text-secondary">{moneda(s.saldo_final)}</span>,
    },
    ...dist.meses.map((m, i): Columna<InteresSocio> => ({
      clave: m.mes,
      encabezado: mesCorto(m.mes),
      alinear: "derecha",
      celda: (s) => {
        const interes = s.por_mes[i]?.interes ?? 0
        return interes > 0 ? moneda(interes) : <span className="text-muted">—</span>
      },
      pie: moneda(m.interes_mes),
    })),
    {
      clave: "total",
      encabezado: "Total",
      alinear: "derecha",
      celda: (s) => <span className="font-medium">{moneda(s.interes_total)}</span>,
      pie: moneda(dist.validacion.interes_repartido),
    },
  ]

  return (
    <PageShell titulo="Reportes" ancho="completo">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-primary">Distribución de intereses</h2>
          <p className="text-sm text-secondary">
            Ciclo {dist.ciclo.numero} · {dist.ciclo.label}
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
        <div
          className={[
            "flex items-start gap-3 rounded-lg border-l-[3px] bg-surface-2 p-4",
            dist.validacion.cuadra ? "border-estado-ok" : "border-destructivo",
          ].join(" ")}
        >
          {dist.validacion.cuadra ? (
            <CircleCheck size={18} className="mt-0.5 shrink-0 text-estado-ok" aria-hidden="true" />
          ) : (
            <TriangleAlert
              size={18}
              className="mt-0.5 shrink-0 text-destructivo"
              aria-hidden="true"
            />
          )}
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium text-primary">
              {dist.validacion.cuadra
                ? "El reparto cuadra"
                : "El reparto no cuadra con el interés generado"}
            </p>
            <p className="text-secondary">
              Interés generado {moneda(dist.validacion.interes_generado)} · repartido{" "}
              {moneda(dist.validacion.interes_repartido)}
              {!dist.validacion.cuadra && ` · diferencia ${moneda(dist.validacion.diferencia)}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            etiqueta="Total ahorrado"
            valor={moneda(estado.total_ahorros)}
            detalle="Saldo actual de las cuentas"
            icono={Wallet}
            destacada
          />
          <StatCard
            etiqueta="Interés del ciclo"
            valor={moneda(estado.interes_recaudado)}
            detalle={`Rendimiento ${porcentaje(dist.tasa_acumulada, 4)}`}
            icono={TrendingUp}
          />
          <StatCard
            etiqueta="Por cobrar"
            valor={moneda(estado.por_cobrar)}
            detalle={`${estado.creditos.activos} ${estado.creditos.activos === 1 ? "crédito activo" : "créditos activos"}`}
            icono={CreditCard}
          />
          <StatCard
            etiqueta="Disponible en caja"
            valor={moneda(estado.en_caja)}
            detalle="Ahorros más interés histórico, menos lo prestado"
            icono={PieChart}
          />
        </div>

        <Tabs<Vista>
          etiqueta="Vista del reporte"
          valor={vista}
          onCambio={setVista}
          pestanas={[
            { id: "mensual", titulo: "Resumen mensual" },
            { id: "socios", titulo: "Interés por socio" },
          ]}
        >
          {vista === "mensual" ? (
            <DataTable<FilaMes>
              descripcion="Capital, interés recaudado y rendimiento de cada mes del ciclo"
              filas={dist.meses}
              claveFila={(m) => m.mes}
              columnas={columnasMes}
            />
          ) : (
            <DataTable<InteresSocio>
              descripcion="Interés que le corresponde a cada socio, por mes y en total"
              filas={dist.por_socio}
              claveFila={(s) => s.socio_id}
              columnas={columnasSocio}
              vacio={
                <EmptyState
                  icono={Users}
                  titulo="No hay socios activos en este ciclo"
                  descripcion="El interés se reparte entre los socios con ahorros."
                />
              }
            />
          )}
        </Tabs>
      </div>
    </PageShell>
  )
}
