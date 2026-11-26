// src/pages/AhorrosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FileSpreadsheet, PiggyBank, Plus, Search, UserRoundX } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { ImportarExcelModal } from "../components/ImportarExcelModal"
import { TextField } from "../components/TextField"
import { Badge } from "../components/Badge"
import { DataTable, type Columna } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { StatCard } from "../components/StatCard"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { ahorrosService } from "../api/ahorros.service"
import { sociosService } from "../api/socios.service"
import type { CuentaAhorro } from "../api/ahorros.types"
import { moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { nombreSocio } from "../lib/creditos"
import { estadoCuenta } from "../lib/ahorros"
import { coincideSocio, normalizar } from "../lib/texto"
import { DetalleCuenta } from "./ahorros/DetalleCuenta"
import { NuevaCuentaModal } from "./ahorros/NuevaCuentaModal"

/**
 * Cuentas de ahorro. El tesorero y el coordinador ven todas las cuentas de la caja, abren
 * cuentas y registran depósitos y retiros. El socio ve solo las suyas, en solo lectura
 * (es la única página operativa que ve).
 */
export default function AhorrosPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  const puedeOperar = tieneRol(cajaActiva.rol, "tesorero")
  return puedeOperar ? (
    <AhorrosCaja cajaId={cajaActiva.id} />
  ) : (
    <MisAhorros cajaId={cajaActiva.id} />
  )
}

// ── Tesorero y coordinador ────────────────────────────────────

function AhorrosCaja({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()
  const cargar = useCallback(async () => {
    const [cuentas, socios] = await Promise.all([
      ahorrosService.getCuentas(cajaId),
      sociosService.getSocios(cajaId),
    ])
    return { cuentas: cuentas.cuentas, socios: socios.socios.filter((s) => s.activo) }
  }, [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)
  const [importando, setImportando] = useState(false)
  // Se queda al abrir una cuenta y volver: la lista vuelve filtrada como estaba
  const [busqueda, setBusqueda] = useState("")

  if (seleccionada) {
    return (
      <PageShell titulo="Ahorros" ancho="formulario">
        <DetalleCuenta
          cajaId={cajaId}
          cuentaId={seleccionada}
          puedeOperar
          textoVolver="Volver a cuentas"
          onVolver={() => setSeleccionada(null)}
          onCambio={recargar}
        />
      </PageShell>
    )
  }

  const cuentas = datos?.cuentas ?? []
  const total = cuentas.reduce((s, c) => s + Number(c.saldo), 0)
  const q = normalizar(busqueda.trim())
  const filtradas = cuentas.filter((c) => coincideSocio(c.socios, q))

  return (
    <PageShell titulo="Ahorros" ancho="formulario">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <TextField
            label="Buscar cuentas de un socio"
            ocultarEtiqueta
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cédula"
            icon={Search}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            label="Importar desde Excel"
            variant="secondary"
            icon={FileSpreadsheet}
            disabled={cargando}
            onClick={() => setImportando(true)}
          />
          <Button
            label="Abrir cuenta"
            icon={Plus}
            disabled={cargando || !!error}
            onClick={() => setNueva(true)}
          />
        </div>
      </div>

      {!cargando && !error && (
        <p className="text-sm text-secondary" aria-live="polite">
          {q
            ? `${filtradas.length} de ${cuentas.length} ${cuentas.length === 1 ? "cuenta" : "cuentas"} · ${moneda(filtradas.reduce((s, c) => s + Number(c.saldo), 0))} ahorrados`
            : `${cuentas.length} ${cuentas.length === 1 ? "cuenta" : "cuentas"} · ${moneda(total)} ahorrados`}
        </p>
      )}

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar las cuentas: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : (
        <DataTable<CuentaAhorro>
          descripcion="Cuentas de ahorro de la caja con su titular, estado y saldo"
          cargando={cargando}
          textoCargando="Cargando cuentas…"
          filas={filtradas}
          claveFila={(c) => c.id}
          vacio={
            q ? (
              <EmptyState
                icono={Search}
                titulo="Ninguna cuenta coincide con la búsqueda"
                descripcion="Prueba con otra parte del nombre o con la cédula del socio."
              />
            ) : (
              <EmptyState
                icono={PiggyBank}
                titulo="Aún no hay cuentas de ahorro"
                descripcion="Abre la primera cuenta para un socio y registra su depósito inicial."
              />
            )
          }
          columnas={columnas({ titular: true, onAbrir: setSeleccionada })}
        />
      )}

      {nueva && datos && (
        <NuevaCuentaModal
          cajaId={cajaId}
          socios={datos.socios}
          onCerrar={() => setNueva(false)}
          onCreada={async (numero) => {
            setNueva(false)
            await recargar()
            toast("exito", `Cuenta ${numero} abierta`)
          }}
        />
      )}
      {importando && (
        <ImportarExcelModal
          cajaId={cajaId}
          modulo="ahorros"
          onCerrar={() => setImportando(false)}
        />
      )}
    </PageShell>
  )
}

// ── Socio ─────────────────────────────────────────────────────

function MisAhorros({ cajaId }: { cajaId: string }) {
  // El servidor encuentra la ficha del socio (por usuario o por correo) y devuelve solo
  // sus cuentas: el socio no recibe las fichas ni las cuentas de los demás
  const cargar = useCallback(() => ahorrosService.getMisCuentas(cajaId), [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)

  if (seleccionada) {
    return (
      <PageShell titulo="Mis ahorros" ancho="formulario">
        <DetalleCuenta
          cajaId={cajaId}
          cuentaId={seleccionada}
          puedeOperar={false}
          textoVolver="Volver a mis cuentas"
          onVolver={() => setSeleccionada(null)}
          onCambio={recargar}
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell titulo="Mis ahorros" ancho="formulario">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar tus cuentas: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      </PageShell>
    )
  }

  if (datos && !datos.vinculado) {
    return (
      <PageShell titulo="Mis ahorros" ancho="formulario">
        <div className="rounded-xl border border-base bg-surface">
          <EmptyState
            icono={UserRoundX}
            titulo="Tu usuario aún no está vinculado a una ficha de socio"
            descripcion="Pide al tesorero que registre tu ficha con el mismo correo con el que entras a DOMUS. Después verás aquí tus cuentas."
          />
        </div>
      </PageShell>
    )
  }

  const cuentas = datos?.cuentas ?? []
  const total = cuentas.reduce((s, c) => s + Number(c.saldo), 0)

  return (
    <PageShell titulo="Mis ahorros" ancho="formulario">
      {cuentas.length > 0 && (
        <StatCard
          etiqueta="Total ahorrado"
          valor={moneda(total)}
          detalle={`En ${cuentas.length} ${cuentas.length === 1 ? "cuenta" : "cuentas"}`}
          icono={PiggyBank}
          destacada
        />
      )}
      <DataTable<CuentaAhorro>
        descripcion="Tus cuentas de ahorro en esta caja"
        cargando={cargando}
        textoCargando="Cargando tus cuentas…"
        filas={cuentas}
        claveFila={(c) => c.id}
        vacio={
          <EmptyState
            icono={PiggyBank}
            titulo="Aún no tienes cuentas de ahorro"
            descripcion="El tesorero de la caja abre las cuentas. Cuando tengas una, la verás aquí."
          />
        }
        columnas={columnas({ titular: false, onAbrir: setSeleccionada })}
      />
    </PageShell>
  )
}

// ── Columnas compartidas ──────────────────────────────────────

function columnas({
  titular,
  onAbrir,
}: {
  titular: boolean
  onAbrir: (id: string) => void
}): Columna<CuentaAhorro>[] {
  const enlace =
    "w-fit text-left font-medium text-accion-texto hover:underline focus-visible:outline-2 focus-visible:outline-focus"
  return [
    {
      clave: "cuenta",
      encabezado: titular ? "Socio" : "Cuenta",
      celda: (c) =>
        titular ? (
          <div className="flex flex-col">
            <button type="button" onClick={() => onAbrir(c.id)} className={enlace}>
              {nombreSocio(c.socios)}
            </button>
            <span className="text-xs text-secondary">Cuenta {c.numero_cuenta}</span>
          </div>
        ) : (
          <button type="button" onClick={() => onAbrir(c.id)} className={enlace}>
            Cuenta {c.numero_cuenta}
          </button>
        ),
    },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (c) => {
        const e = estadoCuenta(c.estado)
        return <Badge tono={e.tono} label={e.etiqueta} />
      },
    },
    {
      clave: "saldo",
      encabezado: "Saldo",
      alinear: "derecha",
      celda: (c) => <span className="font-medium tabular-nums">{moneda(Number(c.saldo))}</span>,
    },
  ]
}
