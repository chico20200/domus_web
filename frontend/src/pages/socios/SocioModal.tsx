import { useState } from "react"
import { IdCard, Mail, Phone } from "lucide-react"
import { Modal } from "../../components/Modal"
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
 */

interface Props {
  cajaId: string
  /** Sin socio: ficha nueva */
  socio?: Socio
  onCerrar: () => void
  onGuardado: (socio: Socio) => void | Promise<void>
}

type Campo = "nombre" | "apellido" | "cedula" | "telefono" | "email" | "direccion" | "fecha_ingreso"
type Errores = Partial<Record<Campo, string>>

export function SocioModal({ cajaId, socio, onCerrar, onGuardado }: Props) {
  const editando = !!socio
  const [form, setForm] = useState<Record<Campo, string>>({
    nombre: socio?.nombre ?? "",
    apellido: socio?.apellido ?? "",
    cedula: socio?.cedula ?? "",
    telefono: socio?.telefono ?? "",
    email: socio?.email ?? "",
    direccion: socio?.direccion ?? "",
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
      const res = editando
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
      titulo={editando ? `Editar a ${socio.nombre} ${socio.apellido}` : "Registrar socio"}
      descripcion={
        editando
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
              label={editando ? "Guardar cambios" : "Registrar socio"}
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
              hint="Opcional."
            />
          </div>
          {editando ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-primary">Fecha de ingreso</span>
              <span className="text-secondary">
                {fecha(socio.fecha_ingreso)}. No se cambia después del registro.
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
