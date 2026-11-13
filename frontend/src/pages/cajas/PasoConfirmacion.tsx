import { CircleCheck } from "lucide-react"
import { Button } from "../../components/Button"
import type { CreateCajaResponse } from "../../api/cajas.types"
import { MESES } from "../../lib/ciclo"
import { fecha } from "../../lib/format"
import { PasoAsistente } from "./PasoAsistente"

/**
 * Paso 4: resumen de lo que se acaba de crear, con el ciclo calculado y el rol. No tiene
 * "Atrás": la caja ya existe. Lo siguiente es el dashboard con los siguientes pasos.
 */

interface Props {
  creada: CreateCajaResponse
  onIrAlDashboard: () => void
}

export function PasoConfirmacion({ creada, onIrAlDashboard }: Props) {
  const { caja, ciclo_actual: ciclo } = creada

  return (
    <PasoAsistente titulo="La caja quedó creada">
      <div className="flex gap-3 rounded-lg border-l-[3px] border-estado-ok bg-surface-2 p-4">
        <span className="flex h-5 shrink-0 items-center">
          <CircleCheck size={16} className="text-estado-ok" aria-hidden="true" />
        </span>
        <p className="text-sm text-primary">
          Esta cuenta quedó como coordinadora de{" "}
          <strong className="font-medium">{caja.nombre}</strong> y de ninguna otra caja. En las
          demás cajas a las que pertenezcas conservas el rol que ya tenías.
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-surface-2 p-4 text-sm">
        <dt className="text-secondary">Nombre</dt>
        <dd className="text-right text-primary">{caja.nombre}</dd>
        <dt className="text-secondary">Descripción</dt>
        <dd className="text-right text-primary">{caja.descripcion}</dd>
        <dt className="text-secondary">Fundación</dt>
        <dd className="text-right text-primary">{fecha(caja.fecha_fundacion)}</dd>
        <dt className="text-secondary">Cada ciclo</dt>
        <dd className="text-right text-primary">
          {caja.duracion_ciclo} meses desde {MESES[caja.mes_inicio_ciclo - 1]?.toLowerCase()}
        </dd>
        <dt className="text-secondary">{ciclo.actual ? "Ciclo en curso" : "Primer ciclo"}</dt>
        <dd className="text-right text-primary">
          Ciclo {ciclo.numero} · {ciclo.label}
        </dd>
      </dl>

      <p className="text-sm text-secondary">
        En el dashboard vas a ver los siguientes pasos: registrar las fichas de los socios e invitar
        al tesorero.
      </p>

      <div>
        <Button label="Ir al dashboard" onClick={onIrAlDashboard} />
      </div>
    </PasoAsistente>
  )
}
