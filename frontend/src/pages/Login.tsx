// src/pages/Login.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Lock, Mail } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { PaginaAcceso, EnlaceAcceso } from "../components/layout/PaginaAcceso"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { Button } from "../components/Button"

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)

  async function ingresar() {
    const e: typeof errores = {}
    if (!email.trim()) e.email = "Escribe tu correo"
    if (!password) e.password = "Escribe tu contraseña"
    setErrores(e)
    setError("")
    if (e.email || e.password) return
    setCargando(true)
    try {
      await login(email.trim(), password)
      navigate("/cajas", { replace: true })
    } catch (err) {
      // El backend no dice cuál de los dos falló; el mensaje va para el formulario entero
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión")
      setCargando(false)
    }
  }

  return (
    <PaginaAcceso
      titulo="Iniciar sesión"
      descripcion="Entra para trabajar con tu caja de ahorro."
      // HU002: el enlace para crear cuenta va justo debajo del de recuperar la contraseña
      pie={
        <div className="flex flex-col gap-3">
          <p>
            <EnlaceAcceso a="/forgot-password">¿Olvidaste tu contraseña?</EnlaceAcceso>
          </p>
          <p>
            ¿No tienes cuenta? <EnlaceAcceso a="/register">Crea una</EnlaceAcceso>
          </p>
        </div>
      }
    >
      <Form
        onSubmit={ingresar}
        error={error}
        actions={<Button type="submit" label="Ingresar" loading={cargando} fullWidth />}
      >
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrores((x) => ({ ...x, email: undefined }))
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
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setErrores((x) => ({ ...x, password: undefined }))
          }}
          icon={Lock}
          error={errores.password}
          required
        />
      </Form>
    </PaginaAcceso>
  )
}
