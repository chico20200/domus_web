import { useCallback, useState } from "react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Form } from "../../components/Form"
import { Badge } from "../../components/Badge"
import { LoadingState } from "../../components/LoadingState"
import { useNotif } from "../../context/NotifContext"
import { ciclosService } from "../../api/ciclos.service"
import type { TipoReparto } from "../../api/ciclos.types"
import { TIPO_REPARTO } from "../../lib/reparto"
import { useDatos } from "../../lib/useDatos"

const ORDEN: TipoReparto[] = ["equitativa", "diferenciada"]

/**
 * Tipo de reparto de intereses (T23). Lo elige el coordinador y vale para el ciclo actual;
 * los ciclos anteriores quedan con el tipo que tenían. Los centavos que sobran al
 * redondear van a Fondos de caja, desde Reportes, cuando el ciclo cierra.
 */
export function RepartoCaja({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()
  const cargar = useCallback(() => ciclosService.getReparto(cajaId), [cajaId])
  const { datos, cargando, error: errorCarga, recargar } = useDatos(cargar)

  const [editando, setEditando] = useState(false)
  const [tipo, setTipo] = useState<TipoReparto>("diferenciada")
  const [guardando, setGuardando] = useState(false)

  function editar() {
    if (datos) setTipo(datos.tipo)
    setEditando(true)
  }

  async function guardar() {
    setGuardando(true)
    try {
      const r = await ciclosService.guardarReparto(cajaId, tipo)
      await recargar()
      setEditando(false)
      toast("exito", r.message)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo cambiar el reparto")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel
      titulo="Reparto de intereses"
      descripcion="Cómo se divide entre los socios el interés que cobra la caja. Vale para el ciclo actual; los ciclos anteriores quedan como se repartieron."
    >
      {cargando && <LoadingState texto="Cargando el reparto…" />}

      {!cargando && errorCarga && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudo cargar el reparto.</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && !errorCarga && datos && !datos.configurado && (
        <p className="text-sm text-secondary">
          Configura primero el periodo de la caja: el reparto se elige para cada ciclo.
        </p>
      )}

      {!cargando && !errorCarga && datos?.configurado && !editando && (
        <>
          <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-4 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-primary">
              <span className="font-medium">{TIPO_REPARTO[datos.tipo].etiqueta}</span>
              {datos.ciclo && <Badge tono="neutral" label={`Ciclo ${datos.ciclo.numero}`} />}
            </p>
            <p className="text-secondary">{TIPO_REPARTO[datos.tipo].explicacion}</p>
            <p className="text-secondary">
              Cada socio recibe su parte redondeada hacia abajo al centavo. Los centavos que sobran
              se pasan a Fondos de caja desde Reportes cuando el ciclo cierra.
            </p>
          </div>
          <div>
            <Button label="Cambiar reparto" variant="secondary" onClick={editar} />
          </div>
        </>
      )}

      {!cargando && !errorCarga && datos?.configurado && editando && (
        <Form
          onSubmit={guardar}
          actions={
            <>
              <Button
                type="submit"
                label="Guardar reparto"
                loading={guardando}
                disabled={tipo === datos.tipo}
              />
              <Button label="Cancelar" variant="ghost" onClick={() => setEditando(false)} />
            </>
          }
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-primary">
              Reparto del ciclo {datos.ciclo?.numero}
              {datos.ciclo ? ` (${datos.ciclo.label})` : ""}
            </legend>
            {ORDEN.map((t) => {
              const elegido = t === tipo
              return (
                <label
                  key={t}
                  className={[
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                    elegido
                      ? "border-accion-texto bg-surface-2"
                      : "border-control hover:bg-surface-2",
                  ].join(" ")}
                >
                  <span className="flex h-5 shrink-0 items-center">
                    <input
                      type="radio"
                      name="tipo-reparto"
                      value={t}
                      checked={elegido}
                      onChange={() => setTipo(t)}
                      className="h-4 w-4 accent-accion-texto focus-visible:outline-none"
                    />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-primary">
                      {TIPO_REPARTO[t].etiqueta}
                    </span>
                    <span className="text-xs text-secondary">{TIPO_REPARTO[t].explicacion}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <p className="text-sm text-secondary">
            El cambio vale para todo el ciclo actual, también los meses que ya pasaron. Los ciclos
            anteriores no cambian.
          </p>
        </Form>
      )}
    </Panel>
  )
}
