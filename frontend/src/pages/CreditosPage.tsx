// src/pages/CreditosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CreditCard, FileSpreadsheet, Plus, Search } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { ImportarExcelModal } from "../components/ImportarExcelModal"
import { TextField } from "../components/TextField"
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
import { coincideCredito, estadoCredito, nombreSocio, numeroCredito } from "../lib/creditos"
import { normalizar } from "../lib/texto"
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
    const [creditos, socios, config] = await Promise.all([
      creditosService.getCreditos(cajaId),
      sociosService.getSocios(cajaId),
      creditosService.getConfig(cajaId),
    ])
    return {
      creditos: creditos.creditos,
      socios: socios.socios.filter((s) => s.activo),
      montoMaximo: config.monto_maximo_credito,
    }
  }, [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [nuevaSolicitud, setNuevaSolicitud] = useState(false)
  const [importando, setImportando] = useState(false)
  // Se queda al abrir un crédito y volver: la lista vuelve filtrada como estaba
  const [busqueda, setBusqueda] = useState("")

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
  const q = normalizar(busqueda.trim())
  const filtrados = creditos.filter((c) => coincideCredito(c, q))

  return (
    <PageShell titulo="Créditos" ancho="formulario">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <TextField
            label="Buscar créditos por socio o número"
            ocultarEtiqueta
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cédula o número"
            icon={Search}
          />
        </div>
        {puedeOperar && (
          <div className="flex flex-wrap gap-3">
            <Button
              label="Importar desde Excel"
              variant="secondary"
              icon={FileSpreadsheet}
              disabled={cargando}
              onClick={() => setImportando(true)}
            />
            <Button
              label="Nueva solicitud"
              icon={Plus}
              disabled={cargando}
              onClick={() => setNuevaSolicitud(true)}
            />
          </div>
        )}
      </div>

      {!cargando && !error && (
        <p className="text-sm text-secondary" aria-live="polite">
          {q
            ? `${filtrados.length} de ${creditos.length} ${creditos.length === 1 ? "crédito" : "créditos"}`
            : `${creditos.length} ${creditos.length === 1 ? "crédito" : "créditos"}`}
        </p>
      )}

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
          filas={filtrados}
          claveFila={(c) => c.id}
          vacio={
            q ? (
              <EmptyState
                icono={Search}
                titulo="Ningún crédito coincide con la búsqueda"
                descripcion="Prueba con otra parte del nombre, con la cédula del socio o con el número del crédito."
              />
            ) : (
              <EmptyState
                icono={CreditCard}
                titulo="Aún no hay créditos"
                descripcion={
                  puedeOperar ? "Crea una solicitud para el primer socio que lo pida." : undefined
                }
              />
            )
          }
          columnas={[
            {
              clave: "numero",
              encabezado: "N.º",
              alinear: "derecha",
              celda: (c) => <span className="tabular-nums">{c.numero}</span>,
            },
            {
              clave: "socio",
              encabezado: "Socio",
              celda: (c) => (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setSeleccionado(c.id)}
                    aria-label={`${nombreSocio(c.socios)}, crédito ${numeroCredito(c.numero)}`}
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
                const e = estadoCredito(c)
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
          montoMaximo={datos.montoMaximo}
          onCerrar={() => setNuevaSolicitud(false)}
          onCreado={async () => {
            setNuevaSolicitud(false)
            await recargar()
            toast("exito", "Solicitud creada. Queda pendiente de aprobación.")
          }}
        />
      )}
      {importando && (
        <ImportarExcelModal
          cajaId={cajaId}
          modulo="creditos"
          onCerrar={() => setImportando(false)}
        />
      )}
    </PageShell>
  )
}
