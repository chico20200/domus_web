import { useState } from "react"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { TextareaField } from "../../components/TextareaField"
import { SelectField } from "../../components/SelectField"
import { ApiError } from "../../api/api.client"
import { cajasService } from "../../api/cajas.service"
import type { CreateCajaResponse } from "../../api/cajas.types"
import { AYUDA_CICLO, DURACIONES, OPCIONES_MES } from "../../lib/ciclo"
import { hoyISO } from "../../lib/format"
import { POLITICAS_VERSION } from "../../lib/politicas"
import { PasoAsistente } from "./PasoAsistente"

/**
 * Paso 3: datos de la caja y su periodo (HU004). Reemplaza la configuración inicial que
 * antes quedaba pendiente en Configuración. Al enviar se crea la caja.
 */

export interface DatosCaja {
  nombre: string
  descripcion: string
  fundacion: string
  mesInicio: string
  duracion: string
}

/** Los mismos largos que valida el backend (POST /cajas) */
const LARGO_NOMBRE = 80
const LARGO_DESCRIPCION = 300

type Campo = "nombre" | "descripcion" | "fundacion"

interface Props {
  datos: DatosCaja
  onCambiar: (datos: DatosCaja) => void
  onCreada: (respuesta: CreateCajaResponse) => void
  onAtras: () => void
}

export function PasoDatos({ datos, onCambiar, onCreada, onAtras }: Props) {
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState("")
  const [creando, setCreando] = useState(false)

  function cambiar(campo: keyof DatosCaja, valor: string) {
    onCambiar({ ...datos, [campo]: valor })
    if (campo in errores) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  function validar() {
    const e: Partial<Record<Campo, string>> = {}
    if (!datos.nombre.trim()) e.nombre = "Escribe el nombre de la caja"
    if (!datos.descripcion.trim()) {
      e.descripcion = "Cuenta en una frase para quién es la caja y qué hace"
    }
    if (!datos.fundacion) e.fundacion = "Indica la fecha en que se fundó la caja"
    else if (datos.fundacion > hoyISO()) {
      e.fundacion = "La fecha de fundación no puede ser posterior a hoy"
    }
    return e
  }

  async function crear() {
    setErrorGeneral("")
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length > 0) return
    setCreando(true)
    try {
      const r = await cajasService.crear({
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion.trim(),
        fecha_fundacion: datos.fundacion,
        mes_inicio_ciclo: Number(datos.mesInicio),
        duracion_ciclo: Number(datos.duracion),
        politicas_version: POLITICAS_VERSION,
      })
      onCreada(r)
    } catch (err) {
      // El backend dice de qué campo es el error cuando es de uno solo
      const campo = err instanceof ApiError ? err.datos.campo : undefined
      const mensaje = err instanceof Error ? err.message : "No se pudo crear la caja"
      if (campo === "nombre" || campo === "descripcion") setErrores({ [campo]: mensaje })
      else setErrorGeneral(mensaje)
      setCreando(false)
    }
  }

  return (
    <PasoAsistente
      titulo="Datos de la caja"
      descripcion="Con estos datos se crea la caja. El periodo se puede cambiar después en Configuración."
    >
      <Form
        onSubmit={crear}
        error={errorGeneral}
        actions={
          <>
            <Button type="submit" label="Crear la caja" loading={creando} />
            <Button label="Atrás" variant="ghost" onClick={onAtras} disabled={creando} />
          </>
        }
      >
        <TextField
          label="Nombre de la caja"
          name="nombre"
          value={datos.nombre}
          onChange={(e) => cambiar("nombre", e.target.value)}
          placeholder="Caja Comunitaria Norte"
          maxLength={LARGO_NOMBRE}
          error={errores.nombre}
          required
        />
        <TextareaField
          label="Descripción"
          name="descripcion"
          value={datos.descripcion}
          onChange={(e) => cambiar("descripcion", e.target.value)}
          placeholder="Caja de ahorro de las familias del barrio La Floresta"
          hint="Para quién es la caja y qué hace. La ven todos sus miembros al elegirla."
          maxLength={LARGO_DESCRIPCION}
          rows={2}
          error={errores.descripcion}
          required
        />
        <TextField
          label="Fecha de fundación de la caja"
          type="date"
          name="fundacion"
          value={datos.fundacion}
          onChange={(e) => cambiar("fundacion", e.target.value)}
          max={hoyISO()}
          hint={AYUDA_CICLO.fundacion}
          error={errores.fundacion}
          required
        />
        <SelectField
          label="Mes en que inicia cada ciclo"
          name="mesInicio"
          value={datos.mesInicio}
          onChange={(e) => cambiar("mesInicio", e.target.value)}
          options={OPCIONES_MES}
          hint={AYUDA_CICLO.mesInicio}
        />
        <SelectField
          label="Duración del ciclo"
          name="duracion"
          value={datos.duracion}
          onChange={(e) => cambiar("duracion", e.target.value)}
          options={DURACIONES}
          hint={AYUDA_CICLO.duracion}
        />
      </Form>
    </PasoAsistente>
  )
}
