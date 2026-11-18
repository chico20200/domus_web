import { useCallback, useMemo, useState } from "react"
import { Building2, Search, ShieldCheck, Users, UserX } from "lucide-react"
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
import type { CajaAdmin, CuentaAdmin } from "../../api/admin.types"
import type { EstadoCuentaUsuario } from "../../api/profile.types"
import { AYUDA } from "../../lib/ayuda"
import { ESTADO_USUARIO } from "../../lib/cuentaUsuario"
import { fecha } from "../../lib/format"
import { ETIQUETA_ROL } from "../../lib/roles"
import { conPunto, normalizar } from "../../lib/texto"
import { useDatos } from "../../lib/useDatos"

/**
 * Panel del administrador del sistema (HU019, HU-S01): las cajas con sus conteos y las
 * cuentas de usuario con su estado. Sin montos: el backend no los envía.
 */

type Vista = "cajas" | "cuentas"
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
    const [cajas, cuentas] = await Promise.all([adminService.getCajas(), adminService.getCuentas()])
    return { cajas, cuentas }
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

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard etiqueta="Cajas" valor={datos.cajas.length} icono={Building2} />
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
        ]}
      >
        {vista === "cajas" ? (
          <TablaCajas cajas={datos.cajas} />
        ) : (
          <TablaCuentas cuentas={datos.cuentas} />
        )}
      </Tabs>
    </>
  )
}

function TablaCajas({ cajas }: { cajas: CajaAdmin[] }) {
  const columnas: Columna<CajaAdmin>[] = [
    { clave: "caja", encabezado: "Caja", celda: (c) => c.nombre, fija: true },
    { clave: "creada", encabezado: "Registrada", celda: (c) => fecha(c.creada_en) },
    { clave: "miembros", encabezado: "Cuentas", alinear: "derecha", celda: (c) => c.miembros },
    { clave: "socios", encabezado: "Socios", alinear: "derecha", celda: (c) => c.socios },
    {
      clave: "creditos",
      encabezado: "Créditos vigentes",
      alinear: "derecha",
      celda: (c) => c.creditos_vigentes,
    },
  ]
  return (
    <DataTable<CajaAdmin>
      descripcion="Cajas registradas con sus cuentas de usuario, fichas de socio activas y créditos por aprobar, al día o en mora"
      filas={cajas}
      claveFila={(c) => c.id}
      columnas={columnas}
      vacio={<EmptyState icono={Building2} titulo="Aún no hay cajas registradas" />}
    />
  )
}

function TablaCuentas({ cuentas }: { cuentas: CuentaAdmin[] }) {
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
    </div>
  )
}
