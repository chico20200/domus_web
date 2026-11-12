// src/pages/PagosPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleCheck, HandCoins, Search } from "lucide-react"
import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { DataTable } from "../components/DataTable"
import { EmptyState } from "../components/EmptyState"
import { TextField } from "../components/TextField"
import { ConfirmarPagoModal } from "../components/ConfirmarPagoModal"
import { useCaja } from "../context/CajaContext"
import { useNotif } from "../context/NotifContext"
import { creditosService } from "../api/creditos.service"
import { pagosService } from "../api/pagos.service"
import type { Credito } from "../api/creditos.types"
import type { TipoPago } from "../api/pagos.types"
import { moneda, porcentaje } from "../lib/format"
import { useDatos } from "../lib/useDatos"
import { estadoCredito, nombreSocio } from "../lib/creditos"
import { normalizar } from "../lib/texto"
import { ElegirPagoModal } from "./pagos/ElegirPagoModal"

/**
 * Cobranza: los créditos que aceptan pagos (activos y en mora) y, para cada uno,
 * "Registrar pago". El pago va en dos pasos: elegir qué se paga y confirmar el desglose.
 * Abono y prepago siguen en el detalle del crédito, en Créditos.
 */
export default function PagosPage() {
  const navigate = useNavigate()
  const { cajaActiva } = useCaja()

  useEffect(() => {
    if (!cajaActiva) navigate("/cajas", { replace: true })
  }, [cajaActiva, navigate])

  if (!cajaActiva) return null
  return <Pagos cajaId={cajaActiva.id} />
}

// Los únicos estados que reciben pagos; mora primero porque es lo urgente
const COBRABLES = ["mora", "activo"]

function Pagos({ cajaId }: { cajaId: string }) {
  const { toast } = useNotif()
  const cargar = useCallback(async () => {
    const { creditos } = await creditosService.getCreditos(cajaId)
    return creditos
      .filter((c) => COBRABLES.includes(c.estado))
      .sort(
        (a, b) =>
          COBRABLES.indexOf(a.estado) - COBRABLES.indexOf(b.estado) ||
          nombreSocio(a.socios).localeCompare(nombreSocio(b.socios), "es"),
      )
  }, [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [busqueda, setBusqueda] = useState("")
  // Paso 1: crédito elegido, sin tipo. Paso 2: con tipo, se confirma el desglose
  const [pago, setPago] = useState<{ credito: Credito; tipo: TipoPago | null } | null>(null)
  const [procesando, setProcesando] = useState(false)

  const creditos = datos ?? []
  const q = normalizar(busqueda.trim())
  const filtrados = creditos.filter(
    (c) => !q || normalizar(`${nombreSocio(c.socios)} ${c.socios?.cedula ?? ""}`).includes(q),
  )

  async function registrar() {
    if (!pago?.tipo) return
    const { credito, tipo } = pago
    const nombre = nombreSocio(credito.socios)
    setProcesando(true)
    try {
      const res = await pagosService.registrarPago(cajaId, credito.id, tipo)
      setPago(null)
      await recargar()
      toast(
        "exito",
        res.credito_pagado
          ? `Crédito de ${nombre} pagado por completo`
          : `Pago de ${nombre} registrado: ${moneda(res.desglose.total)}. Saldo pendiente: ${moneda(res.saldo_pendiente)}`,
      )
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "No se pudo registrar el pago")
    } finally {
      setProcesando(false)
    }
  }

  return (
    <PageShell titulo="Pagos" ancho="formulario">
      <div className="flex flex-col gap-2">
        <TextField
          label="Buscar crédito"
          ocultarEtiqueta
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por socio o cédula"
          icon={Search}
        />
        {!cargando && !error && (
          <p className="text-sm text-secondary" aria-live="polite">
            {q
              ? `${filtrados.length} de ${creditos.length} ${creditos.length === 1 ? "crédito" : "créditos"}`
              : `${creditos.length} ${creditos.length === 1 ? "crédito recibe" : "créditos reciben"} pagos`}
          </p>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar los créditos: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      ) : (
        <DataTable<Credito>
          descripcion="Créditos activos y en mora, con su cuota, saldo y estado"
          cargando={cargando}
          textoCargando="Cargando créditos…"
          filas={filtrados}
          claveFila={(c) => c.id}
          vacio={
            q ? (
              <EmptyState
                icono={Search}
                titulo="Ningún crédito coincide con la búsqueda"
                descripcion="Prueba con otra parte del nombre o con la cédula."
              />
            ) : (
              <EmptyState
                icono={CircleCheck}
                titulo="No hay créditos por cobrar"
                descripcion="Aquí aparecen los créditos desembolsados que aún tienen saldo."
              />
            )
          }
          columnas={[
            {
              clave: "socio",
              encabezado: "Socio",
              celda: (c) => (
                <div className="flex flex-col">
                  <span className="font-medium text-primary">{nombreSocio(c.socios)}</span>
                  <span className="text-xs text-secondary">
                    {c.plazo_meses} meses · {porcentaje(c.tasa_interes)}
                  </span>
                </div>
              ),
            },
            {
              clave: "cuota",
              encabezado: "Cuota",
              alinear: "derecha",
              celda: (c) => moneda(Number(c.cuota_mensual)),
            },
            {
              clave: "saldo",
              encabezado: "Saldo",
              alinear: "derecha",
              celda: (c) => moneda(Number(c.saldo_pendiente)),
            },
            {
              clave: "estado",
              encabezado: "Estado",
              celda: (c) => {
                const e = estadoCredito(c.estado)
                return <Badge tono={e.tono} label={e.etiqueta} />
              },
            },
            {
              clave: "accion",
              encabezado: <span className="sr-only">Acción</span>,
              alinear: "derecha",
              celda: (c) => (
                <Button
                  label="Registrar pago"
                  variant="secondary"
                  icon={HandCoins}
                  ariaLabel={`Registrar pago de ${nombreSocio(c.socios)}`}
                  onClick={() => setPago({ credito: c, tipo: null })}
                />
              ),
            },
          ]}
        />
      )}

      {pago && !pago.tipo && (
        <ElegirPagoModal
          nombreSocio={nombreSocio(pago.credito.socios)}
          cuotaMensual={Number(pago.credito.cuota_mensual)}
          onCerrar={() => setPago(null)}
          onContinuar={(tipo) => setPago({ ...pago, tipo })}
        />
      )}
      {pago?.tipo && (
        <ConfirmarPagoModal
          cajaId={cajaId}
          creditoId={pago.credito.id}
          tipo={pago.tipo}
          nombreSocio={nombreSocio(pago.credito.socios)}
          procesando={procesando}
          onConfirmar={registrar}
          onCancelar={() => setPago(null)}
        />
      )}
    </PageShell>
  )
}
