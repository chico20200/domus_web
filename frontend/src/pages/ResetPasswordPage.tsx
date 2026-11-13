// src/pages/ResetPasswordPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleCheck, TriangleAlert } from "lucide-react"
import { authService } from "../api/auth.service"
import { ApiError } from "../api/api.client"
import { PaginaAcceso, EnlaceAcceso } from "../components/layout/PaginaAcceso"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { Button } from "../components/Button"
import { IndicadorContrasena } from "../components/IndicadorContrasena"
import { validarContrasena } from "../lib/validacion"

/**
 * Nueva contraseña desde el enlace del correo. Supabase pone el token en el hash:
 * /reset-password#access_token=eyJ...&type=recovery
 */
function tokenDelEnlace(): string | null {
  const params = new URLSearchParams(window.location.hash.replace("#", ""))
  const token = params.get("access_token")
  return token && params.get("type") === "recovery" ? token : null
}

type Campo = "password" | "confirm"

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [token] = useState(tokenDelEnlace)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [listo, setListo] = useState(false)

  // api.client lee el token de localStorage para la llamada que cambia la contraseña
  useEffect(() => {
    if (token) localStorage.setItem("token", token)
  }, [token])

  // Tras cambiarla, lleva al inicio de sesión; el enlace de la vista de éxito no espera
  useEffect(() => {
    if (!listo) return
    const t = setTimeout(() => navigate("/login", { replace: true }), 4000)
    return () => clearTimeout(t)
  }, [listo, navigate])

  async function cambiar() {
    const e: Partial<Record<Campo, string>> = {}
    if (validarContrasena(password)) e.password = validarContrasena(password)
    if (!e.password && password !== confirm) e.confirm = "Las contraseñas no coinciden"
    setErrores(e)
    setError("")
    if (Object.keys(e).length > 0) return
    setCargando(true)
    try {
      await authService.updatePassword(password)
      // El token de recuperación ya no sirve
      localStorage.removeItem("token")
      setListo(true)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo cambiar la contraseña"
      // Si el backend rechaza la contraseña, el error va en ese campo
      if (err instanceof ApiError && err.datos.campo === "password") {
        setErrores({ password: mensaje })
      } else setError(mensaje)
    } finally {
      setCargando(false)
    }
  }

  if (!token) {
    return (
      <PaginaAcceso
        titulo="El enlace no es válido"
        icono={
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-surface-2 text-destructivo">
            <TriangleAlert size={24} aria-hidden="true" />
          </span>
        }
        descripcion="El enlace para cambiar la contraseña está incompleto o ya venció. Pide uno nuevo; dura poco tiempo."
        pie={<EnlaceAcceso a="/login">Volver a iniciar sesión</EnlaceAcceso>}
      >
        <p className="text-sm">
          <EnlaceAcceso a="/forgot-password">Pedir un enlace nuevo</EnlaceAcceso>
        </p>
      </PaginaAcceso>
    )
  }

  if (listo) {
    return (
      <PaginaAcceso
        titulo="Contraseña cambiada"
        icono={
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-surface-2 text-estado-ok">
            <CircleCheck size={24} aria-hidden="true" />
          </span>
        }
        descripcion="Ya puedes entrar con tu nueva contraseña. Te llevamos al inicio de sesión en unos segundos."
      >
        <p className="text-sm">
          <EnlaceAcceso a="/login">Ir a iniciar sesión</EnlaceAcceso>
        </p>
      </PaginaAcceso>
    )
  }

  return (
    <PaginaAcceso titulo="Nueva contraseña" descripcion="Escribe la contraseña que vas a usar.">
      <Form
        onSubmit={cambiar}
        error={error}
        actions={<Button type="submit" label="Cambiar contraseña" loading={cargando} fullWidth />}
      >
        <div className="flex flex-col gap-2">
          <TextField
            label="Nueva contraseña"
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrores((x) => ({ ...x, password: undefined }))
            }}
            hint="Al menos 8 caracteres, con letras y números."
            error={errores.password}
            required
            autoFocus
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
            setErrores((x) => ({ ...x, confirm: undefined }))
          }}
          error={errores.confirm}
          required
        />
      </Form>
    </PaginaAcceso>
  )
}
