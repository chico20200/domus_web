// src/pages/Register.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Mail } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { authService } from "../api/auth.service"
import { ApiError } from "../api/api.client"
import { PaginaAcceso, EnlaceAcceso } from "../components/layout/PaginaAcceso"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { Button } from "../components/Button"
import { IndicadorContrasena } from "../components/IndicadorContrasena"
import { validarContrasena, validarCorreo } from "../lib/validacion"

/**
 * Crear cuenta (HU-A01). La contraseña sigue la política de 8 caracteres con letras y
 * números, con el indicador de fortaleza debajo.
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
    if (validarContrasena(password)) e.password = validarContrasena(password)
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
      const mensaje = err instanceof Error ? err.message : "No se pudo crear la cuenta"
      // Si el backend rechaza la contraseña, el error va en ese campo
      if (err instanceof ApiError && err.datos.campo === "password") {
        setErrores({ password: mensaje })
      } else setError(mensaje)
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
        <div className="flex flex-col gap-2">
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
            hint="Al menos 8 caracteres, con letras y números."
            error={errores.password}
            required
          />
          <IndicadorContrasena password={password} />
        </div>
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
