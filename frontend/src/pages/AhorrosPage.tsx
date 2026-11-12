// src/pages/AhorrosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PiggyBank, Plus, UserRoundX } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { DataTable, type Columna } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { StatCard } from "../components/StatCard"
import { useCaja } from "../context/CajaContext"
import { useAuth } from "../context/AuthContext"
import { useNotif } from "../context/NotifContext"
import { ahorrosService } from "../api/ahorros.service"
import { sociosService } from "../api/socios.service"
import type { CuentaAhorro } from "../api/ahorros.types"
import { moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { nombreSocio } from "../lib/creditos"
import { estadoCuenta } from "../lib/ahorros"
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
  const { user } = useAuth()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  const puedeOperar = tieneRol(cajaActiva.rol, "tesorero")
  return puedeOperar ? (
    <AhorrosCaja cajaId={cajaActiva.id} />
  ) : (
    <MisAhorros cajaId={cajaActiva.id} userId={user?.id} email={user?.email} />
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

  return (
    <PageShell titulo="Ahorros" ancho="formulario">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {cargando
            ? "Cargando…"
            : `${cuentas.length} ${cuentas.length === 1 ? "cuenta" : "cuentas"} · ${moneda(total)} ahorrados`}
        </p>
        <Button
          label="Abrir cuenta"
          icon={Plus}
          disabled={cargando || !!error}
          onClick={() => setNueva(true)}
        />
      </div>

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
          filas={cuentas}
          claveFila={(c) => c.id}
          vacio={
            <EmptyState
              icono={PiggyBank}
              titulo="Aún no hay cuentas de ahorro"
              descripcion="Abre la primera cuenta para un socio y registra su depósito inicial."
            />
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
    </PageShell>
  )
}

// ── Socio ─────────────────────────────────────────────────────

function MisAhorros({
  cajaId,
  userId,
  email,
}: {
  cajaId: string
  userId?: string
  email?: string
}) {
  // La ficha del socio se busca por usuario y, si aún no está vinculada, por correo
  const cargar = useCallback(async () => {
    const { socios } = await sociosService.getSocios(cajaId)
    const correo = email?.toLowerCase()
    const miSocio = socios.find(
      (s) => (userId && s.user_id === userId) || (correo && s.email?.toLowerCase() === correo),
    )
    if (!miSocio) return { vinculado: false as const }
    const { cuentas } = await ahorrosService.getCuentasSocio(cajaId, miSocio.id)
    return { vinculado: true as const, cuentas }
  }, [cajaId, userId, email])
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
