import { useCallback, useState } from "react"
import { CircleCheck, Coins, FileText, HandCoins, Undo2, Wallet } from "lucide-react"
import { Panel } from "../../components/Panel"
import { Button } from "../../components/Button"
import { Badge } from "../../components/Badge"
import { StatCard } from "../../components/StatCard"
import { DataTable } from "../../components/DataTable"
import { EmptyState } from "../../components/EmptyState"
import { LoadingState } from "../../components/LoadingState"
import { ConfirmarPagoModal } from "../../components/ConfirmarPagoModal"
import { AbonoModal } from "../../components/AbonoModal"
import { TablaAmortizacion } from "../../components/TablaAmortizacion"
import { useNotif } from "../../context/NotifContext"
import { creditosService } from "../../api/creditos.service"
import { pagosService } from "../../api/pagos.service"
import type { PagoCredito, TipoPago } from "../../api/pagos.types"
import { fecha, moneda, porcentaje } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { estadoCredito, nombreSocio } from "../../lib/creditos"

/**
 * Detalle de un crédito: cifras, aprobación, pagos, prepago e historial.
 * `puedeOperar` (tesorero o coordinador) muestra las acciones; sin él, solo lectura.
 */

interface Props {
  cajaId: string
  nombreCaja: string
  creditoId: string
  puedeOperar: boolean
  onVolver: () => void
  /** Avisa a la lista que algo cambió (estado o saldo) */
  onCambio: () => void
}

export function DetalleCredito({
  cajaId,
  nombreCaja,
  creditoId,
  puedeOperar,
  onVolver,
  onCambio,
}: Props) {
  const { toast, confirm } = useNotif()

  const cargar = useCallback(async () => {
    const [detalle, proxima] = await Promise.all([
      creditosService.getCredito(cajaId, creditoId),
      pagosService.getProximaCuota(cajaId, creditoId),
    ])
    return { ...detalle, proxima }
  }, [cajaId, creditoId])
  const { datos, cargando, error, recargar } = useDatos(cargar)

  const [procesando, setProcesando] = useState(false)
  const [pagoPorConfirmar, setPagoPorConfirmar] = useState<TipoPago | null>(null)
  const [verAbono, setVerAbono] = useState(false)
  const [verTabla, setVerTabla] = useState(false)

  async function actualizar() {
    await recargar()
    onCambio()
  }

  if (cargando) return <LoadingState texto="Cargando el crédito…" />
  if (error || !datos) {
    return (
      <Panel>
        <p className="text-sm text-secondary">{error || "No se encontró el crédito."}</p>
        <div className="flex gap-3">
          <Button label="Volver a créditos" variant="ghost" icon={Undo2} onClick={onVolver} />
        </div>
      </Panel>
    )
  }

  const { credito: c, pagos, proxima } = datos
  const socio = nombreSocio(c.socios)
  const estado = estadoCredito(c.estado)
  const totalCapital = pagos.reduce((s, p) => s + Number(p.monto_capital), 0)
  const totalInteres = pagos.reduce((s, p) => s + Number(p.monto_interes), 0)
  const activo = c.estado === "activo"

  async function aprobar() {
    const ok = await confirm({
      titulo: `¿Aprobar el crédito de ${socio}?`,
      mensaje: `Se desembolsan ${moneda(c.monto_solicitado)} con fecha de hoy y se fijan los vencimientos de las ${c.plazo_meses} cuotas. Después de aprobarlo ya no se puede editar.`,
      labelOk: "Aprobar y desembolsar",
    })
    if (!ok) return
    setProcesando(true)
    try {
      await creditosService.aprobar(cajaId, c.id)
      await actualizar()
      toast("exito", "Crédito aprobado y desembolsado")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo aprobar el crédito")
    } finally {
      setProcesando(false)
    }
  }

  async function pagar() {
    if (!pagoPorConfirmar) return
    setProcesando(true)
    try {
      const res = await pagosService.registrarPago(cajaId, c.id, pagoPorConfirmar)
      setPagoPorConfirmar(null)
      await actualizar()
      toast(
        "exito",
        res.credito_pagado
          ? "Pago registrado. El crédito quedó pagado por completo."
          : `Pago de ${moneda(res.desglose.total)} registrado`,
      )
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo registrar el pago")
    } finally {
      setProcesando(false)
    }
  }

  async function abonar(monto: number, motivo: string) {
    setProcesando(true)
    try {
      const res = await pagosService.abonar(cajaId, c.id, monto, motivo)
      setVerAbono(false)
      await actualizar()
      if (res.credito_pagado) toast("exito", "Abono registrado. El crédito quedó pagado.")
      else if (res.resta_en_cuota.total > 0.001)
        toast(
          "info",
          `Abono registrado. Faltan ${moneda(res.resta_en_cuota.total)} para completar la cuota.`,
        )
      else toast("exito", "Abono registrado. La cuota quedó completa.")
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo registrar el abono")
    } finally {
      setProcesando(false)
    }
  }

  async function prepagar() {
    const prepago = proxima.prepago_disponible
    if (!prepago) return
    const ok = await confirm({
      titulo: `¿Prepagar la cuota ${prepago.numero_cuota}?`,
      mensaje: `Se cobra el capital de esa cuota (${moneda(prepago.capital)}) y se condonan ${moneda(prepago.interes_a_condonar)} de interés.`,
      labelOk: "Registrar prepago",
    })
    if (!ok) return
    setProcesando(true)
    try {
      const res = await pagosService.prepagar(cajaId, c.id)
      await actualizar()
      toast("exito", `Prepago registrado. Interés condonado: ${moneda(res.interes_condonado)}`)
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo registrar el prepago")
    } finally {
      setProcesando(false)
    }
  }

  return (
    <>
      <div>
        <Button label="Volver a créditos" variant="ghost" icon={Undo2} onClick={onVolver} />
      </div>

      <Panel
        titulo={socio}
        descripcion={`${c.plazo_meses} meses · ${porcentaje(c.tasa_interes)} de interés anual${c.fecha_desembolso ? ` · desembolsado el ${fecha(c.fecha_desembolso)}` : ""}`}
        acciones={<Badge tono={estado.tono} label={estado.etiqueta} />}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {[
            ["Monto prestado", c.monto_solicitado],
            ["Total a pagar", c.monto_total],
            ["Cuota mensual", c.cuota_mensual],
            ["Saldo pendiente", c.saldo_pendiente],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex flex-col gap-1">
              <dt className="text-xs text-secondary">{etiqueta}</dt>
              <dd className="text-base font-medium text-primary tabular-nums">
                {moneda(valor as number)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          {c.estado === "pendiente" && puedeOperar && (
            <Button
              label="Aprobar y desembolsar"
              icon={CircleCheck}
              loading={procesando}
              onClick={aprobar}
            />
          )}
          <Button
            label="Ver tabla de amortización"
            variant="secondary"
            icon={FileText}
            onClick={() => setVerTabla(true)}
          />
        </div>
      </Panel>

      {activo && puedeOperar && (
        <Panel
          titulo="Registrar pago"
          descripcion={
            proxima.pendiente
              ? `Próxima cuota: ${proxima.numero_cuota} de ${proxima.total_cuotas}, vence el ${fecha(proxima.fecha_vencimiento)}. Faltan ${moneda(proxima.falta_total)}.`
              : undefined
          }
        >
          <div className="flex flex-wrap gap-3">
            <Button
              label="Pago completo"
              icon={Wallet}
              disabled={procesando}
              onClick={() => setPagoPorConfirmar("completo")}
            />
            <Button
              label="Solo capital"
              variant="secondary"
              icon={Coins}
              disabled={procesando}
              onClick={() => setPagoPorConfirmar("solo_capital")}
            />
            <Button
              label="Solo interés"
              variant="secondary"
              icon={Coins}
              disabled={procesando}
              onClick={() => setPagoPorConfirmar("solo_interes")}
            />
            <Button
              label="Abono parcial"
              variant="secondary"
              icon={HandCoins}
              disabled={procesando}
              onClick={() => setVerAbono(true)}
            />
          </div>

          {proxima.prepago_disponible && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base pt-6">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium text-primary">Prepagar la última cuota</p>
                <p className="text-sm text-secondary">
                  Se cobra el capital de la cuota {proxima.prepago_disponible.numero_cuota} (
                  {moneda(proxima.prepago_disponible.capital)}) y se condonan{" "}
                  {moneda(proxima.prepago_disponible.interes_a_condonar)} de interés.
                </p>
              </div>
              <Button
                label="Registrar prepago"
                variant="secondary"
                loading={procesando}
                onClick={prepagar}
              />
            </div>
          )}
        </Panel>
      )}

      {pagos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard etiqueta="Capital pagado" valor={moneda(totalCapital)} />
          <StatCard etiqueta="Interés pagado" valor={moneda(totalInteres)} />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-primary">Historial de pagos</h2>
        <DataTable<PagoCredito>
          descripcion="Pagos registrados del crédito"
          filas={pagos}
          claveFila={(p) => p.id}
          vacio={<EmptyState titulo="Aún no hay pagos registrados" />}
          columnas={[
            { clave: "cuota", encabezado: "Cuota", celda: (p) => p.numero_cuota },
            { clave: "fecha", encabezado: "Fecha", celda: (p) => fecha(p.fecha_pago) },
            {
              clave: "capital",
              encabezado: "Capital",
              alinear: "derecha",
              celda: (p) => moneda(p.monto_capital),
            },
            {
              clave: "interes",
              encabezado: "Interés",
              alinear: "derecha",
              celda: (p) => moneda(p.monto_interes),
            },
            {
              clave: "total",
              encabezado: "Total",
              alinear: "derecha",
              celda: (p) => <span className="font-medium">{moneda(p.monto_pagado)}</span>,
            },
          ]}
        />
      </section>

      {pagoPorConfirmar && (
        <ConfirmarPagoModal
          cajaId={cajaId}
          creditoId={c.id}
          tipo={pagoPorConfirmar}
          nombreSocio={socio}
          procesando={procesando}
          onConfirmar={pagar}
          onCancelar={() => setPagoPorConfirmar(null)}
        />
      )}
      {verAbono && (
        <AbonoModal
          cajaId={cajaId}
          creditoId={c.id}
          nombreSocio={socio}
          procesando={procesando}
          onConfirmar={abonar}
          onCancelar={() => setVerAbono(false)}
        />
      )}
      {verTabla && (
        <TablaAmortizacion
          cajaId={cajaId}
          creditoId={c.id}
          nombreCaja={nombreCaja}
          onCerrar={() => setVerTabla(false)}
        />
      )}
    </>
  )
}
