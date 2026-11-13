// src/pages/Login.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleCheck, Mail, TriangleAlert } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { PaginaAcceso, EnlaceAcceso } from "../components/layout/PaginaAcceso"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { Button } from "../components/Button"
import { ApiError } from "../api/api.client"
import { ReenviarConfirmacion } from "./acceso/ReenviarConfirmacion"

/**
 * Iniciar sesión (HU-A02). Una cuenta sin activar no entra (HU-A01): el enlace del correo
 * de activación vuelve aquí con el resultado en la dirección.
 *   ok:    /login#access_token=…&type=signup
 *   error: /login#error=access_denied&error_code=otp_expired&error_description=…
 */
function avisoDelEnlace(): { ok: boolean; texto: string } | null {
  const p = new URLSearchParams(location.hash.slice(1) || location.search.slice(1))
  if (p.get("error_code") || p.get("error")) {
    return {
      ok: false,
      texto:
        "El enlace de activación venció o ya se usó. Inicia sesión con tu correo y contraseña para pedir otro.",
    }
  }
  const tipo = p.get("type")
  if (p.get("access_token") && (tipo === "signup" || tipo === "email")) {
    return { ok: true, texto: "Tu correo quedó confirmado. Ya puedes iniciar sesión." }
  }
  return null
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  // Correo de una cuenta que existe pero no está activada
  const [sinConfirmar, setSinConfirmar] = useState<string | null>(null)
  // Resultado del enlace de activación, si se llegó desde el correo
  const [aviso] = useState(avisoDelEnlace)

  // El enlace trae el token de Supabase en la dirección: se quita en cuanto se lee
  useEffect(() => {
    if (aviso) history.replaceState(null, "", location.pathname)
  }, [aviso])

  async function ingresar() {
    const e: typeof errores = {}
    if (!email.trim()) e.email = "Escribe tu correo"
    if (!password) e.password = "Escribe tu contraseña"
    setErrores(e)
    setError("")
    setSinConfirmar(null)
    if (e.email || e.password) return
    setCargando(true)
    try {
      await login(email.trim(), password)
      navigate("/cajas", { replace: true })
    } catch (err) {
      // El backend responde 401 igual para correo inexistente y contraseña mala (no revela
      // qué cuentas existen); el mensaje va para el formulario entero
      if (err instanceof ApiError && err.status === 401)
        setError("El correo o la contraseña no son correctos")
      else if (err instanceof ApiError && err.datos.codigo === "correo_sin_confirmar") {
        // La contraseña es correcta pero la cuenta no está activada: se ofrece reenviar
        setError(err.message)
        setSinConfirmar(email.trim())
      } else setError(err instanceof Error ? err.message : "No se pudo iniciar sesión")
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
      {aviso && (
        <div
          role="status"
          className={`flex gap-3 rounded-lg border-l-[3px] bg-surface-2 p-4 ${aviso.ok ? "border-estado-ok" : "border-estado-alerta"}`}
        >
          <span className="flex h-5 shrink-0 items-center">
            {aviso.ok ? (
              <CircleCheck size={16} className="text-estado-ok" aria-hidden="true" />
            ) : (
              <TriangleAlert size={16} className="text-estado-alerta" aria-hidden="true" />
            )}
          </span>
          <p className="text-sm text-primary">{aviso.texto}</p>
        </div>
      )}
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
          error={errores.password}
          required
        />
      </Form>
      {sinConfirmar && <ReenviarConfirmacion email={sinConfirmar} />}
    </PaginaAcceso>
  )
}
