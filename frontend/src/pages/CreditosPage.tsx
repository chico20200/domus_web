// src/pages/CreditosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CreditCard, Plus } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { DataTable } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { creditosService } from "../api/creditos.service"
import { sociosService } from "../api/socios.service"
import type { Credito } from "../api/creditos.types"
import { moneda, porcentaje } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { estadoCredito, nombreSocio } from "../lib/creditos"
import { DetalleCredito } from "./creditos/DetalleCredito"
import { NuevaSolicitudModal } from "./creditos/NuevaSolicitudModal"

/**
 * Créditos de la caja: lista, nueva solicitud y detalle de cada crédito.
 * El detalle reemplaza a la lista en la misma página; "Volver" regresa a ella.
 */
export default function CreditosPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  return (
    <Creditos
      cajaId={cajaActiva.id}
      nombreCaja={cajaActiva.nombre}
      puedeOperar={tieneRol(cajaActiva.rol, "tesorero")}
    />
  )
}

function Creditos({
  cajaId,
  nombreCaja,
  puedeOperar,
}: {
  cajaId: string
  nombreCaja: string
  puedeOperar: boolean
}) {
  const { toast } = useNotif()

  const cargar = useCallback(async () => {
    const [creditos, socios] = await Promise.all([
      creditosService.getCreditos(cajaId),
      sociosService.getSocios(cajaId),
    ])
    return { creditos: creditos.creditos, socios: socios.socios.filter((s) => s.activo) }
  }, [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [nuevaSolicitud, setNuevaSolicitud] = useState(false)

  if (seleccionado) {
    return (
      <PageShell titulo="Créditos" ancho="formulario">
        <DetalleCredito
          cajaId={cajaId}
          nombreCaja={nombreCaja}
          creditoId={seleccionado}
          puedeOperar={puedeOperar}
          onVolver={() => setSeleccionado(null)}
          onCambio={recargar}
        />
      </PageShell>
    )
  }

  const creditos = datos?.creditos ?? []

  return (
    <PageShell titulo="Créditos" ancho="formulario">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {cargando
            ? "Cargando…"
            : `${creditos.length} ${creditos.length === 1 ? "crédito" : "créditos"}`}
        </p>
        {puedeOperar && (
          <Button
            label="Nueva solicitud"
            icon={Plus}
            disabled={cargando}
            onClick={() => setNuevaSolicitud(true)}
          />
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar los créditos: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : (
        <DataTable<Credito>
          descripcion="Créditos de la caja con su monto, saldo y estado"
          cargando={cargando}
          textoCargando="Cargando créditos…"
          filas={creditos}
          claveFila={(c) => c.id}
          vacio={
            <EmptyState
              icono={CreditCard}
              titulo="Aún no hay créditos"
              descripcion={
                puedeOperar ? "Crea una solicitud para el primer socio que lo pida." : undefined
              }
            />
          }
          columnas={[
            {
              clave: "socio",
              encabezado: "Socio",
              celda: (c) => (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setSeleccionado(c.id)}
                    className="w-fit text-left font-medium text-accion-texto hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {nombreSocio(c.socios)}
                  </button>
                  <span className="text-xs text-secondary">
                    {c.plazo_meses} meses · {porcentaje(c.tasa_interes)}
                  </span>
                </div>
              ),
            },
            {
              clave: "monto",
              encabezado: "Monto",
              alinear: "derecha",
              celda: (c) => moneda(c.monto_solicitado),
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alinear: "derecha",
              celda: (c) => moneda(c.saldo_pendiente),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (c) => {
                const e = estadoCredito(c.estado)
                return <Badge tono={e.tono} label={e.etiqueta} />
              },
            },
          ]}
        />
      )}

      {nuevaSolicitud && datos && (
        <NuevaSolicitudModal
          cajaId={cajaId}
          socios={datos.socios}
          onCerrar={() => setNuevaSolicitud(false)}
          onCreado={async () => {
            setNuevaSolicitud(false)
            await recargar()
            toast("exito", "Solicitud creada. Queda pendiente de aprobación.")
          }}
        />
      )}
    </PageShell>
  )
}
