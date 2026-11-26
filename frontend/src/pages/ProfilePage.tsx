// src/pages/ProfilePage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Pencil, Phone } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useNotif } from "../context/NotifContext"
import { profileService } from "../api/profile.service"
import { cajasService } from "../api/cajas.service"
import type { EstadoCuenta, Profile } from "../api/profile.types"
import { Avatar } from "../components/Avatar"
import { iniciales } from "../lib/texto"
import { EditorFoto } from "../components/EditorFoto"
import { publicarMiPerfil } from "../lib/fotos"
import type { MiCaja } from "../api/cajas.types"
import { PageShell } from "../components/layout/PageShell"
import { Panel } from "../components/Panel"
import { Button } from "../components/Button"
import { Form } from "../components/Form"
import { TextField } from "../components/TextField"
import { LoadingState } from "../components/LoadingState"
import { Badge } from "../components/Badge"
import { useDatos } from "../lib/useDatos"
import { AYUDA } from "../lib/ayuda"
import { ESTADO_USUARIO, motivoEstado } from "../lib/cuentaUsuario"
import { ETIQUETA_ROL } from "../lib/roles"
import { soloDigitos, validarNombrePerfil, validarTelefonoPerfil } from "../lib/validacion"

/**
 * Perfil de la cuenta: nombre y teléfono (HU016), el estado de la cuenta con su motivo
 * (HU-A03), las cajas con el rol en cada una (§8, rol y membresía) y cerrar sesión. El
 * correo es el de inicio de sesión y no se edita aquí.
 */
export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { toast } = useNotif()
  const cargar = useCallback(() => profileService.getMe(), [])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const perfil = datos?.profile
  const [editando, setEditando] = useState(false)

  // Lo que se lee aquí es lo más nuevo: la barra superior lo toma de aquí
  useEffect(() => {
    if (user && perfil)
      publicarMiPerfil(user.id, { nombre: perfil.nombre, foto_url: perfil.foto_url })
  }, [user, perfil])

  if (cargando) {
    return (
      <PageShell titulo="Mi perfil" ancho="formulario">
        <LoadingState texto="Cargando tu perfil…" />
      </PageShell>
    )
  }

  if (error || !datos || !perfil) {
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
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-xl font-semibold text-primary">
            {perfil.nombre || "Sin nombre"}
          </p>
          <p className="truncate text-sm text-secondary">{correo}</p>
        </div>
        <EditorFoto
          avatar={
            <Avatar
              url={perfil.foto_url}
              texto={iniciales(perfil.nombre, correo)}
              tamano="lg"
              onFalla={recargar}
            />
          }
          tieneFoto={Boolean(perfil.foto_url)}
          ayuda="La ven las personas de tus cajas. JPG, PNG o WebP."
          onSubir={async (imagen) => {
            await profileService.subirFoto(imagen)
            await recargar()
          }}
          onQuitar={async () => {
            await profileService.quitarFoto()
            await recargar()
          }}
        />
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

      <EstadoDeLaCuenta estado={datos.estado_cuenta} />
      <CajasYRoles />

      <Panel titulo="Sesión" descripcion="Cierra la sesión en este dispositivo.">
        <div>
          <Button label="Cerrar sesión" variant="secondary" icon={LogOut} onClick={logout} />
        </div>
      </Panel>
    </PageShell>
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

/** Estado de la cuenta y su motivo (HU-A03). Sin caja se ve Inactiva, no en blanco */
function EstadoDeLaCuenta({ estado }: { estado: EstadoCuenta }) {
  const { etiqueta, tono } = ESTADO_USUARIO[estado.estado]
  return (
    <Panel titulo="Estado de la cuenta" ayuda={AYUDA.estadoCuenta}>
      <div className="flex flex-col items-start gap-2">
        <Badge label={etiqueta} tono={tono} />
        <p className="text-sm text-secondary">
          {motivoEstado(estado.estado, estado.motivo, estado.cajas_activas)}
        </p>
      </div>
    </Panel>
  )
}

/** Las cajas de la cuenta con su rol en cada una (§8, rol y membresía) */
function CajasYRoles() {
  const navigate = useNavigate()
  const cargar = useCallback(async () => (await cajasService.getMisCajas()).cajas, [])
  const { datos: cajas, cargando, error, recargar } = useDatos<MiCaja[]>(cargar)

  return (
    <Panel
      titulo="Tus cajas y roles"
      descripcion="El rol es de cada caja: puedes tener uno distinto en cada una."
      ayuda={AYUDA.rolMembresia}
      acciones={
        <Button label="Ir a Mis cajas" variant="secondary" onClick={() => navigate("/cajas")} />
      }
    >
      {cargando ? (
        <LoadingState texto="Cargando tus cajas…" />
      ) : error || !cajas ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudieron cargar tus cajas: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : cajas.length === 0 ? (
        <p className="text-sm text-secondary">Aún no perteneces a ninguna caja.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-base">
          {cajas.map((caja) => (
            <li
              key={caja.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <span className="min-w-0 truncate text-sm text-primary">{caja.nombre}</span>
              <Badge label={ETIQUETA_ROL[caja.rol]} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
