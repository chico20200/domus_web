import { useState } from "react"
import { Download } from "lucide-react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { MODULOS, type ModuloImportacion } from "../lib/importacion/modulos"
import { descargarPlantilla } from "../lib/importacion/plantilla"

/**
 * Importar desde Excel (bloque F). Un botón en cada módulo abre este modal: primero se
 * descarga la plantilla, que trae sus instrucciones (T20); después se sube el archivo
 * lleno (T21) y se revisa cómo queda antes de confirmar (T22).
 */

interface Props {
  modulo: ModuloImportacion
  onCerrar: () => void
}

export function ImportarExcelModal({ modulo, onCerrar }: Props) {
  const def = MODULOS[modulo]
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState("")

  async function descargar() {
    setDescargando(true)
    setError("")
    try {
      await descargarPlantilla(modulo)
    } catch {
      setError("No se pudo armar la plantilla. Intenta de nuevo.")
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Importar ${def.titulo.toLowerCase()} desde Excel`}
      descripcion={def.resumen}
      acciones={<Button label="Cerrar" variant="ghost" onClick={onCerrar} />}
    >
      <ol className="flex flex-col gap-5 text-sm">
        <li className="flex flex-col gap-2">
          <p className="font-medium text-primary">1. Descarga la plantilla</p>
          <p className="text-secondary">
            Trae una hoja de instrucciones y{" "}
            {def.hojas.length === 1
              ? `la hoja «${def.hojas[0].nombre}»`
              : `las hojas ${def.hojas.map((h) => `«${h.nombre}»`).join(" y ")}`}{" "}
            para llenar.
          </p>
          <div>
            <Button
              label="Descargar plantilla"
              variant="secondary"
              icon={Download}
              loading={descargando}
              onClick={descargar}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructivo">
              {error}
            </p>
          )}
        </li>
        <li className="flex flex-col gap-2">
          <p className="font-medium text-primary">2. Llénala</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-secondary">
            {def.hojas.map((h) => (
              <li key={h.nombre}>
                <span className="text-primary">{h.nombre}:</span> {h.fila} Obligatorias:{" "}
                {h.columnas
                  .filter((c) => c.obligatoria)
                  .map((c) => c.encabezado)
                  .join(", ")}
                .
              </li>
            ))}
            <li>
              Si no sabes una fecha, pon una aproximada: cada fila cae en su ciclo por su fecha.
            </li>
          </ul>
        </li>
        <li className="flex flex-col gap-2">
          <p className="font-medium text-primary">3. Súbela y revisa</p>
          <p className="text-secondary">
            Antes de guardar verás cómo queda todo. Si una fila tiene un error, no se importa nada
            hasta corregirlo.
          </p>
        </li>
      </ol>
    </Modal>
  )
}
