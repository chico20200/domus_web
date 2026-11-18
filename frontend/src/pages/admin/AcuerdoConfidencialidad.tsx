import { useState } from "react"
import { Panel } from "../../components/Panel"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { CheckboxField } from "../../components/CheckboxField"
import { TextoSecciones } from "../../components/TextoSecciones"
import { adminService } from "../../api/admin.service"
import { ACUERDO, ACUERDO_VERSION } from "../../lib/confidencialidad"
import { fecha } from "../../lib/format"

/**
 * Acuerdo de confidencialidad (HU021, HU-S03). Se acepta antes de abrir el panel, y otra
 * vez cada vez que cambia su versión. El backend guarda la aceptación con versión y fecha y
 * no entrega datos del panel sin ella.
 */
export function AcuerdoConfidencialidad({ onAceptado }: { onAceptado: () => void }) {
  const [acepta, setAcepta] = useState(false)
  const [errorCasilla, setErrorCasilla] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  async function aceptar() {
    setError("")
    if (!acepta) return setErrorCasilla("Para abrir el panel tienes que aceptar el acuerdo")
    setEnviando(true)
    try {
      await adminService.aceptarAcuerdo(ACUERDO_VERSION)
      onAceptado()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la aceptación")
      setEnviando(false)
    }
  }

  return (
    <Panel
      titulo="Acuerdo de confidencialidad"
      descripcion={`Léelo antes de abrir el panel. Versión del ${fecha(ACUERDO_VERSION)}.`}
    >
      <TextoSecciones secciones={ACUERDO} />
      <Form
        onSubmit={aceptar}
        error={error}
        actions={<Button type="submit" label="Aceptar y abrir el panel" loading={enviando} />}
      >
        <CheckboxField
          label="Leí el acuerdo de confidencialidad y me comprometo a cumplirlo"
          checked={acepta}
          onChange={(e) => {
            setAcepta(e.target.checked)
            setErrorCasilla("")
          }}
          error={errorCasilla}
          required
        />
      </Form>
    </Panel>
  )
}
