import { useCallback, useMemo, useState } from "react"
import {
  Building2,
  FileSignature,
  Lock,
  NotebookText,
  Search,
  ShieldCheck,
  Users,
  UserX,
} from "lucide-react"
import { Tabs } from "../../components/Tabs"
import { DataTable, type Columna } from "../../components/DataTable"
import { StatCard } from "../../components/StatCard"
import { Badge } from "../../components/Badge"
import { Button } from "../../components/Button"
import { EmptyState } from "../../components/EmptyState"
import { InfoTip } from "../../components/InfoTip"
import { LoadingState } from "../../components/LoadingState"
import { Panel } from "../../components/Panel"
import { SelectField } from "../../components/SelectField"
import { TextField } from "../../components/TextField"
import { adminService } from "../../api/admin.service"
import type { CajaAdmin, CuentaAdmin, RegistroBitacora } from "../../api/admin.types"
import type { EstadoCuentaUsuario } from "../../api/profile.types"
import { AYUDA } from "../../lib/ayuda"
import { ESTADO_USUARIO } from "../../lib/cuentaUsuario"
import { fecha, fechaHora } from "../../lib/format"
import { ETIQUETA_ROL } from "../../lib/roles"
import { conPunto, normalizar } from "../../lib/texto"
import { useDatos } from "../../lib/useDatos"
import { useAuth } from "../../context/AuthContext"
import { useNotif } from "../../context/NotifContext"
import { BloqueoModal, type AccionBloqueo } from "./BloqueoModal"

/**
 * Panel del administrador del sistema (HU019, HU-S01): las cajas con su estado, fundación,
 * ciclo vigente y conteos, y las cuentas de usuario con su estado; bloquear y restablecer
 * cuentas y cajas con motivo (HU020, HU-S02) y la bitácora de esas acciones. Sin montos:
 * el backend no los envía.
 */

type Vista = "cajas" | "cuentas" | "bitacora"
type FiltroEstado = "" | EstadoCuentaUsuario

const OPCIONES_ESTADO = [
  { value: "", label: "Todos los estados" },
  ...(["activa", "inactiva", "pendiente", "bloqueada"] as const).map((e) => ({
    value: e,
    label: ESTADO_USUARIO[e].etiqueta,
  })),
]

export function PanelAdministracion() {
  const [vista, setVista] = useState<Vista>("cajas")
  const cargar = useCallback(async () => {
    const [cajas, cuentas, bitacora] = await Promise.all([
      adminService.getCajas(),
      adminService.getCuentas(),
      adminService.getBitacora(),
    ])
    return { cajas, cuentas, bitacora }
  }, [])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  if (cargando) return <LoadingState texto="Cargando cajas y cuentas…" />
  if (error || !datos) {
    return (
      <Panel>
        <p className="text-sm text-secondary">No se pudieron cargar los datos del panel: {error}</p>
        <div>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      </Panel>
    )
  }

  const bloqueadas = datos.cuentas.filter((c) => c.estado === "bloqueada").length
  const cajasBloqueadas = datos.cajas.filter((c) => c.estado === "bloqueada").length

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard etiqueta="Cajas" valor={datos.cajas.length} icono={Building2} />
        <StatCard etiqueta="Cajas bloqueadas" valor={cajasBloqueadas} icono={Lock} />
        <StatCard etiqueta="Cuentas de usuario" valor={datos.cuentas.length} icono={Users} />
        <StatCard etiqueta="Cuentas bloqueadas" valor={bloqueadas} icono={UserX} />
      </div>

      <Tabs<Vista>
        etiqueta="Vista del panel"
        valor={vista}
        onCambio={setVista}
        pestanas={[
          { id: "cajas", titulo: "Cajas" },
          { id: "cuentas", titulo: "Cuentas" },
          { id: "bitacora", titulo: "Bitácora" },
        ]}
      >
        {vista === "cajas" ? (
          <TablaCajas cajas={datos.cajas} onCambio={recargar} />
        ) : vista === "cuentas" ? (
          <TablaCuentas cuentas={datos.cuentas} onCambio={recargar} />
        ) : (
          <TablaBitacora registros={datos.bitacora} />
        )}
      </Tabs>
    </>
  )
}

function TablaCajas({ cajas, onCambio }: { cajas: CajaAdmin[]; onCambio: () => Promise<void> }) {
  const { toast } = useNotif()
  const [accion, setAccion] = useState<{ caja: CajaAdmin; tipo: AccionBloqueo } | null>(null)
  const columnas: Columna<CajaAdmin>[] = [
    { clave: "caja", encabezado: "Caja", celda: (c) => c.nombre, fija: true },
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (c) =>
        c.estado === "bloqueada" ? (
          <span className="flex flex-col items-start gap-1">
            <Badge label="Bloqueada" tono="destructivo" icon={Lock} />
            {c.estado_motivo && (
              <span className="max-w-64 text-xs whitespace-normal text-secondary">
                {conPunto(c.estado_motivo)}
                {c.estado_cambiado_en && ` Desde el ${fecha(c.estado_cambiado_en)}.`}
              </span>
            )}
          </span>
        ) : (
          <Badge label="Activa" tono="ok" />
        ),
    },
    {
      clave: "fundacion",
      encabezado: "Fundación",
      celda: (c) =>
        c.fecha_fundacion ? fecha(c.fecha_fundacion) : <span className="text-muted">—</span>,
    },
    {
      clave: "ciclo",
      encabezado: "Ciclo vigente",
      celda: (c) => c.ciclo_vigente ?? <span className="text-muted">—</span>,
    },
    { clave: "miembros", encabezado: "Cuentas", alinear: "derecha", celda: (c) => c.miembros },
    { clave: "socios", encabezado: "Socios", alinear: "derecha", celda: (c) => c.socios },
    {
      clave: "creditos",
      encabezado: "Créditos vigentes",
      alinear: "derecha",
      celda: (c) => c.creditos_vigentes,
    },
    {
      clave: "acciones",
      encabezado: <span className="sr-only">Acciones</span>,
      alinear: "derecha",
      celda: (c) =>
        c.estado === "bloqueada" ? (
          <Button
            label="Restablecer"
            variant="secondary"
            onClick={() => setAccion({ caja: c, tipo: "restablecer" })}
          />
        ) : (
          <Button
            label="Bloquear"
            variant="ghost"
            onClick={() => setAccion({ caja: c, tipo: "bloquear" })}
          />
        ),
    },
  ]
  return (
    <>
      <DataTable<CajaAdmin>
        descripcion="Cajas registradas con su estado, fundación y ciclo vigente, sus cuentas de usuario, fichas de socio activas y créditos por aprobar, al día o vencidos"
        filas={cajas}
        claveFila={(c) => c.id}
        columnas={columnas}
        vacio={<EmptyState icono={Building2} titulo="Aún no hay cajas registradas" />}
      />
      {accion && (
        <BloqueoModal
          objetivo={{ tipo: "caja", id: accion.caja.id, nombre: accion.caja.nombre }}
          accion={accion.tipo}
          onCerrar={() => setAccion(null)}
          onHecho={async () => {
            const { caja, tipo } = accion
            await onCambio()
            setAccion(null)
            toast(
              "exito",
              tipo === "bloquear"
                ? `Se bloqueó la caja ${caja.nombre}`
                : `Se restableció la caja ${caja.nombre}`,
            )
          }}
        />
      )}
    </>
  )
}

function TablaCuentas({
  cuentas,
  onCambio,
}: {
  cuentas: CuentaAdmin[]
  onCambio: () => Promise<void>
}) {
  const { user } = useAuth()
  const { toast } = useNotif()
  const [accion, setAccion] = useState<{ cuenta: CuentaAdmin; tipo: AccionBloqueo } | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>("")

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return cuentas.filter(
      (c) =>
        (!estado || c.estado === estado) &&
        (!q ||
          normalizar(
            `${c.correo} ${c.nombre ?? ""} ${c.cajas.map((x) => x.nombre).join(" ")}`,
          ).includes(q)),
    )
  }, [cuentas, busqueda, estado])

  const columnas: Columna<CuentaAdmin>[] = [
    {
      clave: "cuenta",
      encabezado: "Cuenta",
      fija: true,
      celda: (c) => (
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-medium text-primary">
            {c.correo}
            {c.es_admin_sistema && (
              <ShieldCheck size={16} className="text-accion-texto" aria-label="Administrador" />
            )}
          </span>
          <span className={c.nombre ? "text-xs text-secondary" : "text-xs text-muted"}>
            {c.nombre || "Sin nombre"}
          </span>
        </span>
      ),
    },
    {
      clave: "estado",
      encabezado: (
        <span className="inline-flex items-center gap-2">
          Estado
          <InfoTip ayuda={AYUDA.estadoCuenta} />
        </span>
      ),
      celda: (c) => (
        <span className="flex flex-col items-start gap-1">
          <Badge label={ESTADO_USUARIO[c.estado].etiqueta} tono={ESTADO_USUARIO[c.estado].tono} />
          {c.estado === "bloqueada" && c.motivo && (
            <span className="max-w-64 text-xs whitespace-normal text-secondary">
              {conPunto(c.motivo)} Desde el {fecha(c.desde)}.
            </span>
          )}
        </span>
      ),
    },
    {
      clave: "cajas",
      encabezado: "Cajas y rol",
      celda: (c) =>
        c.cajas.length === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {c.cajas.map((x) => (
              <li key={x.caja_id} className="text-sm">
                {x.nombre} <span className="text-secondary">· {ETIQUETA_ROL[x.rol] ?? x.rol}</span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      clave: "ingreso",
      encabezado: "Último ingreso",
      celda: (c) =>
        c.ultimo_ingreso ? fecha(c.ultimo_ingreso) : <span className="text-muted">Nunca</span>,
    },
    {
      clave: "acciones",
      encabezado: <span className="sr-only">Acciones</span>,
      alinear: "derecha",
      // La propia cuenta y las de otros administradores no se bloquean desde aquí (el
      // backend tampoco lo permite)
      celda: (c) =>
        c.estado === "bloqueada" ? (
          <Button
            label="Restablecer"
            variant="secondary"
            onClick={() => setAccion({ cuenta: c, tipo: "restablecer" })}
          />
        ) : c.id === user?.id || c.es_admin_sistema ? null : (
          <Button
            label="Bloquear"
            variant="ghost"
            onClick={() => setAccion({ cuenta: c, tipo: "bloquear" })}
          />
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_16rem]">
        <TextField
          label="Buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Correo, nombre o caja"
          icon={Search}
        />
        <SelectField
          label="Estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          options={OPCIONES_ESTADO}
        />
      </div>
      <DataTable<CuentaAdmin>
        descripcion="Cuentas de usuario con su estado, sus cajas y su último ingreso"
        filas={filtradas}
        claveFila={(c) => c.id}
        columnas={columnas}
        vacio={
          <EmptyState
            icono={Search}
            titulo={
              cuentas.length === 0
                ? "Aún no hay cuentas"
                : "Ninguna cuenta coincide con la búsqueda"
            }
          />
        }
      />
      {accion && (
        <BloqueoModal
          objetivo={{ tipo: "cuenta", id: accion.cuenta.id, nombre: accion.cuenta.correo }}
          accion={accion.tipo}
          onCerrar={() => setAccion(null)}
          onHecho={async () => {
            const { cuenta, tipo } = accion
            await onCambio()
            setAccion(null)
            toast(
              "exito",
              tipo === "bloquear"
                ? `Se bloqueó la cuenta ${cuenta.correo}`
                : `Se restableció la cuenta ${cuenta.correo}`,
            )
          }}
        />
      )}
    </div>
  )
}

/**
 * Bitácora de bloqueos y restablecimientos de cuentas y cajas (HU-S02) y de las
 * aceptaciones del acuerdo de confidencialidad con su versión (HU021, T28), la más
 * reciente primero
 */
function TablaBitacora({ registros }: { registros: RegistroBitacora[] }) {
  const columnas: Columna<RegistroBitacora>[] = [
    { clave: "fecha", encabezado: "Fecha", celda: (r) => fechaHora(r.fecha) },
    {
      clave: "accion",
      encabezado: "Acción",
      celda: (r) =>
        r.accion === "aceptar_acuerdo" ? (
          <Badge label="Acuerdo aceptado" tono="neutral" />
        ) : r.accion === "bloquear" || r.accion === "bloquear_caja" ? (
          <Badge label="Bloqueo" tono="destructivo" />
        ) : (
          <Badge label="Restablecimiento" tono="ok" />
        ),
    },
    {
      clave: "sobre",
      encabezado: "Sobre",
      celda: (r) =>
        r.accion === "aceptar_acuerdo" ? (
          <span className="inline-flex items-center gap-2">
            <FileSignature size={16} className="text-muted" aria-hidden="true" />
            Acuerdo de confidencialidad
            {r.version ? `, versión del ${fecha(r.version)}` : ""}
          </span>
        ) : r.caja_nombre ? (
          <span className="inline-flex items-center gap-2">
            <Building2 size={16} className="text-muted" aria-label="Caja" />
            {r.caja_nombre}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Users size={16} className="text-muted" aria-label="Cuenta" />
            {r.cuenta_correo}
          </span>
        ),
    },
    {
      clave: "motivo",
      encabezado: "Motivo",
      celda: (r) => (
        <span className="block max-w-80 whitespace-normal text-secondary">
          {r.motivo ? conPunto(r.motivo) : <span className="text-muted">—</span>}
        </span>
      ),
    },
    {
      clave: "admin",
      encabezado: "Por",
      celda: (r) => r.admin_correo ?? <span className="text-muted">Cuenta eliminada</span>,
    },
  ]
  return (
    <DataTable<RegistroBitacora>
      descripcion="Bloqueos y restablecimientos de cuentas y cajas, con su motivo y quién los hizo, y aceptaciones del acuerdo de confidencialidad"
      filas={registros}
      claveFila={(r) => r.id}
      columnas={columnas}
      vacio={
        <EmptyState
          icono={NotebookText}
          titulo="Aún no hay acciones registradas"
          descripcion="Cada bloqueo y cada restablecimiento quedan aquí con su motivo, y cada aceptación del acuerdo con su versión."
        />
      }
    />
  )
}
