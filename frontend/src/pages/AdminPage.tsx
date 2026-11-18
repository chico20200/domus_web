// src/pages/AdminPage.tsx
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { PaginaSinMenu } from "../components/layout/PaginaSinMenu"
import { Panel } from "../components/Panel"
import { Button } from "../components/Button"
import { EmptyState } from "../components/EmptyState"
import { LoadingState } from "../components/LoadingState"
import { adminService } from "../api/admin.service"
import { ApiError } from "../api/api.client"
import { fechaHora } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { AcuerdoConfidencialidad } from "./admin/AcuerdoConfidencialidad"

/**
 * Panel de administración del sistema (HU019 a HU021). Fuera de las cajas: no tiene barra
 * lateral ni depende de la caja activa. Quien no es administrador ve un aviso; el backend
 * igual rechaza cada petición. Antes del panel, el acuerdo de confidencialidad (HU-S03).
 */
export default function AdminPage() {
  const navigate = useNavigate()
  const cargar = useCallback(async () => {
    try {
      return { permitido: true as const, acuerdo: await adminService.getAcuerdo() }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) return { permitido: false as const }
      throw err
    }
  }, [])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  return (
    <PaginaSinMenu
      titulo="Administración de DOMUS"
      descripcion={datos?.permitido ? "Soporte a las cajas y bloqueo de cuentas." : undefined}
      acciones={<Button label="Mis cajas" variant="ghost" onClick={() => navigate("/cajas")} />}
    >
      {cargando ? (
        <LoadingState texto="Cargando el panel…" />
      ) : error || !datos ? (
        <Panel>
          <p className="text-sm text-secondary">No se pudo abrir el panel: {error}</p>
          <div>
            <Button label="Reintentar" variant="secondary" onClick={recargar} />
          </div>
        </Panel>
      ) : !datos.permitido ? (
        <div className="rounded-xl border border-base bg-surface">
          <EmptyState
            icono={ShieldAlert}
            titulo="Esta página es solo para la administración de DOMUS"
            descripcion="Tu cuenta no administra el sistema. Para trabajar con tu caja, vuelve a Mis cajas."
          />
        </div>
      ) : !datos.acuerdo.aceptado ? (
        <AcuerdoConfidencialidad onAceptado={recargar} />
      ) : (
        <Panel titulo="Panel de administración">
          <p className="text-sm text-secondary">
            Aceptaste el acuerdo de confidencialidad el {fechaHora(datos.acuerdo.aceptado_en)}.
          </p>
        </Panel>
      )}
    </PaginaSinMenu>
  )
}
