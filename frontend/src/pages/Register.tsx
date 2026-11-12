// src/pages/Register.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Mail } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authService } from "../api/auth.service"
import { PaginaAcceso, EnlaceAcceso } from "../components/layout/PaginaAcceso"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { Button } from "../components/Button"
import { validarCorreo } from "../lib/validacion"

/**
 * Crear cuenta. Migración visual: la política de contraseña de HU001 (8 caracteres con
 * letras y números) y la activación por correo son Etapa 4; hoy sigue pidiendo 6.
 */

type Campo = "email" | "password" | "confirm"

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)

  function limpiar(campo: Campo) {
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function crear() {
    const e: Partial<Record<Campo, string>> = {}
    if (!email.trim()) e.email = "Escribe tu correo"
    else if (validarCorreo(email)) e.email = validarCorreo(email)
    if (password.length < 6) e.password = "Usa al menos 6 caracteres"
    if (!e.password && password !== confirm) e.confirm = "Las contraseñas no coinciden"
    setErrores(e)
    setError("")
    if (Object.keys(e).length > 0) return
    setCargando(true)
    try {
      await authService.register({ email: email.trim(), password })
      // El registro no pide confirmar el correo, así que entra directo
      await login(email.trim(), password)
      navigate("/perfil", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta")
      setCargando(false)
    }
  }

  return (
    <PaginaAcceso
      titulo="Crear cuenta"
      descripcion="Con tu cuenta podrás crear una caja o unirte a la de tu organización."
      pie={
        <>
          ¿Ya tienes cuenta? <EnlaceAcceso a="/login">Inicia sesión</EnlaceAcceso>
        </>
      }
    >
      <Form
        onSubmit={crear}
        error={error}
        actions={<Button type="submit" label="Crear cuenta" loading={cargando} fullWidth />}
      >
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            limpiar("email")
          }}
          placeholder="ana@cajacomunidad.ec"
          icon={Mail}
          error={errores.email}
          required
          autoFocus
        />
        <TextField
          label="Contraseña"
          type="password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            limpiar("password")
          }}
          hint="Al menos 6 caracteres."
          error={errores.password}
          required
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            limpiar("confirm")
          }}
          error={errores.confirm}
          required
        />
      </Form>
    </PaginaAcceso>
  )
}
