import { useNavigate } from "react-router-dom"
import { Circle, CircleCheck } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import type { ResumenCaja } from "../../api/resumen.types"

/**
 * Último paso del asistente de creación (§5.1, HU-C01): lo que le falta a una caja nueva
 * para empezar a operar. Solo lo ve el coordinador, y desaparece cuando la caja tiene al
 * menos una ficha de socio y otra persona con acceso. Sale de los conteos del resumen,
 * así que no hace falta guardar si ya se vio.
 */

interface Paso {
  titulo: string
  detalle: string
  hecho: boolean
  accion: string
  ruta: string
}

export function SiguientesPasos({ resumen }: { resumen: ResumenCaja }) {
  const navigate = useNavigate()

  const pasos: Paso[] = [
    {
      titulo: "Registrar las fichas de los socios",
      detalle:
        "Cada socio necesita su ficha para abrirle una cuenta de ahorro o darle un crédito. No hace falta que tenga cuenta en DOMUS.",
      hecho: resumen.totalSocios > 0,
      accion: "Ir a Socios",
      ruta: "/socios",
    },
    {
      titulo: "Invitar al tesorero",
      detalle:
        "En Configuración genera un código de invitación con el rol Tesorero y compártelo. Quien lo use entra a la caja con ese rol.",
      hecho: resumen.totalMiembros > 1,
      accion: "Ir a Configuración",
      ruta: "/configuracion",
    },
  ]

  if (pasos.every((p) => p.hecho)) return null

  return (
    <Panel titulo="Siguientes pasos" descripcion="Lo que falta para que la caja empiece a operar.">
      <ol className="flex flex-col gap-4">
        {pasos.map((p) => (
          <li key={p.titulo} className="flex flex-wrap items-start gap-4">
            <span className="flex h-5 shrink-0 items-center">
              {p.hecho ? (
                <CircleCheck size={18} className="text-estado-ok" aria-label="Hecho" />
              ) : (
                <Circle size={18} className="text-muted" aria-label="Pendiente" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p
                className={`text-sm font-medium ${p.hecho ? "text-secondary line-through" : "text-primary"}`}
              >
                {p.titulo}
              </p>
              {!p.hecho && <p className="text-sm text-secondary">{p.detalle}</p>}
            </div>
            {!p.hecho && (
              <Button label={p.accion} variant="secondary" onClick={() => navigate(p.ruta)} />
            )}
          </li>
        ))}
      </ol>
    </Panel>
  )
}
