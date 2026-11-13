import { Building2, Lock, Shield, type LucideIcon } from "lucide-react"
import { Button } from "../../components/Button"
import { PasoAsistente } from "./PasoAsistente"

/** Paso 1: qué es una caja, antes de pedir ningún dato (§5.1, §8 "Crear una caja") */

const PUNTOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    icono: Building2,
    titulo: "Representa a una organización real",
    texto:
      "Una caja es la caja de ahorro de un grupo concreto: un barrio, una asociación, un grupo de trabajo. Se crea una sola vez por organización.",
  },
  {
    icono: Lock,
    titulo: "Su información no se comparte",
    texto:
      "Los socios, los ahorros, los créditos y los pagos de esta caja solo los ven sus miembros. Ninguna otra caja tiene acceso a ellos.",
  },
  {
    icono: Shield,
    titulo: "Quien la crea es su coordinador",
    texto:
      "Vas a quedar a cargo de configurarla, registrar a los socios e invitar al tesorero y al resto de la directiva.",
  },
]

interface Props {
  onContinuar: () => void
  onCancelar: () => void
}

export function PasoQueEs({ onContinuar, onCancelar }: Props) {
  return (
    <PasoAsistente titulo="Qué es una caja" enfocar={false}>
      <ul className="flex flex-col gap-4">
        {PUNTOS.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="flex gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accion-texto">
              <Icono size={20} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-primary">{titulo}</p>
              <p className="text-sm text-secondary">{texto}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="rounded-lg bg-surface-2 p-4 text-sm text-secondary">
        Si tu organización ya usa DOMUS, no crees otra caja: pide al coordinador el código de
        invitación y únete desde Mis cajas.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button label="Continuar" onClick={onContinuar} />
        <Button label="Cancelar" variant="ghost" onClick={onCancelar} />
      </div>
    </PasoAsistente>
  )
}
