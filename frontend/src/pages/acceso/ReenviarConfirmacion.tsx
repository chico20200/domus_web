import { useEffect, useState } from "react"
import { Button } from "../../components/Button"
import { authService } from "../../api/auth.service"

/**
 * Reenviar el correo de activación de una cuenta (HU-A01). Después de cada envío espera
 * un minuto antes de permitir otro, el mismo límite que pone Supabase por correo.
 */

const ESPERA_SEGUNDOS = 60

export function ReenviarConfirmacion({ email }: { email: string }) {
  const [enviando, setEnviando] = useState(false)
  const [espera, setEspera] = useState(0)
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function reenviar() {
    setEnviando(true)
    setResultado(null)
    try {
      await authService.resendConfirmation(email)
      setResultado({ ok: true, texto: `Te enviamos otro correo a ${email}.` })
      setEspera(ESPERA_SEGUNDOS)
    } catch (err) {
      setResultado({
        ok: false,
        texto: err instanceof Error ? err.message : "No se pudo reenviar el correo",
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          label={espera > 0 ? `Reenviar en ${espera} s` : "Reenviar el correo"}
          variant="secondary"
          onClick={reenviar}
          loading={enviando}
          disabled={espera > 0}
        />
      </div>
      <p
        role="status"
        className={`text-xs empty:hidden ${resultado?.ok === false ? "text-destructivo" : "text-secondary"}`}
      >
        {resultado?.texto}
      </p>
    </div>
  )
}
