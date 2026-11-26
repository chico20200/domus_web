import { useRef, useState } from "react"
import { CircleAlert, CircleCheck, Download, Upload } from "lucide-react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { MODULOS, type ModuloImportacion } from "../lib/importacion/modulos"
import { descargarPlantilla } from "../lib/importacion/plantilla"
import { leerArchivo } from "../lib/importacion/leer"
import { cargarContexto } from "../lib/importacion/contexto"
import { conPunto } from "../lib/texto"
import { validar, type Datos, type Problema, type Validacion } from "../lib/importacion/validar"

/**
 * Importar desde Excel (bloque F). Un botón en cada módulo abre este modal: primero se
 * descarga la plantilla, que trae sus instrucciones (T20); después se sube el archivo
 * lleno, que se lee y se revisa fila por fila contra los datos de la caja (T21), y se ve
 * cómo queda antes de confirmar (T22).
 */

interface Props {
  cajaId: string
  modulo: ModuloImportacion
  onCerrar: () => void
}

/** Más errores que estos no ayudan: se muestran los primeros y cuántos faltan */
const MAX_ERRORES = 50

export function ImportarExcelModal({ cajaId, modulo, onCerrar }: Props) {
  const def = MODULOS[modulo]
  const entrada = useRef<HTMLInputElement>(null)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState("")
  const [nombreArchivo, setNombreArchivo] = useState("")
  const [revisando, setRevisando] = useState(false)
  const [errorRevision, setErrorRevision] = useState("")
  const [resultado, setResultado] = useState<Validacion | null>(null)

  async function descargar() {
    setDescargando(true)
    setErrorDescarga("")
    try {
      await descargarPlantilla(modulo)
    } catch {
      setErrorDescarga("No se pudo armar la plantilla. Intenta de nuevo.")
    } finally {
      setDescargando(false)
    }
  }

  async function revisar(archivo: File | undefined) {
    if (!archivo) return
    setNombreArchivo(archivo.name)
    setResultado(null)
    setErrorRevision("")
    setRevisando(true)
    try {
      const [crudo, ctx] = await Promise.all([
        leerArchivo(archivo, modulo),
        cargarContexto(cajaId, modulo),
      ])
      setResultado(validar(modulo, crudo, ctx))
    } catch (err) {
      setErrorRevision(
        err instanceof Error
          ? `No se pudo revisar el archivo: ${err.message}`
          : "No se pudo revisar el archivo",
      )
    } finally {
      setRevisando(false)
      // Permite subir de nuevo el mismo archivo después de corregirlo
      if (entrada.current) entrada.current.value = ""
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Importar ${def.titulo.toLowerCase()} desde Excel`}
      descripcion={def.resumen}
      ancho={resultado ? "amplio" : "normal"}
      cerrarAlClicFuera={false}
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
          {errorDescarga && (
            <p role="alert" className="text-destructivo">
              {errorDescarga}
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
            DOMUS revisa cada fila contra los datos de la caja. Si una fila tiene un error, no se
            importa nada hasta corregirlo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              label={nombreArchivo ? "Subir otro archivo" : "Subir archivo"}
              variant="secondary"
              icon={Upload}
              loading={revisando}
              onClick={() => entrada.current?.click()}
            />
            {nombreArchivo && (
              <span className="min-w-0 truncate text-secondary">{nombreArchivo}</span>
            )}
          </div>
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => revisar(e.target.files?.[0])}
          />
          {revisando && <p className="text-secondary">Revisando el archivo…</p>}
          {errorRevision && (
            <p role="alert" className="text-destructivo">
              {errorRevision}
            </p>
          )}
          {resultado && <ResultadoRevision resultado={resultado} />}
        </li>
      </ol>
    </Modal>
  )
}

function ResultadoRevision({ resultado }: { resultado: Validacion }) {
  const { errores, avisos, filas, datos } = resultado

  if (errores.length) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-base bg-surface-2 p-4"
      >
        <p className="flex items-center gap-2 font-medium text-primary">
          <CircleAlert size={18} className="shrink-0 text-destructivo" aria-hidden="true" />
          {errores.length === 1 ? "Hay 1 problema" : `Hay ${errores.length} problemas`} en el
          archivo. No se importó nada: corrígelo y súbelo de nuevo.
        </p>
        <ListaProblemas problemas={errores.slice(0, MAX_ERRORES)} />
        {errores.length > MAX_ERRORES && (
          <p className="text-secondary">
            Y {errores.length - MAX_ERRORES} más. Corrige estos primero y vuelve a subirlo.
          </p>
        )}
      </div>
    )
  }

  const porCiclo = contarPorCiclo(datos)
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-base bg-surface-2 p-4">
      <p className="flex items-center gap-2 font-medium text-primary">
        <CircleCheck size={18} className="shrink-0 text-estado-ok" aria-hidden="true" />
        El archivo está bien: {filas} {filas === 1 ? "fila" : "filas"} sin errores.
      </p>
      {porCiclo.length > 0 && (
        <p className="text-secondary">
          Por ciclo:{" "}
          {porCiclo
            .map(([ciclo, n]) => `ciclo ${ciclo}, ${n} ${n === 1 ? "fila" : "filas"}`)
            .join(" · ")}
          .
        </p>
      )}
      {avisos.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-primary">Para tener en cuenta:</p>
          <ListaProblemas problemas={avisos} />
        </div>
      )}
    </div>
  )
}

function ListaProblemas({ problemas }: { problemas: Problema[] }) {
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-secondary">
      {problemas.map((p, i) => (
        <li key={i}>
          {p.fila !== null && (
            <span className="text-primary">
              {p.hoja ? `${p.hoja}, fila ${p.fila}` : `Fila ${p.fila}`}
              {p.columna ? ` (${p.columna})` : ""}:{" "}
            </span>
          )}
          {conPunto(p.mensaje)}
        </li>
      ))}
    </ul>
  )
}

/** Cuántas filas caen en cada ciclo, en orden */
function contarPorCiclo(datos: Datos): [number, number][] {
  const ciclos: (number | null)[] =
    datos.modulo === "socios"
      ? datos.socios.map((s) => s.ciclo)
      : datos.modulo === "creditos"
        ? datos.creditos.flatMap((c) => [c.ciclo, ...c.pagos.map((p) => p.ciclo)])
        : datos.movimientos.map((m) => m.ciclo)
  const cuenta = new Map<number, number>()
  for (const c of ciclos) if (c !== null) cuenta.set(c, (cuenta.get(c) ?? 0) + 1)
  return [...cuenta.entries()].sort((a, b) => a[0] - b[0])
}
