import { useCallback, useState } from "react"
import { CreditCard, FileClock, UserRoundX, Wallet } from "lucide-react"
import { PageShell } from "../../components/layout/PageShell"
import { Button } from "../../components/Button"
import { Badge } from "../../components/Badge"
import { StatCard } from "../../components/StatCard"
import { DataTable, type Columna } from "../../components/DataTable"
import { EmptyState } from "../../components/EmptyState"
import { creditosService } from "../../api/creditos.service"
import type { Credito } from "../../api/creditos.types"
import { fecha, moneda, porcentaje } from "../../lib/format"
import { useDatos } from "../../lib/useDatos"
import { EN_CURSO, estadoCredito, numeroCredito } from "../../lib/creditos"
import { DetalleCredito } from "./DetalleCredito"

/**
 * "Mis créditos" del socio (T27), en solo lectura: sus solicitudes pendientes y todos sus
 * créditos, con el detalle de cada uno (cuotas, pagos y tabla de amortización). No puede
 * hacer solicitudes ni registrar pagos: eso lo hace el tesorero. El servidor resuelve su
 * ficha y devuelve solo lo suyo.
 */
export function MisCreditos({ cajaId, nombreCaja }: { cajaId: string; nombreCaja: string }) {
  const cargar = useCallback(() => creditosService.getMisCreditos(cajaId), [cajaId])
  const { datos, cargando, error, recargar } = useDatos(cargar)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  if (seleccionado) {
    return (
      <PageShell titulo="Mis créditos" ancho="formulario">
        <DetalleCredito
          cajaId={cajaId}
          nombreCaja={nombreCaja}
          creditoId={seleccionado}
          puedeOperar={false}
          textoVolver="Volver a mis créditos"
          onVolver={() => setSeleccionado(null)}
          onCambio={recargar}
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell titulo="Mis créditos" ancho="formulario">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-base bg-surface p-6">
          <p className="text-sm text-secondary">No se pudieron cargar tus créditos: {error}</p>
          <Button label="Reintentar" variant="secondary" onClick={recargar} />
        </div>
      </PageShell>
    )
  }

  if (datos && !datos.vinculado) {
    return (
      <PageShell titulo="Mis créditos" ancho="formulario">
        <div className="rounded-xl border border-base bg-surface">
          <EmptyState
            icono={UserRoundX}
            titulo="Tu usuario aún no está vinculado a una ficha de socio"
            descripcion="Pide al tesorero que registre tu ficha con el mismo correo con el que entras a DOMUS. Después verás aquí tus créditos."
          />
        </div>
      </PageShell>
    )
  }

  const todos = datos?.creditos ?? []
  const solicitudes = todos.filter((c) => c.estado === "pendiente")
  const creditos = todos.filter((c) => c.estado !== "pendiente")
  const enCurso = creditos.filter((c) => EN_CURSO.includes(c.estado))
  const porPagar = enCurso.reduce((s, c) => s + Number(c.saldo_pendiente), 0)

  const enlace =
    "w-fit text-left font-medium text-accion-texto hover:underline focus-visible:outline-2 focus-visible:outline-focus"
  const columnas = (conDesembolso: boolean): Columna<Credito>[] => [
    {
      clave: "numero",
      encabezado: "Crédito",
      celda: (c) => (
        <div className="flex flex-col">
          <button type="button" onClick={() => setSeleccionado(c.id)} className={enlace}>
            Crédito {numeroCredito(c.numero)}
          </button>
          <span className="text-xs text-secondary">
            {c.plazo_meses} meses · {porcentaje(c.tasa_interes)}
            {conDesembolso && c.fecha_desembolso ? ` · desde el ${fecha(c.fecha_desembolso)}` : ""}
            {!conDesembolso && c.created_at ? ` · pedida el ${fecha(c.created_at)}` : ""}
          </span>
        </div>
      ),
    },
    {
      clave: "monto",
      encabezado: "Monto",
      alinear: "derecha",
      celda: (c) => moneda(c.monto_solicitado),
    },
    {
      clave: "cuota",
      encabezado: "Cuota mensual",
      alinear: "derecha",
      celda: (c) => moneda(c.cuota_mensual),
    },
    ...(conDesembolso
      ? [
          {
            clave: "saldo",
            encabezado: "Saldo",
            alinear: "derecha",
            celda: (c) => moneda(c.saldo_pendiente),
          } satisfies Columna<Credito>,
        ]
      : []),
    {
      clave: "estado",
      encabezado: "Estado",
      celda: (c) => {
        const e = estadoCredito(c)
        return <Badge tono={e.tono} label={e.etiqueta} />
      },
    },
  ]

  return (
    <PageShell titulo="Mis créditos" ancho="formulario">
      {enCurso.length > 0 && (
        <StatCard
          etiqueta="Saldo por pagar"
          valor={moneda(porPagar)}
          detalle={`En ${enCurso.length} ${enCurso.length === 1 ? "crédito activo" : "créditos activos"}`}
          icono={Wallet}
          destacada
        />
      )}

      {solicitudes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-primary">Solicitudes</h2>
          <DataTable<Credito>
            descripcion="Tus solicitudes de crédito pendientes de aprobación"
            filas={solicitudes}
            claveFila={(c) => c.id}
            columnas={columnas(false)}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        {solicitudes.length > 0 && (
          <h2 className="text-base font-semibold text-primary">Créditos</h2>
        )}
        <DataTable<Credito>
          descripcion="Tus créditos en esta caja, con su saldo y estado"
          cargando={cargando}
          textoCargando="Cargando tus créditos…"
          filas={creditos}
          claveFila={(c) => c.id}
          vacio={
            solicitudes.length > 0 ? (
              <EmptyState
                icono={FileClock}
                titulo="Aún no tienes créditos desembolsados"
                descripcion="Cuando el tesorero apruebe tu solicitud, el crédito aparecerá aquí."
              />
            ) : (
              <EmptyState
                icono={CreditCard}
                titulo="Aún no tienes créditos"
                descripcion="Para pedir un crédito, habla con el tesorero de la caja, que registra la solicitud."
              />
            )
          }
          columnas={columnas(true)}
        />
      </section>
    </PageShell>
  )
}
