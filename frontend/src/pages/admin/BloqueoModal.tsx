import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextareaField } from "../../components/TextareaField"
import { adminService } from "../../api/admin.service"
import { ApiError } from "../../api/api.client"

/**
 * Bloquear o restablecer una cuenta o una caja (HU020, HU-S02). El motivo es obligatorio
 * y queda en la bitácora con quién y cuándo. El modal mismo es la confirmación: explica
 * qué pasa y pide el motivo antes del botón final.
 */

export type AccionBloqueo = "bloquear" | "restablecer"
export type ObjetivoBloqueo = { tipo: "cuenta" | "caja"; id: string; nombre: string }

const MINIMO = 10
const MAXIMO = 500

type Textos = { titulo: string; explicacion: string; boton: string; pista: string }

const TEXTOS_CAJA: Record<AccionBloqueo, Textos> = {
  bloquear: {
    titulo: "Bloquear la caja",
    explicacion:
      "Sus miembros siguen entrando y viendo sus datos, pero nadie puede registrar nada: ni fichas, ni movimientos, ni créditos, ni pagos. El coordinador no puede desbloquearla. Los miembros verán el motivo.",
    boton: "Bloquear la caja",
    pista: "Qué pasó y por qué se bloquea. Lo verán los miembros de la caja.",
  },
  restablecer: {
    titulo: "Restablecer la caja",
    explicacion: "La caja vuelve a admitir registros. El bloqueo anterior queda en la bitácora.",
    boton: "Restablecer la caja",
    pista: "Por qué se levanta el bloqueo.",
  },
}

const TEXTOS: Record<AccionBloqueo, Textos> = {
  bloquear: {
    titulo: "Bloquear la cuenta",
    explicacion:
      "La cuenta no podrá iniciar sesión y una sesión abierta se cerrará en su próxima acción. Sus cajas y sus datos no cambian. El motivo lo verá la persona al intentar entrar.",
    boton: "Bloquear la cuenta",
    pista: "Qué pasó y por qué se bloquea. Lo verá la persona al intentar entrar.",
  },
  restablecer: {
    titulo: "Restablecer la cuenta",
    explicacion:
      "La cuenta vuelve a iniciar sesión con el estado que le corresponda. El bloqueo anterior queda en la bitácora.",
    boton: "Restablecer la cuenta",
    pista: "Por qué se levanta el bloqueo.",
  },
}

interface Props {
  objetivo: ObjetivoBloqueo
  accion: AccionBloqueo
  onCerrar: () => void
  onHecho: () => void
}

export function BloqueoModal({ objetivo, accion, onCerrar, onHecho }: Props) {
  const t = (objetivo.tipo === "caja" ? TEXTOS_CAJA : TEXTOS)[accion]
  const [motivo, setMotivo] = useState("")
  const [errorMotivo, setErrorMotivo] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setError("")
    if (motivo.trim().length < MINIMO) {
      return setErrorMotivo(`Escribe el motivo, con al menos ${MINIMO} caracteres`)
    }
    setEnviando(true)
    try {
      const m = motivo.trim()
      if (objetivo.tipo === "caja") {
        if (accion === "bloquear") await adminService.bloquearCaja(objetivo.id, m)
        else await adminService.restablecerCaja(objetivo.id, m)
      } else if (accion === "bloquear") await adminService.bloquear(objetivo.id, m)
      else await adminService.restablecer(objetivo.id, m)
      onHecho()
    } catch (err) {
      if (err instanceof ApiError && err.datos.campo === "motivo") setErrorMotivo(err.message)
      else setError(err instanceof Error ? err.message : "No se pudo completar la acción")
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={t.titulo}
      descripcion={objetivo.nombre}
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={confirmar}
        error={error}
        actions={
          <>
            <Button
              type="submit"
              label={t.boton}
              variant={accion === "bloquear" ? "destructive" : "primary"}
              loading={enviando}
            />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} disabled={enviando} />
          </>
        }
      >
        <p className="text-sm text-secondary">{t.explicacion}</p>
        <TextareaField
          label="Motivo"
          name="motivo"
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value)
            setErrorMotivo("")
          }}
          hint={t.pista}
          error={errorMotivo}
          maxLength={MAXIMO}
          rows={3}
          required
        />
      </Form>
    </Modal>
  )
}
