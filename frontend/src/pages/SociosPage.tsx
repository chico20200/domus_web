// src/pages/SociosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Link2, Pencil, Search, UserPlus, Users, UserX } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { DataTable } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { TextField } from "../components/TextField"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { sociosService } from "../api/socios.service"
import type { Socio } from "../api/socios.types"
import { fecha } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { normalizar } from "../lib/texto"
import { SocioModal } from "./socios/SocioModal"

/**
 * Fichas de socio de la caja. El tesorero y el coordinador registran y editan fichas;
 * solo el coordinador desactiva. Desactivar conserva cuentas y créditos.
 */
export default function SociosPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  return <Socios cajaId={cajaActiva.id} puedeDesactivar={tieneRol(cajaActiva.rol, "coordinador")} />
}

// La búsqueda ignora tildes y mayúsculas: "perez" encuentra a "Pérez" (normalizar)
function Socios({ cajaId, puedeDesactivar }: { cajaId: string; puedeDesactivar: boolean }) {
  const { toast, confirm } = useNotif()
  const cargar = useCallback(async () => (await sociosService.getSocios(cajaId)).socios, [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [busqueda, setBusqueda] = useState("")
  // null: cerrado; "nuevo": ficha nueva; un Socio: edición
  const [modal, setModal] = useState<Socio | "nuevo" | null>(null)

  const socios = datos ?? []
  const activos = socios.filter((s) => s.activo).length
  const q = normalizar(busqueda.trim())
  const filtrados = socios
    .filter((s) => !q || normalizar(`${s.nombre} ${s.apellido} ${s.cedula}`).includes(q))
    // Activos primero; dentro de cada grupo, por apellido
    .sort(
      (a, b) =>
        Number(b.activo) - Number(a.activo) ||
        a.apellido.localeCompare(b.apellido, "es") ||
        a.nombre.localeCompare(b.nombre, "es"),
    )

  async function desactivar(socio: Socio) {
    const ok = await confirm({
      titulo: `¿Desactivar a ${socio.nombre} ${socio.apellido}?`,
      mensaje:
        "Su ficha queda inactiva y deja de aparecer al abrir cuentas o solicitar créditos. Sus cuentas y créditos se conservan.",
      labelOk: "Desactivar",
      peligroso: true,
    })
    if (!ok) return
    try {
      await sociosService.desactivar(cajaId, socio.id)
      await recargar()
      toast("exito", `${socio.nombre} ${socio.apellido} quedó inactivo`)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo desactivar")
    }
  }

  return (
    <PageShell titulo="Socios" ancho="completo">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-sm">
          <TextField
            label="Buscar socio"
            ocultarEtiqueta
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cédula"
            icon={Search}
          />
        </div>
        <Button
          label="Registrar socio"
          icon={UserPlus}
          disabled={cargando || !!error}
          onClick={() => setModal("nuevo")}
        />
      </div>

      {!cargando && !error && (
        <p className="text-sm text-secondary" aria-live="polite">
          {q
            ? `${filtrados.length} de ${socios.length} ${socios.length === 1 ? "socio" : "socios"}`
            : `${activos} ${activos === 1 ? "socio activo" : "socios activos"}${socios.length > activos ? ` · ${socios.length - activos} ${socios.length - activos === 1 ? "inactivo" : "inactivos"}` : ""}`}
        </p>
      )}

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar los socios: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : (
        <DataTable<Socio>
          descripcion="Fichas de socio con su cédula, contacto, fecha de ingreso y estado"
          cargando={cargando}
          textoCargando="Cargando socios…"
          filas={filtrados}
          claveFila={(s) => s.id}
          vacio={
            q ? (
              <EmptyState
                icono={Search}
                titulo="Ningún socio coincide con la búsqueda"
                descripcion="Prueba con otra parte del nombre o con la cédula."
              />
            ) : (
              <EmptyState
                icono={Users}
                titulo="Aún no hay socios en esta caja"
                descripcion="Registra la ficha de cada persona que ahorra en la caja. No hace falta que use DOMUS."
              />
            )
          }
          columnas={[
            {
              clave: "socio",
              encabezado: "Socio",
              celda: (s) => (
                <div className="flex flex-col">
                  <span className={s.activo ? "font-medium text-primary" : "text-secondary"}>
                    {s.nombre} {s.apellido}
                  </span>
                  {s.user_id && (
                    <span className="flex items-center gap-1 text-xs text-secondary">
                      <Link2 size={12} aria-hidden="true" />
                      Vinculado a una cuenta de DOMUS
                    </span>
                  )}
                </div>
              ),
            },
            {
              clave: "cedula",
              encabezado: "Cédula",
              celda: (s) => <span className="tabular-nums">{s.cedula}</span>,
            },
            {
              clave: "contacto",
              encabezado: "Contacto",
              celda: (s) =>
                s.telefono || s.email ? (
                  <div className="flex flex-col">
                    {s.telefono && <span className="tabular-nums">{s.telefono}</span>}
                    {s.email && <span className="text-xs text-secondary">{s.email}</span>}
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              clave: "ingreso",
              encabezado: "Ingreso",
              celda: (s) => <span className="whitespace-nowrap">{fecha(s.fecha_ingreso)}</span>,
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (s) => (
                <Badge
                  tono={s.activo ? "ok" : "neutral"}
                  label={s.activo ? "Activo" : "Inactivo"}
                />
              ),
            },
            {
              clave: "acciones",
              encabezado: <span className="sr-only">Acciones</span>,
              alinear: "derecha",
              celda: (s) => {
                const nombre = `${s.nombre} ${s.apellido}`
                return (
                  <div className="flex justify-end gap-1">
                    <BotonFila
                      etiqueta={`Editar a ${nombre}`}
                      icono={Pencil}
                      onClick={() => setModal(s)}
                    />
                    {puedeDesactivar &&
                      (s.activo ? (
                        <BotonFila
                          etiqueta={`Desactivar a ${nombre}`}
                          icono={UserX}
                          peligroso
                          onClick={() => desactivar(s)}
                        />
                      ) : (
                        // Hueco del mismo ancho: el lápiz queda alineado con el de las otras filas
                        <span className="h-9 w-9" aria-hidden="true" />
                      ))}
                  </div>
                )
              },
            },
          ]}
        />
      )}

      {modal && (
        <SocioModal
          cajaId={cajaId}
          socio={modal === "nuevo" ? undefined : modal}
          onCerrar={() => setModal(null)}
          onGuardado={async (s) => {
            const nuevo = modal === "nuevo"
            setModal(null)
            await recargar()
            toast(
              "exito",
              nuevo
                ? `${s.nombre} ${s.apellido} quedó registrado`
                : `Ficha de ${s.nombre} ${s.apellido} actualizada`,
            )
          }}
        />
      )}
    </PageShell>
  )
}

/** Botón de solo ícono para una fila; el nombre del socio va en `aria-label` y `title` */
function BotonFila({
  etiqueta,
  icono: Icono,
  peligroso = false,
  onClick,
}: {
  etiqueta: string
  icono: typeof Pencil
  peligroso?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-2",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        peligroso ? "text-destructivo" : "text-secondary hover:text-primary",
      ].join(" ")}
    >
      <Icono size={16} aria-hidden="true" />
    </button>
  )
}
