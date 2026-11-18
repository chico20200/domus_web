import { useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextareaField } from "../../components/TextareaField"
import { adminService } from "../../api/admin.service"
import { ApiError } from "../../api/api.client"
import type { CuentaAdmin } from "../../api/admin.types"

/**
 * Bloquear o restablecer una cuenta (HU020, HU-S02). El motivo es obligatorio y queda en la
 * bitácora con quién y cuándo. El modal mismo es la confirmación: explica qué pasa y pide
 * el motivo antes del botón final.
 */

export type AccionBloqueo = "bloquear" | "restablecer"

const MINIMO = 10
const MAXIMO = 500

const TEXTOS: Record<
  AccionBloqueo,
  { titulo: string; explicacion: string; boton: string; pista: string }
> = {
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
  cuenta: CuentaAdmin
  accion: AccionBloqueo
  onCerrar: () => void
  onHecho: () => void
}

export function BloqueoModal({ cuenta, accion, onCerrar, onHecho }: Props) {
  const t = TEXTOS[accion]
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
      if (accion === "bloquear") await adminService.bloquear(cuenta.id, motivo.trim())
      else await adminService.restablecer(cuenta.id, motivo.trim())
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
      descripcion={cuenta.correo}
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
