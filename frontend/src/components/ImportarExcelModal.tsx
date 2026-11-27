import { useRef, useState } from "react"
import { CircleAlert, CircleCheck, Download, Upload } from "lucide-react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Badge } from "./Badge"
import { DataTable } from "./DataTable"
import { MODULOS, type ModuloImportacion } from "../lib/importacion/modulos"
import { descargarPlantilla } from "../lib/importacion/plantilla"
import { leerArchivo } from "../lib/importacion/leer"
import { cargarContexto } from "../lib/importacion/contexto"
import { filasParaImportar } from "../lib/importacion/enviar"
import { conPunto } from "../lib/texto"
import { fecha, moneda } from "../lib/format"
import { validar, type Datos, type Problema, type Validacion } from "../lib/importacion/validar"
import { importacionService } from "../api/importacion.service"
import type { ResultadoImportacion } from "../api/importacion.types"

/**
 * Importar desde Excel (bloque F). Un botón en cada módulo abre este modal: primero se
 * descarga la plantilla, que trae sus instrucciones (T20); después se sube el archivo
 * lleno, que se lee y se revisa fila por fila contra los datos de la caja (T21). Si está
 * bien, la base hace un simulacro y se ve cómo queda; al confirmar se importa todo o
 * nada (T22).
 */

interface Props {
  cajaId: string
  modulo: ModuloImportacion
  onCerrar: () => void
  /** Después de importar, para que la página vuelva a leer sus datos */
  onImportado: () => void
}

/** Más errores que estos no ayudan: se muestran los primeros y cuántos faltan */
const MAX_ERRORES = 50

const mensajeDe = (err: unknown, inicio: string) =>
  err instanceof Error ? `${inicio}: ${err.message}` : inicio

export function ImportarExcelModal({ cajaId, modulo, onCerrar, onImportado }: Props) {
  const def = MODULOS[modulo]
  const entrada = useRef<HTMLInputElement>(null)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState("")
  const [nombreArchivo, setNombreArchivo] = useState("")
  const [revisando, setRevisando] = useState(false)
  const [errorRevision, setErrorRevision] = useState("")
  const [resultado, setResultado] = useState<Validacion | null>(null)
  const [vista, setVista] = useState<ResultadoImportacion | null>(null)
  const [importando, setImportando] = useState(false)
  const [errorImportar, setErrorImportar] = useState("")
  const [hecho, setHecho] = useState<ResultadoImportacion | null>(null)

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
    setVista(null)
    setErrorRevision("")
    setErrorImportar("")
    setRevisando(true)
    try {
      const [crudo, ctx] = await Promise.all([
        leerArchivo(archivo, modulo),
        cargarContexto(cajaId, modulo),
      ])
      const r = validar(modulo, crudo, ctx)
      // Sin errores, la base hace el simulacro: lo que muestra es lo que quedaría
      if (!r.errores.length) {
        try {
          setVista(
            await importacionService.importar(cajaId, modulo, filasParaImportar(r.datos), true),
          )
        } catch (err) {
          // La base encontró algo que el navegador no vio (otro movimiento registrado
          // mientras tanto, por ejemplo): se muestra como un problema más
          r.errores.push({
            hoja: "",
            fila: null,
            mensaje: err instanceof Error ? err.message : "No se pudo revisar con la base",
          })
        }
      }
      setResultado(r)
    } catch (err) {
      setErrorRevision(mensajeDe(err, "No se pudo revisar el archivo"))
    } finally {
      setRevisando(false)
      // Permite subir de nuevo el mismo archivo después de corregirlo
      if (entrada.current) entrada.current.value = ""
    }
  }

  async function confirmar() {
    if (!resultado) return
    setImportando(true)
    setErrorImportar("")
    try {
      const r = await importacionService.importar(
        cajaId,
        modulo,
        filasParaImportar(resultado.datos),
        false,
      )
      setHecho(r)
      onImportado()
    } catch (err) {
      setErrorImportar(mensajeDe(err, "No se importó nada"))
    } finally {
      setImportando(false)
    }
  }

  const listo = !!resultado && !!vista && !resultado.errores.length

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Importar ${def.titulo.toLowerCase()} desde Excel`}
      descripcion={def.resumen}
      ancho={resultado ? "amplio" : "normal"}
      cerrarAlClicFuera={false}
      acciones={
        hecho ? (
          <Button label="Listo" onClick={onCerrar} />
        ) : (
          <>
            <Button label="Cancelar" variant="ghost" onClick={onCerrar} disabled={importando} />
            {listo && (
              <Button
                label={`Importar ${resultado.filas} ${resultado.filas === 1 ? "fila" : "filas"}`}
                loading={importando}
                onClick={confirmar}
              />
            )}
          </>
        )
      }
    >
      {hecho ? (
        <Hecho resultado={hecho} />
      ) : (
        <ol className="flex flex-col gap-5 text-sm">
          {/* Con la vista previa lista, los dos primeros pasos ya no hacen falta */}
          {!listo && (
            <>
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
                    Si no sabes una fecha, pon una aproximada: cada fila cae en su ciclo por su
                    fecha.
                  </li>
                </ul>
              </li>
            </>
          )}
          <li className="flex flex-col gap-2">
            <p className="font-medium text-primary">
              {listo ? "Revisa y confirma" : "3. Súbela, revisa y confirma"}
            </p>
            <p className="text-secondary">
              DOMUS revisa cada fila contra los datos de la caja y muestra cómo queda. Nada se
              guarda hasta que confirmes, y se importa todo o nada.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                label={nombreArchivo ? "Subir otro archivo" : "Subir archivo"}
                variant="secondary"
                icon={Upload}
                loading={revisando}
                disabled={importando}
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
            {resultado && <ResultadoRevision resultado={resultado} vista={vista} />}
            {errorImportar && (
              <p role="alert" className="text-destructivo">
                {conPunto(errorImportar)} Corrige el archivo y súbelo de nuevo.
              </p>
            )}
          </li>
        </ol>
      )}
    </Modal>
  )
}

function ResultadoRevision({
  resultado,
  vista,
}: {
  resultado: Validacion
  vista: ResultadoImportacion | null
}) {
  const { errores, avisos, filas, datos } = resultado

  if (errores.length || !vista) {
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
    <div className="flex flex-col gap-4 rounded-lg border border-base bg-surface-2 p-4">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 font-medium text-primary">
          <CircleCheck size={18} className="shrink-0 text-estado-ok" aria-hidden="true" />
          El archivo está bien: {filas} {filas === 1 ? "fila" : "filas"} sin errores. Así queda la
          caja si lo importas:
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
      </div>
      <VistaPrevia datos={datos} vista={vista} />
      {avisos.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-primary">Para tener en cuenta:</p>
          <ListaProblemas problemas={avisos} />
        </div>
      )}
    </div>
  )
}

/** Cómo queda cada cosa, con los números del simulacro de la base */
function VistaPrevia({ datos, vista }: { datos: Datos; vista: ResultadoImportacion }) {
  const derecha = "derecha" as const

  if ("cuentas" in vista) {
    return (
      <div>
        <DataTable
          descripcion="Cuentas de ahorro antes y después de importar"
          filas={vista.cuentas}
          claveFila={(c) => c.numero_cuenta}
          columnas={[
            { clave: "socio", encabezado: "Socio", celda: (c) => c.socio },
            {
              clave: "cuenta",
              encabezado: "Cuenta",
              celda: (c) => (
                <span className="flex flex-wrap items-center gap-2">
                  {c.numero_cuenta}
                  {c.nueva && <Badge label="Nueva" tono="ok" />}
                </span>
              ),
            },
            {
              clave: "mov",
              encabezado: "Movimientos",
              alinear: derecha,
              celda: (c) => c.movimientos,
            },
            {
              clave: "antes",
              encabezado: "Saldo hoy",
              alinear: derecha,
              celda: (c) => moneda(c.saldo_antes),
            },
            {
              clave: "despues",
              encabezado: "Saldo después",
              alinear: derecha,
              celda: (c) => moneda(c.saldo_despues),
            },
          ]}
        />
      </div>
    )
  }

  if ("fondos" in vista) {
    return (
      <div>
        <DataTable
          descripcion="Fondos antes y después de importar"
          filas={vista.fondos}
          claveFila={(f) => f.fondo}
          columnas={[
            {
              clave: "fondo",
              encabezado: "Fondo",
              celda: (f) => (
                <span className="flex flex-wrap items-center gap-2">
                  {f.fondo}
                  {f.nuevo && <Badge label="Nuevo" tono="ok" />}
                </span>
              ),
            },
            {
              clave: "mov",
              encabezado: "Movimientos",
              alinear: derecha,
              celda: (f) => f.movimientos,
            },
            {
              clave: "antes",
              encabezado: "Saldo hoy",
              alinear: derecha,
              celda: (f) => moneda(f.saldo_antes),
            },
            {
              clave: "despues",
              encabezado: "Saldo después",
              alinear: derecha,
              celda: (f) => moneda(f.saldo_despues),
            },
          ]}
        />
      </div>
    )
  }

  if ("creditos" in vista) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-secondary">
          Cada crédito recibe su número en DOMUS, que sigue a los que ya hay en la caja.
        </p>
        <DataTable
          descripcion="Créditos que se importan y cómo quedan"
          filas={vista.creditos}
          claveFila={(c) => c.referencia}
          columnas={[
            {
              clave: "numero",
              encabezado: "N.º",
              celda: (c) => <span title={`N.º ${c.referencia} en el archivo`}>{c.numero}</span>,
            },
            { clave: "socio", encabezado: "Socio", celda: (c) => c.socio },
            {
              clave: "monto",
              encabezado: "Prestado",
              alinear: derecha,
              celda: (c) => moneda(c.monto),
            },
            {
              clave: "pagado",
              encabezado: "Pagado",
              alinear: derecha,
              celda: (c) => (
                <span
                  title={`${moneda(c.capital_pagado)} de capital y ${moneda(c.interes_pagado)} de interés`}
                >
                  {moneda(c.capital_pagado + c.interes_pagado)}
                </span>
              ),
            },
            {
              clave: "condonado",
              encabezado: "Condonado",
              alinear: derecha,
              celda: (c) => (c.interes_condonado > 0 ? moneda(c.interes_condonado) : "—"),
            },
            {
              clave: "saldo",
              encabezado: "Por cobrar",
              alinear: derecha,
              celda: (c) => moneda(c.saldo_pendiente),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (c) =>
                c.estado === "pagado" ? (
                  <Badge label="Pagado" tono="ok" />
                ) : (
                  <Badge label="Activo" tono="neutral" />
                ),
            },
          ]}
        />
      </div>
    )
  }

  // Socios: la lista del archivo, que la base aceptó entera
  if (datos.modulo !== "socios") return null
  return (
    <div>
      <DataTable
        descripcion="Socios que se registran"
        filas={datos.socios}
        claveFila={(s) => s.cedula}
        columnas={[
          { clave: "nombre", encabezado: "Socio", celda: (s) => `${s.nombre} ${s.apellido}` },
          { clave: "cedula", encabezado: "Cédula", celda: (s) => s.cedula },
          { clave: "ingreso", encabezado: "Ingreso", celda: (s) => fecha(s.fecha_ingreso) },
          { clave: "ciclo", encabezado: "Ciclo", alinear: derecha, celda: (s) => s.ciclo ?? "—" },
        ]}
      />
    </div>
  )
}

function Hecho({ resultado }: { resultado: ResultadoImportacion }) {
  const texto =
    "socios" in resultado
      ? `Se registraron ${resultado.socios} ${resultado.socios === 1 ? "socio" : "socios"}.`
      : "cuentas" in resultado
        ? `Se registraron ${resultado.cuentas.reduce((s, c) => s + c.movimientos, 0)} movimientos en ${resultado.cuentas.length} ${resultado.cuentas.length === 1 ? "cuenta" : "cuentas"}${resultado.cuentas.some((c) => c.nueva) ? `, ${resultado.cuentas.filter((c) => c.nueva).length} nuevas` : ""}.`
        : "fondos" in resultado
          ? `Se registraron ${resultado.fondos.reduce((s, f) => s + f.movimientos, 0)} movimientos en ${resultado.fondos.length} ${resultado.fondos.length === 1 ? "fondo" : "fondos"}.`
          : `Se registraron ${resultado.creditos.length} ${resultado.creditos.length === 1 ? "crédito" : "créditos"} con ${resultado.creditos.reduce((s, c) => s + c.pagos, 0)} pagos.`
  return (
    <div role="status" className="flex flex-col gap-2 text-sm">
      <p className="flex items-center gap-2 font-medium text-primary">
        <CircleCheck size={18} className="shrink-0 text-estado-ok" aria-hidden="true" />
        Importación hecha.
      </p>
      <p className="text-secondary">{texto}</p>
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
