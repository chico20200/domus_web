// src/pages/SociosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarClock,
  FileSpreadsheet,
  History,
  Link2,
  Pencil,
  Search,
  UserPlus,
  Users,
  UserX,
} from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { ImportarExcelModal } from "../components/ImportarExcelModal"
import { Badge } from "../components/Badge"
import { DataTable } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { TextField } from "../components/TextField"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { sociosService } from "../api/socios.service"
import type { Socio } from "../api/socios.types"
import { fecha, moneda } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { tieneRol } from "../lib/roles"
import { coincideSocio, normalizar } from "../lib/texto"
import { SocioModal } from "./socios/SocioModal"
import { CorregirIngresoModal } from "./socios/CorregirIngresoModal"
import { SalidaModal } from "./socios/SalidaModal"

/**
 * Fichas de socio de la caja. El tesorero y el coordinador registran y editan fichas;
 * solo el coordinador registra la salida de un socio, con su liquidación (Etapa 7, T6).
 * De quien ya salió se ven sus liquidaciones.
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
  const { toast } = useNotif()
  const cargar = useCallback(async () => (await sociosService.getSocios(cajaId)).socios, [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [busqueda, setBusqueda] = useState("")
  const [importando, setImportando] = useState(false)
  // null: cerrado; "nuevo": ficha nueva; un Socio: edición
  const [modal, setModal] = useState<Socio | "nuevo" | null>(null)
  // Solo el coordinador (el mismo permiso que desactivar): corregir la fecha de ingreso
  const [corrigiendo, setCorrigiendo] = useState<Socio | null>(null)
  // La salida con liquidación (activo) o el historial de sus liquidaciones (inactivo)
  const [saliendo, setSaliendo] = useState<Socio | null>(null)

  const socios = datos ?? []
  const activos = socios.filter((s) => s.activo).length
  const q = normalizar(busqueda.trim())
  const filtrados = socios
    .filter((s) => coincideSocio(s, q))
    // Activos primero; dentro de cada grupo, por apellido
    .sort(
      (a, b) =>
        Number(b.activo) - Number(a.activo) ||
        a.apellido.localeCompare(b.apellido, "es") ||
        a.nombre.localeCompare(b.nombre, "es"),
    )

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
        <div className="flex flex-wrap gap-3">
          <Button
            label="Importar desde Excel"
            variant="secondary"
            icon={FileSpreadsheet}
            disabled={cargando}
            onClick={() => setImportando(true)}
          />
          <Button
            label="Registrar socio"
            icon={UserPlus}
            disabled={cargando || !!error}
            onClick={() => setModal("nuevo")}
          />
        </div>
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
                          etiqueta={`Corregir la fecha de ingreso de ${nombre}`}
                          icono={CalendarClock}
                          onClick={() => setCorrigiendo(s)}
                        />
                      ) : (
                        <span className="h-9 w-9" aria-hidden="true" />
                      ))}
                    {s.activo && puedeDesactivar ? (
                      <BotonFila
                        etiqueta={`Registrar la salida de ${nombre}`}
                        icono={UserX}
                        peligroso
                        onClick={() => setSaliendo(s)}
                      />
                    ) : !s.activo ? (
                      <BotonFila
                        etiqueta={`Ver las liquidaciones de ${nombre}`}
                        icono={History}
                        onClick={() => setSaliendo(s)}
                      />
                    ) : (
                      // Hueco del mismo ancho: el lápiz queda alineado con el de las otras filas
                      <span className="h-9 w-9" aria-hidden="true" />
                    )}
                  </div>
                )
              },
            },
          ]}
        />
      )}

      {corrigiendo && (
        <CorregirIngresoModal
          cajaId={cajaId}
          socio={corrigiendo}
          onCerrar={() => setCorrigiendo(null)}
          onCorregido={async (nueva) => {
            const s = corrigiendo
            setCorrigiendo(null)
            await recargar()
            toast("exito", `Fecha de ingreso de ${s.nombre} ${s.apellido}: ${fecha(nueva)}`)
          }}
        />
      )}

      {saliendo && (
        <SalidaModal
          cajaId={cajaId}
          socio={saliendo}
          puedeRegistrar={puedeDesactivar}
          onCerrar={() => setSaliendo(null)}
          onRegistrada={async (l) => {
            const s = saliendo
            setSaliendo(null)
            await recargar()
            toast(
              "exito",
              `Salida de ${s.nombre} ${s.apellido} registrada: recibió ${moneda(Number(l.neto))}`,
            )
          }}
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
      {importando && (
        <ImportarExcelModal
          cajaId={cajaId}
          modulo="socios"
          onCerrar={() => setImportando(false)}
          onImportado={recargar}
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
