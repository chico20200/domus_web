// src/pages/ProfilePage.tsx
import { useCallback, useState } from "react"
import { LogOut, Pencil, Phone } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useNotif } from "../context/NotifContext"
import { profileService } from "../api/profile.service"
import type { Profile } from "../api/profile.types"
import { PageShell } from "../components/layout/PageShell"
import { Panel } from "../components/Panel"
import { Button } from "../components/Button"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { LoadingState } from "../components/LoadingState"
import { useDatos } from "../lib/useDatos"
import { soloDigitos, validarNombrePerfil, validarTelefonoPerfil } from "../lib/validacion"

/**
 * Perfil de la cuenta: nombre y teléfono (HU016), y cerrar sesión. El correo es el de
 * inicio de sesión y no se edita aquí. El estado de la cuenta y la explicación de los
 * roles por caja llegan en la Etapa 5.
 */
export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { toast } = useNotif()
  const cargar = useCallback(async () => (await profileService.getMe()).profile, [])
  const { datos: perfil, cargando, error, recargar } = useDatos(cargar)
  const [editando, setEditando] = useState(false)

  if (cargando) {
    return (
      <PageShell titulo="Mi perfil" ancho="formulario">
        <LoadingState texto="Cargando tu perfil…" />
      </PageShell>
    )
  }

  if (error || !perfil) {
    return (
      <PageShell titulo="Mi perfil" ancho="formulario">
        <Panel>
          <p className="text-sm text-secondary">No se pudo cargar tu perfil: {error}</p>
          <div>
            <Button label="Reintentar" variant="secondary" onClick={recargar} />
          </div>
        </Panel>
      </PageShell>
    )
  }

  const correo = user?.email ?? ""

  return (
    <PageShell titulo="Mi perfil" ancho="formulario">
      <Panel>
        <div className="flex items-center gap-4">
          <Avatar perfil={perfil} correo={correo} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-xl font-semibold text-primary">
              {perfil.nombre || "Sin nombre"}
            </p>
            <p className="truncate text-sm text-secondary">{correo}</p>
          </div>
        </div>
      </Panel>

      {editando ? (
        <EditarDatos
          perfil={perfil}
          onCancelar={() => setEditando(false)}
          onGuardado={async () => {
            setEditando(false)
            await recargar()
            toast("exito", "Perfil actualizado")
          }}
        />
      ) : (
        <Panel
          titulo="Datos personales"
          acciones={
            <Button
              label="Editar"
              variant="secondary"
              icon={Pencil}
              onClick={() => setEditando(true)}
            />
          }
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["Nombre completo", perfil.nombre],
              ["Teléfono", perfil.telefono],
              ["Correo", correo],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex flex-col gap-1">
                <dt className="text-xs text-secondary">{etiqueta}</dt>
                <dd className={valor ? "text-sm text-primary" : "text-sm text-muted"}>
                  {valor || "Sin registrar"}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <Panel titulo="Sesión" descripcion="Cierra la sesión en este dispositivo.">
        <div>
          <Button label="Cerrar sesión" variant="secondary" icon={LogOut} onClick={logout} />
        </div>
      </Panel>
    </PageShell>
  )
}

function Avatar({ perfil, correo }: { perfil: Profile; correo: string }) {
  const iniciales = perfil.nombre
    ? perfil.nombre
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (correo[0]?.toUpperCase() ?? "?")

  if (perfil.foto_url) {
    return (
      <img
        src={perfil.foto_url}
        alt=""
        className="h-16 w-16 shrink-0 rounded-full border border-base object-cover"
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accion-primaria text-xl font-semibold text-sobre-accion"
    >
      {iniciales}
    </div>
  )
}

type Errores = Partial<Record<"nombre" | "telefono", string>>

function EditarDatos({
  perfil,
  onCancelar,
  onGuardado,
}: {
  perfil: Profile
  onCancelar: () => void
  onGuardado: () => void | Promise<void>
}) {
  const [nombre, setNombre] = useState(perfil.nombre ?? "")
  const [telefono, setTelefono] = useState(perfil.telefono ?? "")
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const e: Errores = {}
    const en = validarNombrePerfil(nombre)
    if (en) e.nombre = en
    const et = validarTelefonoPerfil(telefono)
    if (et) e.telefono = et
    setErrores(e)
    setErrorGeneral("")
    if (Object.keys(e).length > 0) return
    setGuardando(true)
    try {
      await profileService.updateMe({
        nombre: nombre.trim().replace(/\s+/g, " "),
        telefono: soloDigitos(telefono),
      })
      await onGuardado()
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo guardar el perfil")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel titulo="Editar datos personales">
      <Form
        onSubmit={guardar}
        error={errorGeneral}
        actions={
          <>
            <Button type="submit" label="Guardar cambios" loading={guardando} />
            <Button label="Cancelar" variant="ghost" onClick={onCancelar} />
          </>
        }
      >
        <TextField
          label="Nombre completo"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setErrores((er) => ({ ...er, nombre: undefined }))
          }}
          autoComplete="name"
          maxLength={80}
          hint="Al menos 6 caracteres, solo letras."
          error={errores.nombre}
          required
          autoFocus
        />
        <TextField
          label="Teléfono"
          type="tel"
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value)
            setErrores((er) => ({ ...er, telefono: undefined }))
          }}
          inputMode="tel"
          autoComplete="tel"
          maxLength={14}
          placeholder="09XXXXXXXX"
          icon={Phone}
          hint="Opcional. 10 dígitos."
          error={errores.telefono}
        />
      </Form>
    </Panel>
  )
}
