// src/pages/ForgotPasswordPage.tsx
import { useState } from "react"
import { Mail, MailCheck } from "lucide-react"
import { authService } from "../api/auth.service"
import { PaginaAcceso, EnlaceAcceso } from "../components/layout/PaginaAcceso"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { Button } from "../components/Button"
import { validarCorreo } from "../lib/validacion"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [errorEmail, setErrorEmail] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar() {
    setError("")
    if (!email.trim()) return setErrorEmail("Escribe tu correo")
    const ec = validarCorreo(email)
    if (ec) return setErrorEmail(ec)
    setCargando(true)
    try {
      await authService.forgotPassword(email.trim())
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo")
    } finally {
      setCargando(false)
    }
  }

  const volver = <EnlaceAcceso a="/login">Volver a iniciar sesión</EnlaceAcceso>

  if (enviado) {
    return (
      <PaginaAcceso
        titulo="Revisa tu correo"
        icono={
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-surface-2 text-estado-ok">
            <MailCheck size={24} aria-hidden="true" />
          </span>
        }
        descripcion={
          <>
            Enviamos un enlace para cambiar la contraseña a{" "}
            <strong className="font-medium text-primary">{email.trim()}</strong>. Si no lo ves en
            unos minutos, revisa la carpeta de spam.
          </>
        }
        pie={volver}
      />
    )
  }

  return (
    <PaginaAcceso
      titulo="¿Olvidaste tu contraseña?"
      descripcion="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva."
      pie={volver}
    >
      <Form
        onSubmit={enviar}
        error={error}
        actions={<Button type="submit" label="Enviar enlace" loading={cargando} fullWidth />}
      >
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrorEmail("")
          }}
          placeholder="ana@cajacomunidad.ec"
          icon={Mail}
          error={errorEmail}
          required
          autoFocus
        />
      </Form>
    </PaginaAcceso>
  )
}
