// src/pages/DashboardPage.tsx
import { useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CreditCard, History, TrendingUp, Users, Wallet } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { Panel } from "../components/Panel"
import { StatCard } from "../components/StatCard"
import { DataTable } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { LoadingState } from "../components/LoadingState"
import { useCaja } from "../context/CajaContext"
import { resumenService } from "../api/resumen.service"
import type { TransaccionReciente } from "../api/resumen.types"
import { fecha, moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { nombreSocio } from "../lib/creditos"
import { SiguientesPasos } from "./dashboard/SiguientesPasos"

/**
 * Resumen de la caja para el tesorero y el coordinador: ahorros, socios, créditos y los
 * últimos cinco movimientos. Al coordinador de una caja que recién empieza le muestra
 * los siguientes pasos (último paso del asistente de creación, §5.1).
 */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  return (
    <Dashboard
      cajaId={cajaActiva.id}
      nombreCaja={cajaActiva.nombre}
      esCoordinador={cajaActiva.rol === "coordinador"}
    />
  )
}

interface DashboardProps {
  cajaId: string
  nombreCaja: string
  esCoordinador: boolean
}

function Dashboard({ cajaId, nombreCaja, esCoordinador }: DashboardProps) {
  const navigate = useNavigate()
  const cargar = useCallback(() => resumenService.getResumen(cajaId), [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  if (cargando) {
    return (
      <PageShell titulo="Dashboard" ancho="completo">
        <LoadingState texto="Cargando el resumen…" />
      </PageShell>
    )
  }

  if (error || !datos) {
    return (
      <PageShell titulo="Dashboard" ancho="completo">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudo cargar el resumen: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      </PageShell>
    )
  }

  const { resumen, transaccionesRecientes, caja } = datos
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

  return (
    <PageShell titulo="Dashboard" ancho="completo">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-primary">{caja?.nombre ?? nombreCaja}</h2>
        <p className="text-sm text-secondary">
          {caja?.descripcion || "Resumen general de la caja"}
        </p>
      </div>

      {esCoordinador && <SiguientesPasos resumen={resumen} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          etiqueta="Ahorros"
          valor={moneda(resumen.saldoTotal)}
          detalle="Saldo de las cuentas activas"
          icono={Wallet}
          destacada
        />
        <StatCard
          etiqueta="Socios activos"
          valor={String(resumen.totalSocios)}
          detalle={plural(resumen.totalMiembros, "usuario con acceso", "usuarios con acceso")}
          icono={Users}
        />
        <StatCard
          etiqueta="Créditos activos"
          valor={String(resumen.creditosActivos)}
          detalle="Desembolsados y sin terminar de pagar"
          icono={CreditCard}
        />
        <StatCard
          etiqueta="Por cobrar"
          valor={moneda(resumen.saldoPendiente)}
          detalle="Saldo pendiente de los créditos activos"
          icono={TrendingUp}
        />
      </div>

      <Panel
        titulo="Movimientos recientes"
        descripcion="Los últimos cinco depósitos y retiros de la caja"
        acciones={
          transaccionesRecientes.length > 0 ? (
            <Button label="Ver ahorros" variant="ghost" onClick={() => navigate("/ahorros")} />
          ) : undefined
        }
        sinRelleno
      >
        <DataTable<TransaccionReciente>
          descripcion="Últimos movimientos de ahorro de la caja"
          sinMarco
          filas={transaccionesRecientes}
          claveFila={(t) => t.id}
          vacio={
            <EmptyState
              icono={History}
              titulo="Aún no hay movimientos"
              descripcion="Los depósitos y retiros que se registren en Ahorros aparecerán aquí."
              accion={
                <Button
                  label="Ir a Ahorros"
                  variant="secondary"
                  onClick={() => navigate("/ahorros")}
                />
              }
            />
          }
          columnas={[
            {
              clave: "socio",
              encabezado: "Socio",
              celda: (t) => (
                <span className="font-medium text-primary">
                  {nombreSocio(t.cuentas_ahorro?.socios)}
                </span>
              ),
            },
            {
              clave: "movimiento",
              encabezado: "Movimiento",
              celda: (t) => (
                <div className="flex flex-col">
                  <span>{t.tipo === "deposito" ? "Depósito" : "Retiro"}</span>
                  {t.descripcion && <span className="text-xs text-secondary">{t.descripcion}</span>}
                </div>
              ),
            },
            {
              clave: "fecha",
              encabezado: "Fecha",
              celda: (t) => <span className="whitespace-nowrap">{fecha(t.created_at)}</span>,
            },
            {
              clave: "monto",
              encabezado: "Monto",
              alinear: "derecha",
              celda: (t) =>
                t.tipo === "deposito" ? (
                  <span className="whitespace-nowrap text-estado-ok">
                    + {moneda(Number(t.monto))}
                  </span>
                ) : (
                  <span className="whitespace-nowrap">− {moneda(Number(t.monto))}</span>
                ),
            },
          ]}
        />
      </Panel>
    </PageShell>
  )
}
