import { useCallback, useState } from "react"
import { Check, Copy, RefreshCw } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { SelectField } from "../../components/SelectField"
import { LoadingState } from "../../components/LoadingState"
import { useNotif } from "../../context/NotifContext"
import { miembrosService } from "../../api/miembros.service"
import type { Invitacion, RolInvitado } from "../../api/miembros.types"
import { ETIQUETA_ROL } from "../../lib/roles"
import { fecha } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"

/**
 * Código de invitación: el coordinador lo genera y la persona lo usa en "Unirse a una
 * caja". El rol con que entra lo fija el código. Dura 7 días o hasta que alguien lo use,
 * y generar uno nuevo invalida el anterior (lo hace el backend).
 */

const OPCIONES_ROL = [
  { value: "socio", label: ETIQUETA_ROL.socio },
  { value: "tesorero", label: ETIQUETA_ROL.tesorero },
]

export function CodigoInvitacion({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()

  const cargarVigente = useCallback(() => miembrosService.invitacionActiva(cajaId), [cajaId])
  const { datos: vigente, cargando } = useDatos(cargarVigente)
  // El código recién generado reemplaza al que vino del servidor
  const [generado, setGenerado] = useState<Invitacion | null>(null)
  const invitacion = generado ?? vigente
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [rolElegido, setRol] = useState<RolInvitado | null>(null)
  const rol: RolInvitado = rolElegido ?? invitacion?.rol ?? "socio"

  async function generar() {
    setGenerando(true)
    try {
      setGenerado(await miembrosService.generarInvitacion(cajaId, rol))
      setCopiado(false)
      toast("exito", "Código generado. El anterior ya no sirve.")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo generar el código")
    } finally {
      setGenerando(false)
    }
  }

  async function copiar() {
    if (!invitacion) return
    try {
      await navigator.clipboard.writeText(invitacion.codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast("error", "No se pudo copiar. Selecciona el código y cópialo a mano.")
    }
  }

  return (
    <Panel
      titulo="Código de invitación"
      descripcion="Comparte el código con la persona que quieres agregar. Lo usa en «Unirse a una caja» y entra con el rol que elijas aquí. Dura 7 días o hasta que alguien lo use."
    >
      {cargando && <LoadingState texto="Buscando el código vigente…" />}

      {!cargando && invitacion && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-control bg-surface-2 px-4 py-3">
            <span className="font-mono text-2xl font-semibold tracking-widest text-primary select-all">
              {invitacion.codigo}
            </span>
            <Button
              label={copiado ? "Copiado" : "Copiar"}
              variant="secondary"
              icon={copiado ? Check : Copy}
              onClick={copiar}
            />
          </div>
          <p className="text-sm text-secondary">
            Entra como <strong className="font-medium">{ETIQUETA_ROL[invitacion.rol]}</strong> ·
            Vence el {fecha(invitacion.expira_at)}
          </p>
          {/* Anuncia "Copiado" al lector de pantalla sin mover el foco */}
          <span className="sr-only" aria-live="polite">
            {copiado ? "Código copiado al portapapeles" : ""}
          </span>
        </div>
      )}

      {!cargando && !invitacion && (
        <p className="text-sm text-secondary">No hay un código vigente.</p>
      )}

      {!cargando && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <SelectField
              label="Rol de quien entra"
              value={rol}
              onChange={(e) => setRol(e.target.value as RolInvitado)}
              options={OPCIONES_ROL}
            />
          </div>
          <Button
            label={invitacion ? "Generar otro código" : "Generar código"}
            variant="secondary"
            icon={invitacion ? RefreshCw : undefined}
            loading={generando}
            onClick={generar}
          />
        </div>
      )}
    </Panel>
  )
}
