import { useState } from "react"
import { IdCard, Mail, Phone } from "lucide-react"
import { Modal } from "../../components/Modal"
import { AYUDA } from "../../lib/ayuda"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { sociosService } from "../../api/socios.service"
import type { Socio } from "../../api/socios.types"
import { fecha, hoyISO } from "../../lib/format"
import { soloDigitos, validarCedula, validarCorreo, validarTelefono } from "../../lib/validacion"

/**
 * Registrar o editar la ficha de un socio (HU-O01). La ficha es el registro contable de
 * la persona en esta caja; la crea el tesorero o el coordinador porque no todo socio
 * tiene dispositivo. Se vincula a una cuenta de usuario cuando la persona entra a la caja
 * con un código de invitación y su correo coincide con el de la ficha.
 *
 * Con un socio inactivo, el mismo formulario lo reactiva (Etapa 7, T8): sus datos de
 * antes, para revisarlos, salvo la dirección, que se escribe de nuevo y es obligatoria.
 */

interface Props {
  cajaId: string
  /** Sin socio: ficha nueva */
  socio?: Socio
  /** Reactivar la ficha inactiva (T8) en lugar de editarla */
  reactivar?: boolean
  onCerrar: () => void
  onGuardado: (socio: Socio) => void | Promise<void>
}

type Campo = "nombre" | "apellido" | "cedula" | "telefono" | "email" | "direccion" | "fecha_ingreso"
type Errores = Partial<Record<Campo, string>>

export function SocioModal({ cajaId, socio, reactivar = false, onCerrar, onGuardado }: Props) {
  const editando = !!socio
  const reactivando = !!socio && !socio.activo && reactivar
  const [form, setForm] = useState<Record<Campo, string>>({
    nombre: socio?.nombre ?? "",
    apellido: socio?.apellido ?? "",
    cedula: socio?.cedula ?? "",
    telefono: socio?.telefono ?? "",
    email: socio?.email ?? "",
    // Al reactivar, la dirección de antes puede ya no ser la suya: se escribe de nuevo
    direccion: reactivando ? "" : (socio?.direccion ?? ""),
    fecha_ingreso: socio?.fecha_ingreso ?? hoyISO(),
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState("")
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo: Campo) {
    return (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [campo]: e.target.value }))
      if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }))
    }
  }

  function validar(): Errores {
    const e: Errores = {}
    if (!form.nombre.trim()) e.nombre = "Escribe el nombre"
    if (!form.apellido.trim()) e.apellido = "Escribe el apellido"
    // Al editar, la cédula se revisa solo si cambió: hay fichas antiguas sin verificar
    const cedulaCambio = !editando || soloDigitos(form.cedula) !== soloDigitos(socio.cedula)
    if (cedulaCambio) {
      const c = validarCedula(form.cedula)
      if (c) e.cedula = c
    }
    const t = validarTelefono(form.telefono)
    if (t) e.telefono = t
    const m = validarCorreo(form.email)
    if (m) e.email = m
    if (reactivando && !form.direccion.trim()) e.direccion = "Escribe su dirección actual"
    if (!editando && !form.fecha_ingreso) e.fecha_ingreso = "Indica la fecha de ingreso"
    if (!editando && form.fecha_ingreso > hoyISO()) {
      e.fecha_ingreso = "La fecha de ingreso no puede ser futura"
    }
    return e
  }

  async function enviar() {
    const e = validar()
    setErrores(e)
    setErrorGeneral("")
    if (Object.keys(e).length > 0) return
    const datos = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      cedula: soloDigitos(form.cedula),
      telefono: soloDigitos(form.telefono),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
    }
    setGuardando(true)
    try {
      const res = reactivando
        ? await sociosService.reactivar(cajaId, socio.id, datos)
        : editando
          ? await sociosService.actualizar(cajaId, socio.id, datos)
          : await sociosService.crear(cajaId, { ...datos, fecha_ingreso: form.fecha_ingreso })
      await onGuardado(res.socio)
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : "No se pudo guardar la ficha")
    } finally {
      setGuardando(false)
    }
  }

  const vinculado = !!socio?.user_id

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={
        reactivando
          ? `Reactivar a ${socio.nombre} ${socio.apellido}`
          : editando
            ? `Editar a ${socio.nombre} ${socio.apellido}`
            : "Registrar socio"
      }
      ayuda={reactivando ? AYUDA.reactivarSocio : editando ? undefined : AYUDA.crearSocio}
      descripcion={
        reactivando
          ? `Vuelve a la caja desde hoy. Revisa sus datos de antes y escribe su dirección actual.`
          : editando
            ? undefined
            : "La ficha es el registro contable de la persona en esta caja. Puede registrarse aunque la persona no use DOMUS."
      }
      ancho="amplio"
      cerrarAlClicFuera={false}
    >
      <Form
        onSubmit={enviar}
        error={errorGeneral}
        actions={
          <>
            <Button
              type="submit"
              label={
                reactivando ? "Reactivar socio" : editando ? "Guardar cambios" : "Registrar socio"
              }
              loading={guardando}
            />
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} />
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={cambiar("nombre")}
            autoComplete="off"
            maxLength={60}
            error={errores.nombre}
            required
          />
          <TextField
            label="Apellido"
            value={form.apellido}
            onChange={cambiar("apellido")}
            autoComplete="off"
            maxLength={60}
            error={errores.apellido}
            required
          />
          <TextField
            label="Cédula"
            value={form.cedula}
            onChange={cambiar("cedula")}
            inputMode="numeric"
            maxLength={12}
            placeholder="10 dígitos"
            icon={IdCard}
            error={errores.cedula}
            required
          />
          <TextField
            label="Teléfono"
            type="tel"
            value={form.telefono}
            onChange={cambiar("telefono")}
            inputMode="tel"
            maxLength={16}
            placeholder="09XXXXXXXX"
            icon={Phone}
            hint="Opcional."
            error={errores.telefono}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Correo"
              type="email"
              value={form.email}
              onChange={cambiar("email")}
              autoComplete="off"
              placeholder="nombre@correo.com"
              icon={Mail}
              hint={
                vinculado
                  ? "La ficha ya está vinculada a una cuenta de DOMUS. Cambiar el correo no la desvincula."
                  : "Opcional. Si la persona entra a la caja con un código de invitación y usa este mismo correo, su cuenta de DOMUS se vincula a la ficha y puede ver sus ahorros."
              }
              error={errores.email}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              label="Dirección"
              value={form.direccion}
              onChange={cambiar("direccion")}
              placeholder="Calle, número, sector"
              maxLength={160}
              hint={
                reactivando
                  ? socio.direccion
                    ? `Antes: ${socio.direccion}. Escríbela de nuevo, aunque no haya cambiado.`
                    : "Escribe dónde vive ahora."
                  : "Opcional."
              }
              error={errores.direccion}
              required={reactivando}
            />
          </div>
          {reactivando ? (
            <div className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-primary">Reingreso</span>
              <span className="text-secondary">
                Desde hoy. Su primer ingreso fue el {fecha(socio.fecha_ingreso)} y salió el{" "}
                {fecha(socio.fecha_salida)}; el reparto de intereses no lo cuenta en los meses en
                que estuvo fuera. Sus cuentas siguen cerradas: se reabren desde Ahorros.
              </span>
            </div>
          ) : editando ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-primary">Fecha de ingreso</span>
              <span className="text-secondary">
                {fecha(socio.fecha_ingreso)}. Solo el coordinador la corrige, con un motivo, desde
                el botón del calendario en la lista de socios.
              </span>
            </div>
          ) : (
            <TextField
              label="Fecha de ingreso"
              type="date"
              value={form.fecha_ingreso}
              onChange={cambiar("fecha_ingreso")}
              max={hoyISO()}
              error={errores.fecha_ingreso}
              required
            />
          )}
        </div>
      </Form>
    </Modal>
  )
}
