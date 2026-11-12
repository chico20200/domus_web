// src/pages/ConfiguracionPage.tsx
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PageShell } from "../components/layout/PageShell"
import { Panel } from "../components/Panel"
import { Badge } from "../components/Badge"
import { useCaja } from "../context/CajaContext"
import { ETIQUETA_ROL } from "../lib/roles"
import { PeriodoCaja } from "./configuracion/PeriodoCaja"
import { CodigoInvitacion } from "./configuracion/CodigoInvitacion"
import { MiembrosCaja } from "./configuracion/MiembrosCaja"

/**
 * Configuración de la caja activa. Cada sección es un componente que carga sus propios
 * datos, así un fallo en una no deja en blanco las demás.
 *
 * Periodo e invitaciones son solo del coordinador. La lista de miembros la ven todos.
 */
export default function ConfiguracionPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null

  const esCoordinador = cajaActiva.rol === "coordinador"

  return (
    <PageShell titulo="Configuración" ancho="formulario">
      <Panel titulo={cajaActiva.nombre} descripcion={cajaActiva.descripcion || undefined}>
        <p className="flex items-center gap-2 text-sm text-secondary">
          Tu rol en esta caja: <Badge tono="neutral" label={ETIQUETA_ROL[cajaActiva.rol]} />
        </p>
      </Panel>

      {esCoordinador && <PeriodoCaja cajaId={cajaActiva.id} />}
      {esCoordinador && <CodigoInvitacion cajaId={cajaActiva.id} />}
      <MiembrosCaja cajaId={cajaActiva.id} esCoordinador={esCoordinador} />
    </PageShell>
  )
}
