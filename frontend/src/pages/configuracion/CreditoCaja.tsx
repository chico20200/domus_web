import { useCallback, useState } from "react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Form } from "../../components/Form"
import { TextField } from "../../components/TextField"
import { LoadingState } from "../../components/LoadingState"
import { useNotif } from "../../context/NotifContext"
import { creditosService } from "../../api/creditos.service"
import { moneda } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"

/**
 * Reglas de crédito de la caja (T12): por ahora, el monto máximo de un crédito. Solo la
 * ve el coordinador. Vacío es sin límite. La base lo revisa en cada solicitud, así que
 * aplica aunque alguien la haga sin pasar por esta pantalla.
 */
export function CreditoCaja({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()
  const cargar = useCallback(() => creditosService.getConfig(cajaId), [cajaId])
  const { datos, cargando, error: errorCarga, recargar } = useDatos(cargar)

  const [editando, setEditando] = useState(false)
  const [monto, setMonto] = useState("")
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)

  const maximo = datos?.monto_maximo_credito ?? null

  function editar() {
    setMonto(maximo === null ? "" : String(maximo))
    setError("")
    setEditando(true)
  }

  async function guardar() {
    const texto = monto.trim()
    const m = Number(texto)
    if (texto !== "" && !(m > 0)) {
      setError("Indica un monto mayor que 0, o déjalo vacío para no poner límite")
      return
    }
    if (texto !== "" && Math.round(m * 100) / 100 !== m) {
      setError("Usa hasta dos decimales")
      return
    }
    setGuardando(true)
    try {
      const r = await creditosService.guardarConfig(cajaId, {
        monto_maximo_credito: texto === "" ? null : m,
      })
      await recargar()
      setEditando(false)
      toast("exito", r.message)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo guardar el monto máximo")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel
      titulo="Créditos"
      descripcion="Cuánto presta la caja como máximo en un solo crédito. Se revisa en cada solicitud nueva; los créditos ya solicitados no cambian."
    >
      {cargando && <LoadingState texto="Cargando las reglas de crédito…" />}

      {!cargando && errorCarga && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-secondary">No se pudieron cargar las reglas de crédito.</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      )}

      {!cargando && !errorCarga && !editando && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-surface-2 p-4 text-sm">
            <dt className="text-secondary">Monto máximo por crédito</dt>
            <dd className="text-right text-primary tabular-nums">
              {maximo === null ? "Sin límite" : moneda(maximo)}
            </dd>
          </dl>
          <div>
            <Button label="Cambiar monto máximo" variant="secondary" onClick={editar} />
          </div>
        </>
      )}

      {!cargando && !errorCarga && editando && (
        <Form
          onSubmit={guardar}
          actions={
            <>
              <Button type="submit" label="Guardar monto máximo" loading={guardando} />
              <Button label="Cancelar" variant="ghost" onClick={() => setEditando(false)} />
            </>
          }
        >
          <TextField
            label="Monto máximo por crédito ($)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              setError("")
            }}
            placeholder="Sin límite"
            hint="Déjalo vacío para no poner límite."
            error={error}
            autoFocus
          />
        </Form>
      )}
    </Panel>
  )
}
