import { useEffect, useRef, useState } from "react"
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
 * vez cada vez que cambia su versión. El backend guarda la aceptación con versión y fecha,
 * la muestra en la bitácora y no entrega datos del panel sin ella.
 *
 * El texto va completo en un recuadro desplazable y la casilla se habilita al llegar a su
 * final (HU021, T28). Una marca invisible al pie del texto avisa cuando se ve; si el texto
 * cabe entero sin desplazarse, se ve desde el inicio y la casilla ya está habilitada.
 */
export function AcuerdoConfidencialidad({ onAceptado }: { onAceptado: () => void }) {
  const [leido, setLeido] = useState(false)
  const [acepta, setAcepta] = useState(false)
  const [errorCasilla, setErrorCasilla] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const recuadro = useRef<HTMLDivElement>(null)
  const final = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (leido || !recuadro.current || !final.current) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setLeido(true)
          setErrorCasilla("")
        }
      },
      { root: recuadro.current },
    )
    observador.observe(final.current)
    return () => observador.disconnect()
  }, [leido])

  async function aceptar() {
    setError("")
    if (!leido) {
      return setErrorCasilla("Lee el acuerdo hasta el final para poder aceptarlo")
    }
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
      descripcion={`Léelo completo antes de abrir el panel. Versión del ${fecha(ACUERDO_VERSION)}.`}
    >
      {/* Recuadro desplazable con el teclado: tabIndex y nombre para el lector de pantalla */}
      <div
        ref={recuadro}
        tabIndex={0}
        role="region"
        aria-label="Texto del acuerdo de confidencialidad"
        className="max-h-96 overflow-y-auto rounded-lg border border-base bg-surface-2 p-4 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <TextoSecciones secciones={ACUERDO} />
        <div ref={final} className="h-px" aria-hidden="true" />
      </div>
      <Form
        onSubmit={aceptar}
        error={error}
        actions={<Button type="submit" label="Aceptar y continuar" loading={enviando} />}
      >
        <CheckboxField
          label="Leí el acuerdo de confidencialidad y me comprometo a cumplirlo"
          checked={acepta}
          disabled={!leido}
          hint={leido ? undefined : "Se habilita al llegar al final del acuerdo."}
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
