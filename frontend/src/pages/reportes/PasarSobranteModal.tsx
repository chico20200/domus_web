import { useCallback, useState } from "react"
import { Modal } from "../../components/Modal"
import { Form } from "../../components/Form"
import { Button } from "../../components/Button"
import { SelectField } from "../../components/SelectField"
import { LoadingState } from "../../components/LoadingState"
import { useNotif } from "../../context/NotifContext"
import { fondosService } from "../../api/fondos.service"
import { reportesService } from "../../api/reportes.service"
import { moneda } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"

interface Props {
  cajaId: string
  ciclo: { numero: number; label: string }
  monto: number
  onCerrar: () => void
  onPasado: () => void
}

/**
 * Pasa a un fondo los centavos que sobraron del reparto de un ciclo cerrado (T23). Se
 * hace una sola vez por ciclo; el monto lo calcula el backend con el mismo reparto.
 */
export function PasarSobranteModal({ cajaId, ciclo, monto, onCerrar, onPasado }: Props) {
  const { toast } = useNotif()
  const cargar = useCallback(async () => {
    const r = await fondosService.getFondos(cajaId)
    return r.fondos.filter((f) => f.activo)
  }, [cajaId])
  const { datos: fondos, cargando, error } = useDatos(cargar)
  const [fondoId, setFondoId] = useState("")
  const [enviando, setEnviando] = useState(false)

  const elegido = fondoId || fondos?.[0]?.id || ""

  async function pasar() {
    if (!elegido) return
    setEnviando(true)
    try {
      const r = await reportesService.pasarSobrante(cajaId, ciclo.numero, elegido)
      toast("exito", `${r.message}: ${moneda(r.sobrante.monto)}`)
      onPasado()
      onCerrar()
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo pasar el sobrante")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Pasar el sobrante a Fondos"
      descripcion={`Los ${moneda(monto)} que sobraron al redondear el reparto del ciclo ${ciclo.numero} (${ciclo.label}) entran como depósito en el fondo que elijas. Se hace una sola vez por ciclo.`}
    >
      {cargando && <LoadingState texto="Cargando los fondos…" />}
      {!cargando && error && (
        <p role="alert" className="text-sm text-destructivo">
          No se pudieron cargar los fondos: {error}
        </p>
      )}
      {!cargando && !error && fondos && fondos.length === 0 && (
        <p className="text-sm text-secondary">
          La caja no tiene fondos abiertos. Crea uno en Fondos y vuelve aquí.
        </p>
      )}
      {!cargando && !error && fondos && fondos.length > 0 && (
        <Form
          onSubmit={pasar}
          actions={
            <>
              <Button type="submit" label={`Pasar ${moneda(monto)}`} loading={enviando} />
              <Button label="Cancelar" variant="ghost" onClick={onCerrar} disabled={enviando} />
            </>
          }
        >
          <SelectField
            label="Fondo"
            value={elegido}
            onChange={(e) => setFondoId(e.target.value)}
            options={fondos.map((f) => ({
              value: f.id,
              label: `${f.nombre} (${moneda(f.saldo)})`,
            }))}
          />
        </Form>
      )}
    </Modal>
  )
}
