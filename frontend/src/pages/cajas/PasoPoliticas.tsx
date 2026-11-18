import { useState } from "react"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { CheckboxField } from "../../components/CheckboxField"
import { TextoSecciones } from "../../components/TextoSecciones"
import { POLITICAS, POLITICAS_VERSION } from "../../lib/politicas"
import { fecha } from "../../lib/format"
import { PasoAsistente } from "./PasoAsistente"

/**
 * Paso 2: políticas de uso y tratamiento de datos (HU022). Aceptarlas es obligatorio para
 * seguir; la aceptación se guarda con su versión al crear la caja (paso 3).
 */

interface Props {
  aceptadas: boolean
  onCambiar: (aceptadas: boolean) => void
  onContinuar: () => void
  onAtras: () => void
}

export function PasoPoliticas({ aceptadas, onCambiar, onContinuar, onAtras }: Props) {
  const [error, setError] = useState("")

  return (
    <PasoAsistente
      titulo="Políticas de uso y tratamiento de datos"
      descripcion={`Léelas antes de continuar. Versión del ${fecha(POLITICAS_VERSION)}.`}
    >
      <TextoSecciones secciones={POLITICAS} />
      <Form
        onSubmit={() => {
          if (!aceptadas) return setError("Para crear la caja tienes que aceptar las políticas")
          onContinuar()
        }}
        actions={
          <>
            <Button type="submit" label="Continuar" />
            <Button label="Atrás" variant="ghost" onClick={onAtras} />
          </>
        }
      >
        <CheckboxField
          label="Leí y acepto las políticas de uso y tratamiento de datos de esta caja"
          checked={aceptadas}
          onChange={(e) => {
            onCambiar(e.target.checked)
            setError("")
          }}
          error={error}
          required
        />
      </Form>
    </PasoAsistente>
  )
}
