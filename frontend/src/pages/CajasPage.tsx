// src/pages/CajasPage.tsx
import { useCallback, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Briefcase,
  Building2,
  ChevronRight,
  KeyRound,
  Plus,
  Shield,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"
import { PaginaSinMenu } from "../components/layout/PaginaSinMenu"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { EmptyState } from "../components/EmptyState"
import { LoadingState } from "../components/LoadingState"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { cajasService } from "../api/cajas.service"
import type { MiCaja } from "../api/cajas.types"
import { ETIQUETA_ROL, inicioDeRol, type RolCaja } from "../lib/roles"
import { useDatos } from "../lib/useDatos"
import { UnirseModal } from "./cajas/UnirseModal"

/**
 * Mis cajas: elegir la caja con la que trabajar, crear una o unirse con un código.
 * Crear y unirse tienen el mismo peso (HU004). Crear lleva al asistente de /cajas/nueva
 * (§5.1); unirse abre el modal del código.
 */

const ICONO_ROL: Record<RolCaja, LucideIcon> = {
  coordinador: Shield,
  tesorero: Briefcase,
  socio: Users,
}

/**
 * Crear y unirse: dos tarjetas iguales, una al lado de la otra (HU-C02, §5.4). Ninguna
 * es la acción principal: depende de si la organización ya usa DOMUS.
 */
function OpcionCaja({
  icono: Icono,
  titulo,
  texto,
  onClick,
}: {
  icono: LucideIcon
  titulo: string
  texto: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border border-base bg-surface p-4 text-left transition-colors hover:border-accion-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accion-texto">
        <Icono size={20} aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-primary">{titulo}</span>
        <span className="text-sm text-secondary">{texto}</span>
      </span>
    </button>
  )
}

export default function CajasPage() {
  const navigate = useNavigate()
  const { setCajaActiva } = useCaja()
  const { toast } = useNotif()
  const cargar = useCallback(async () => (await cajasService.getMisCajas()).cajas, [])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  // /cajas?unirse abre directo el modal del código (enlace del asistente de creación)
  const [params, setParams] = useSearchParams()
  const [unirse, setUnirseState] = useState(() => params.has("unirse"))
  function setUnirse(abierto: boolean) {
    setUnirseState(abierto)
    if (!abierto && params.has("unirse")) setParams({}, { replace: true })
  }

  function entrar(caja: MiCaja) {
    setCajaActiva(caja)
    navigate(inicioDeRol(caja.rol))
  }

  const cajas = datos ?? []

  return (
    <PaginaSinMenu
      titulo="Mis cajas de ahorro"
      descripcion={
        cargando || error
          ? undefined
          : cajas.length > 0
            ? "Elige la caja con la que vas a trabajar."
            : "Crea una caja para tu organización o únete a una con el código que te dieron."
      }
      acciones={
        <Button
          label="Mi perfil"
          variant="ghost"
          icon={UserRound}
          onClick={() => navigate("/perfil")}
        />
      }
    >
      {cargando ? (
        <LoadingState texto="Cargando tus cajas…" />
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar tus cajas: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : cajas.length === 0 ? (
        <div className="rounded-xl border border-base bg-surface">
          <EmptyState
            icono={Building2}
            titulo="Aún no perteneces a ninguna caja"
            descripcion="Si tu organización ya usa DOMUS, pide el código de invitación al coordinador. Si no, crea la caja y quedarás como su coordinador."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {cajas.map((caja) => (
            <li key={caja.id}>
              <button
                type="button"
                onClick={() => entrar(caja)}
                className="flex w-full items-center gap-4 rounded-xl border border-base bg-surface p-4 text-left transition-colors hover:border-accion-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accion-texto">
                  <Building2 size={22} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-base font-medium text-primary">{caja.nombre}</span>
                  {caja.descripcion && (
                    <span className="truncate text-sm text-secondary">{caja.descripcion}</span>
                  )}
                  <span>
                    <Badge
                      tono="neutral"
                      icon={ICONO_ROL[caja.rol] ?? Users}
                      label={ETIQUETA_ROL[caja.rol] ?? caja.rol}
                    />
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!cargando && !error && (
        <section aria-labelledby="otra-caja" className="flex flex-col gap-3">
          <h2 id="otra-caja" className="text-sm font-medium text-secondary">
            {cajas.length > 0 ? "¿Otra caja?" : "Para empezar"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpcionCaja
              icono={Plus}
              titulo="Crear una caja"
              texto="Para una organización que todavía no usa DOMUS. Quedas como su coordinador."
              onClick={() => navigate("/cajas/nueva")}
            />
            <OpcionCaja
              icono={KeyRound}
              titulo="Unirse con un código"
              texto="El coordinador de la caja genera el código en Configuración y te lo entrega. El código define tu rol."
              onClick={() => setUnirse(true)}
            />
          </div>
        </section>
      )}

      {unirse && (
        <UnirseModal
          onCerrar={() => setUnirse(false)}
          onUnido={(caja, vinculado) => {
            toast(
              "exito",
              vinculado
                ? `Entraste a ${caja.nombre}. Tu cuenta quedó vinculada a tu ficha de socio.`
                : `Entraste a ${caja.nombre} como ${ETIQUETA_ROL[caja.rol]?.toLowerCase() ?? caja.rol}.`,
            )
            entrar(caja)
          }}
        />
      )}
    </PaginaSinMenu>
  )
}
