// src/pages/NuevaCajaPage.tsx
import { useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Building2 } from "lucide-react"
import { PaginaSinMenu } from "../components/layout/PaginaSinMenu"
import { Button } from "../components/Button"
import { EmptyState } from "../components/EmptyState"
import { cajasService } from "../api/cajas.service"
import { useDatos } from "../lib/useDatos"
import { useCaja } from "../context/CajaContext"
import type { CreateCajaResponse } from "../api/cajas.types"
import { IndicadorPasos } from "./cajas/IndicadorPasos"
import { PasoQueEs } from "./cajas/PasoQueEs"
import { PasoPoliticas } from "./cajas/PasoPoliticas"
import { PasoDatos, type DatosCaja } from "./cajas/PasoDatos"
import { PasoConfirmacion } from "./cajas/PasoConfirmacion"

/**
 * Asistente para crear una caja (§5.1, HU-C01). Cuatro pantallas aquí y la quinta es el
 * dashboard con los siguientes pasos:
 *   1. Qué es una caja   2. Políticas de uso   3. Datos y periodo   4. Confirmación
 * La caja se crea al terminar el paso 3; desde la confirmación ya no se puede volver
 * atrás, para no crearla dos veces. Lo escrito en el paso 3 se conserva al ir y volver.
 */

const DATOS_VACIOS: DatosCaja = {
  nombre: "",
  descripcion: "",
  fundacion: "",
  mesInicio: "1",
  duracion: "12",
}

const PASOS = ["Qué es una caja", "Políticas de uso", "Datos de la caja", "Confirmación"]

export default function NuevaCajaPage() {
  const navigate = useNavigate()
  const { setCajaActiva } = useCaja()
  const [paso, setPaso] = useState(1)
  const [aceptadas, setAceptadas] = useState(false)
  const [datos, setDatos] = useState<DatosCaja>(DATOS_VACIOS)
  const [creada, setCreada] = useState<CreateCajaResponse | null>(null)

  const cancelar = () => navigate("/cajas")

  // Límite de tres cajas creadas por cuenta (T9): se avisa al empezar y no al final del
  // asistente. Si la consulta falla se sigue: crear_caja vuelve a comprobarlo al crear.
  const cargarCupo = useCallback(async () => (await cajasService.getMisCajas()).creacion, [])
  const { datos: cupo } = useDatos(cargarCupo)
  const sinCupo = paso < 4 && !!cupo && cupo.creadas >= cupo.limite

  return (
    <PaginaSinMenu
      titulo="Crear una caja"
      descripcion={
        sinCupo
          ? undefined
          : "Cuatro pasos: qué es una caja, las políticas de uso, sus datos y la confirmación."
      }
    >
      {sinCupo ? (
        <div className="rounded-xl border border-base bg-surface">
          <EmptyState
            icono={Building2}
            titulo={`Ya creaste ${cupo.limite} cajas`}
            descripcion={`Es el máximo de cajas que crea una cuenta. Puedes unirte a otras cajas con el código que te entregue su coordinador.`}
            accion={<Button label="Volver a Mis cajas" variant="secondary" onClick={cancelar} />}
          />
        </div>
      ) : (
        <IndicadorPasos pasos={PASOS} actual={paso} />
      )}

      {!sinCupo && paso === 1 && <PasoQueEs onContinuar={() => setPaso(2)} onCancelar={cancelar} />}
      {!sinCupo && paso === 2 && (
        <PasoPoliticas
          aceptadas={aceptadas}
          onCambiar={setAceptadas}
          onContinuar={() => setPaso(3)}
          onAtras={() => setPaso(1)}
        />
      )}
      {!sinCupo && paso === 3 && (
        <PasoDatos
          datos={datos}
          onCambiar={setDatos}
          onCreada={(r) => {
            setCreada(r)
            setPaso(4)
          }}
          onAtras={() => setPaso(2)}
        />
      )}
      {paso === 4 && creada && (
        <PasoConfirmacion
          creada={creada}
          onIrAlDashboard={() => {
            const { id, nombre, descripcion } = creada.caja
            setCajaActiva({
              id,
              nombre,
              descripcion,
              rol: "coordinador",
              // Las aceptó en el paso 2 y se guardaron al crear la caja
              politicas_aceptadas: true,
            })
            navigate("/dashboard", { replace: true })
          }}
        />
      )}
    </PaginaSinMenu>
  )
}
