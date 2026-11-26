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
import { PagoAdelantadoModal } from "../../components/PagoAdelantadoModal"
import { TablaAmortizacion } from "../../components/TablaAmortizacion"
import { useNotif } from "../../context/NotifContext"
import { creditosService } from "../../api/creditos.service"
import { pagosService } from "../../api/pagos.service"
import { adjuntarTrasRegistrar } from "../../api/comprobantes.service"
import { BotonComprobante } from "../../components/BotonComprobante"
import type { AdelantoResponse, PagoCredito, TipoPago } from "../../api/pagos.types"
import { fecha, moneda, porcentaje } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { EN_CURSO, estadoCredito, nombreSocio, numeroCredito } from "../../lib/creditos"
import { InfoTip } from "../../components/InfoTip"
import { AYUDA } from "../../lib/ayuda"

/**
 * Detalle de un crédito: cifras, aprobación, pagos, pago adelantado e historial.
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
  const [verAdelanto, setVerAdelanto] = useState(false)
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
  const estado = estadoCredito(c)
  const totalCapital = pagos.reduce((s, p) => s + Number(p.monto_capital), 0)
  const totalInteres = pagos.reduce((s, p) => s + Number(p.monto_interes), 0)
  const activo = EN_CURSO.includes(c.estado)

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

  async function pagar(foto: Blob | null) {
    if (!pagoPorConfirmar) return
    setProcesando(true)
    try {
      const res = await pagosService.registrarPago(cajaId, c.id, pagoPorConfirmar)
      const aviso = await adjuntarTrasRegistrar(
        { tipo: "pago", cajaId, creditoId: c.id, id: res.pago.id },
        foto,
      )
      setPagoPorConfirmar(null)
      await actualizar()
      if (aviso) toast("advertencia", aviso)
      else
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

  async function abonar(monto: number, motivo: string, foto: Blob | null) {
    setProcesando(true)
    try {
      const res = await pagosService.abonar(cajaId, c.id, monto, motivo)
      const aviso = await adjuntarTrasRegistrar(
        { tipo: "pago", cajaId, creditoId: c.id, id: res.pago.id },
        foto,
      )
      setVerAbono(false)
      await actualizar()
      if (aviso) toast("advertencia", aviso)
      else if (res.credito_pagado) toast("exito", "Abono registrado. El crédito quedó pagado.")
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

  async function adelantar(monto: number, foto: Blob | null) {
    setProcesando(true)
    try {
      const res = await pagosService.adelantar(cajaId, c.id, monto)
      // Una foto para todo el adelanto: se une a cada pago que lo forma
      let aviso: string | null = null
      for (const p of res.pagos) {
        aviso ??= await adjuntarTrasRegistrar(
          { tipo: "pago", cajaId, creditoId: c.id, id: p.id },
          foto,
        )
      }
      setVerAdelanto(false)
      await actualizar()
      if (aviso) toast("advertencia", aviso)
      else toast("exito", resumenAdelanto(res))
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo registrar el pago adelantado")
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
        descripcion={`Crédito ${numeroCredito(c.numero)} · ${c.plazo_meses} meses · ${porcentaje(c.tasa_interes)} de interés anual${c.fecha_desembolso ? ` · desembolsado el ${fecha(c.fecha_desembolso)}` : ""}`}
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
            <span className="flex items-center gap-2">
              <Button
                label="Aprobar y desembolsar"
                icon={CircleCheck}
                loading={procesando}
                onClick={aprobar}
              />
              <InfoTip ayuda={AYUDA.aprobarCredito} />
            </span>
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
          {/* Las cuatro formas de pago en una fila centrada; si no caben, siguen centradas */}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              label="Pago completo"
              compacto
              icon={Wallet}
              disabled={procesando}
              onClick={() => setPagoPorConfirmar("completo")}
            />
            <Button
              label="Solo capital"
              compacto
              variant="secondary"
              icon={Coins}
              disabled={procesando}
              onClick={() => setPagoPorConfirmar("solo_capital")}
            />
            <Button
              label="Solo interés"
              compacto
              variant="secondary"
              icon={Coins}
              disabled={procesando}
              onClick={() => setPagoPorConfirmar("solo_interes")}
            />
            <Button
              label="Abono parcial"
              compacto
              variant="secondary"
              icon={HandCoins}
              disabled={procesando}
              onClick={() => setVerAbono(true)}
            />
          </div>

          {proxima.adelanto && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base pt-6">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium text-primary">Pago adelantado</p>
                <p className="text-sm text-secondary">
                  {proxima.adelanto.disponible
                    ? `Se puede adelantar hasta ${moneda(proxima.adelanto.maximo)} de capital, desde la última cuota hacia atrás.`
                    : proxima.adelanto.motivo}
                </p>
              </div>
              {proxima.adelanto.disponible && (
                <Button
                  label="Registrar pago adelantado"
                  variant="secondary"
                  disabled={procesando}
                  onClick={() => setVerAdelanto(true)}
                />
              )}
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
            {
              clave: "comprobante",
              encabezado: "Comprobante",
              celda: (p) => (
                <BotonComprobante
                  destino={{ tipo: "pago", cajaId, creditoId: c.id, id: p.id }}
                  tiene={Boolean(p.comprobante)}
                  puedeAdjuntar={puedeOperar}
                  descripcion={`del pago de la cuota ${p.numero_cuota} del ${fecha(p.fecha_pago)}`}
                  onAdjuntado={actualizar}
                />
              ),
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
      {verAdelanto && proxima.adelanto?.disponible && (
        <PagoAdelantadoModal
          maximo={proxima.adelanto.maximo}
          cuotas={proxima.adelanto.cuotas}
          nombreSocio={socio}
          procesando={procesando}
          onConfirmar={adelantar}
          onCancelar={() => setVerAdelanto(false)}
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

/** "Pago adelantado de $230,00 registrado. Cuotas 6 y 5 pagadas (…). A la cuota 4 le quedan…" */
function resumenAdelanto(res: AdelantoResponse): string {
  if (res.credito_pagado) return "Pago adelantado registrado. El crédito quedó pagado por completo."
  const partes = [`Pago adelantado de ${moneda(res.capital_pagado)} registrado.`]
  const n = res.cuotas_adelantadas
  if (n.length > 0) {
    const lista =
      n.length === 1
        ? `Cuota ${n[0]} pagada`
        : `Cuotas ${n.slice(0, -1).join(", ")} y ${n[n.length - 1]} pagadas`
    partes.push(`${lista} (interés condonado: ${moneda(res.interes_condonado)}).`)
  }
  if (res.cuota_a_medias) {
    partes.push(
      `La cuota ${res.cuota_a_medias.numero_cuota} recibió ${moneda(res.cuota_a_medias.capital)} de capital y conserva su interés.`,
    )
  }
  return partes.join(" ")
}
