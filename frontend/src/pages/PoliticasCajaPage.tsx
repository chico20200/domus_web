// src/pages/PoliticasCajaPage.tsx
import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { PaginaSinMenu } from "../components/layout/PaginaSinMenu"
import { Panel } from "../components/Panel"
import { Form } from "../components/Form"
import { Button } from "../components/Button"
import { CheckboxField } from "../components/CheckboxField"
import { LoadingState } from "../components/LoadingState"
import { TextoSecciones } from "../components/TextoSecciones"
import { useCaja } from "../context/CajaContext"
import { cajasService } from "../api/cajas.service"
import { POLITICAS, POLITICAS_VERSION } from "../lib/politicas"
import { fecha } from "../lib/format"
import { inicioDeRol } from "../lib/roles"

/**
 * Políticas de uso de la caja activa (HU022, HU-S04). Se piden al entrar a una caja cuyas
 * políticas vigentes la cuenta no aceptó: al unirse con un código, a los miembros que ya
 * estaban antes de esta pantalla, y a todos cuando cambia la versión. RolRoute trae aquí;
 * al aceptar se sigue a la página de inicio del rol.
 */
export default function PoliticasCajaPage() {
  const navigate = useNavigate()
  const { cajaActiva, verificando, setCajaActiva, salirDeCaja } = useCaja()
  const [acepta, setAcepta] = useState(false)
  const [errorCasilla, setErrorCasilla] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  if (verificando) return <LoadingState pantallaCompleta />
  if (!cajaActiva) return <Navigate to="/cajas" replace />
  if (cajaActiva.politicas_aceptadas) return <Navigate to={inicioDeRol(cajaActiva.rol)} replace />
  const caja = cajaActiva

  async function aceptar() {
    setError("")
    if (!acepta) return setErrorCasilla("Para entrar a la caja tienes que aceptar las políticas")
    setEnviando(true)
    try {
      await cajasService.aceptarPoliticas(caja.id, POLITICAS_VERSION)
      setCajaActiva({ ...caja, politicas_aceptadas: true })
      navigate(inicioDeRol(caja.rol), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la aceptación")
      setEnviando(false)
    }
  }

  function volver() {
    salirDeCaja()
    navigate("/cajas")
  }

  return (
    <PaginaSinMenu
      titulo={caja.nombre}
      descripcion="Antes de entrar, lee y acepta las políticas de uso de esta caja. Se piden una vez en cada caja, y otra vez si cambian."
      acciones={<Button label="Mis cajas" variant="ghost" onClick={volver} />}
    >
      <Panel
        titulo="Políticas de uso y tratamiento de datos"
        descripcion={`Versión del ${fecha(POLITICAS_VERSION)}.`}
      >
        <TextoSecciones secciones={POLITICAS} />
        <Form
          onSubmit={aceptar}
          error={error}
          actions={
            <>
              <Button type="submit" label="Aceptar y entrar" loading={enviando} />
              <Button label="Volver a Mis cajas" variant="ghost" onClick={volver} />
            </>
          }
        >
          <CheckboxField
            label="Leí y acepto las políticas de uso y tratamiento de datos de esta caja"
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
    </PaginaSinMenu>
  )
}
