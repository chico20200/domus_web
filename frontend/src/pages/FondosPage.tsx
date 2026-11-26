// src/pages/FondosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Landmark, Plus } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { DataTable } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { StatCard } from "../components/StatCard"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { fondosService } from "../api/fondos.service"
import type { Fondo } from "../api/fondos.types"
import { moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { DetalleFondo } from "./fondos/DetalleFondo"
import { FondoModal } from "./fondos/FondoModal"

/**
 * Fondos de caja (T19): dinero de la organización para sus actividades, aparte del que
 * se presta. Cada fondo tiene su nombre, su saldo, sus depósitos y sus retiros. Lo ven y
 * lo manejan el tesorero y el coordinador.
 */
export default function FondosPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  return <Fondos cajaId={cajaActiva.id} />
}

function Fondos({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()
  const cargar = useCallback(() => fondosService.getFondos(cajaId), [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)

  if (seleccionado) {
    return (
      <PageShell titulo="Fondos de caja" ancho="formulario">
        <DetalleFondo
          cajaId={cajaId}
          fondoId={seleccionado}
          onVolver={() => setSeleccionado(null)}
          onCambio={recargar}
        />
      </PageShell>
    )
  }

  const fondos = datos?.fondos ?? []
  const abiertos = fondos.filter((f) => f.activo).length
  const enlace =
    "w-fit text-left font-medium text-accion-texto hover:underline focus-visible:outline-2 focus-visible:outline-focus"

  return (
    <PageShell titulo="Fondos de caja" ancho="formulario">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-md text-sm text-secondary">
          Dinero de la caja para sus actividades. No se presta: no cuenta en el disponible para
          prestar ni en los intereses de los socios.
        </p>
        <Button
          label="Nuevo fondo"
          icon={Plus}
          disabled={cargando || !!error}
          onClick={() => setNuevo(true)}
        />
      </div>

      {!cargando && !error && fondos.length > 0 && (
        <StatCard
          etiqueta="Total en fondos"
          valor={moneda(datos?.total ?? 0)}
          detalle={`${abiertos} ${abiertos === 1 ? "fondo abierto" : "fondos abiertos"}`}
          icono={Landmark}
        />
      )}

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar los fondos: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : (
        <DataTable<Fondo>
          descripcion="Fondos de la caja con su estado y saldo"
          cargando={cargando}
          textoCargando="Cargando fondos…"
          filas={fondos}
          claveFila={(f) => f.id}
          vacio={
            <EmptyState
              icono={Landmark}
              titulo="Aún no hay fondos"
              descripcion="Crea un fondo para llevar aparte el dinero de las actividades de la caja, como un fondo social o de eventos."
            />
          }
          columnas={[
            {
              clave: "fondo",
              encabezado: "Fondo",
              celda: (f) => (
                <div className="flex flex-col">
                  <button type="button" onClick={() => setSeleccionado(f.id)} className={enlace}>
                    {f.nombre}
                  </button>
                  {f.descripcion && <span className="text-xs text-secondary">{f.descripcion}</span>}
                </div>
              ),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (f) => (
                <Badge
                  tono={f.activo ? "ok" : "neutral"}
                  label={f.activo ? "Abierto" : "Cerrado"}
                />
              ),
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alinear: "derecha",
              celda: (f) => <span className="font-medium tabular-nums">{moneda(f.saldo)}</span>,
            },
          ]}
        />
      )}

      {nuevo && (
        <FondoModal
          cajaId={cajaId}
          onCerrar={() => setNuevo(false)}
          onHecho={async (fondo) => {
            setNuevo(false)
            await recargar()
            toast("exito", `${fondo.nombre} creado`)
            setSeleccionado(fondo.id)
          }}
        />
      )}
    </PageShell>
  )
}
