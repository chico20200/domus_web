import { useCallback } from "react"
import { UserMinus, Users } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { SelectField } from "../../components/SelectField"
import { LoadingState } from "../../components/LoadingState"
import { EmptyState } from "../../components/EmptyState"
import { Badge } from "../../components/Badge"
import { useNotif } from "../../context/NotifContext"
import { useAuth } from "../../context/AuthContext"
import { miembrosService } from "../../api/miembros.service"
import type { Miembro } from "../../api/miembros.types"
import { ETIQUETA_ROL, normalizarRol } from "../../lib/roles"
import { useDatos } from "../../lib/useDatos"

/**
 * Cuentas de usuario con acceso a la caja (no confundir con las fichas de socio).
 * Todos la ven; solo el coordinador cambia roles y remueve. En la fila propia no hay
 * controles: el backend no deja cambiar el rol propio ni removerse a sí mismo.
 */

const OPCIONES_ROL = (["socio", "tesorero", "coordinador"] as const).map((r) => ({
  value: r,
  label: ETIQUETA_ROL[r],
}))

interface MiembrosCajaProps {
  cajaId: string
  esCoordinador: boolean
}

export function MiembrosCaja({ cajaId, esCoordinador }: MiembrosCajaProps) {
  const { toast, confirm } = useNotif()
  const { user } = useAuth()

  const cargarMiembros = useCallback(() => miembrosService.listar(cajaId), [cajaId])
  const { datos, cargando, error: errorCarga, recargar } = useDatos(cargarMiembros)
  const miembros = datos ?? []

  async function cambiarRol(m: Miembro, valor: string) {
    const nuevoRol = normalizarRol(valor)
    const rolActual = normalizarRol(m.rol)
    if (!nuevoRol || nuevoRol === rolActual) return
    // Dar o quitar el rol de coordinador cambia quién controla la caja: se confirma.
    // Entre tesorero y socio el cambio se aplica directo. Si se cancela, la lista vuelve
    // sola al rol de antes porque su valor sale de los datos.
    if (nuevoRol === "coordinador" || rolActual === "coordinador") {
      const subir = nuevoRol === "coordinador"
      const ok = await confirm({
        titulo: subir
          ? `¿Hacer coordinador a ${nombreDe(m)}?`
          : `¿Quitar el rol de coordinador a ${nombreDe(m)}?`,
        mensaje: subir
          ? "Tendrá control total de la caja: podrá cambiar el periodo, invitar y remover miembros y cambiar sus roles, también el tuyo."
          : `Pasará a ser ${ETIQUETA_ROL[nuevoRol].toLowerCase()} y ya no podrá configurar la caja ni gestionar a los miembros.`,
        labelOk: subir ? "Hacer coordinador" : "Quitar el rol",
      })
      if (!ok) return
    }
    try {
      await miembrosService.cambiarRol(cajaId, m.id, nuevoRol)
      await recargar()
      toast("exito", `${nombreDe(m)} ahora es ${ETIQUETA_ROL[nuevoRol]}`)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo cambiar el rol")
    }
  }

  async function remover(m: Miembro) {
    const ok = await confirm({
      titulo: `¿Remover a ${nombreDe(m)}?`,
      mensaje: "Pierde el acceso a esta caja. Su ficha de socio, si tiene, no se borra.",
      labelOk: "Remover",
      peligroso: true,
    })
    if (!ok) return
    try {
      await miembrosService.remover(cajaId, m.id)
      await recargar()
      toast("exito", `${nombreDe(m)} ya no tiene acceso a la caja`)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo remover al miembro")
    }
  }

  return (
    <Panel
      titulo={cargando || errorCarga ? "Miembros" : `Miembros (${miembros.length})`}
      descripcion="Cuentas de usuario con acceso a esta caja. El rol vale solo dentro de esta caja."
      sinRelleno
    >
      {cargando && <LoadingState texto="Cargando miembros…" />}

      {!cargando && errorCarga && (
        <div className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-secondary">No se pudo cargar la lista de miembros.</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && !errorCarga && miembros.length === 0 && (
        <EmptyState icono={Users} titulo="Aún no hay miembros" />
      )}

      {!cargando && !errorCarga && miembros.length > 0 && (
        <ul>
          {miembros.map((m) => {
            const esYo = m.id === user?.id
            // Mientras la base no se migre, puede llegar "admin": se muestra como coordinador
            const rol = normalizarRol(m.rol)
            const editable = esCoordinador && !esYo
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-4 border-b border-base px-6 py-3 last:border-b-0"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-medium text-secondary"
                  aria-hidden="true"
                >
                  {(m.profiles?.nombre || m.email)?.[0]?.toUpperCase() ?? "?"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">
                    {nombreDe(m)}
                    {esYo && <span className="font-normal text-muted"> (tú)</span>}
                  </p>
                  {m.profiles?.nombre && (
                    <p className="truncate text-xs text-secondary">{m.email}</p>
                  )}
                </div>

                {editable ? (
                  <>
                    <div className="w-40">
                      <SelectField
                        label={`Rol de ${nombreDe(m)}`}
                        ocultarEtiqueta
                        value={rol ?? ""}
                        onChange={(e) => cambiarRol(m, e.target.value)}
                        options={OPCIONES_ROL}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remover(m)}
                      aria-label={`Remover a ${nombreDe(m)}`}
                      title="Remover de la caja"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-destructivo transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <UserMinus size={16} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <Badge tono="neutral" label={rol ? ETIQUETA_ROL[rol] : String(m.rol)} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function nombreDe(m: Miembro) {
  return m.profiles?.nombre || m.email || "Sin nombre"
}
