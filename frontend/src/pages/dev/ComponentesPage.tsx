import { useState, type ReactNode } from "react"
import {
  CircleCheck,
  Clock,
  Download,
  Mail,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react"
import { PageShell } from "../../components/layout/PageShell"
import { Button } from "../../components/Button"
import { TextField } from "../../components/TextField"
import { SelectField } from "../../components/SelectField"
import { TextareaField } from "../../components/TextareaField"
import { Form } from "../../components/Form"
import { Modal } from "../../components/Modal"
import { LoadingState } from "../../components/LoadingState"
import { EmptyState } from "../../components/EmptyState"
import { Badge } from "../../components/Badge"
import { useTheme } from "../../context/ThemeContext"
import { fecha, fechaHora, moneda, porcentaje } from "../../lib/format"

/**
 * Página de muestra de componentes (T15). Solo existe en desarrollo: la ruta
 * /dev/componentes se registra con import.meta.env.DEV y no entra en el build.
 *
 * Sirve para revisar los primitivos de la Etapa 1 en claro y oscuro antes de migrar
 * las páginas. Usa solo clases sobre tokens, como cualquier página nueva.
 */

function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string
  nota?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-base bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-primary">{titulo}</h2>
        {nota && <p className="text-sm text-secondary">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

function Muestra({ clase, nombre }: { clase: string; nombre: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`size-8 shrink-0 rounded-lg border border-base ${clase}`} />
      <code className="text-xs text-secondary">{nombre}</code>
    </div>
  )
}

const SOCIOS = [
  { value: "1", label: "Ana Pérez · 1712345678" },
  { value: "2", label: "Luis Toapanta · 0912345678" },
  { value: "3", label: "Rosa Quishpe · 0601234567", disabled: true },
]

export default function ComponentesPage() {
  const { isDark, toggleTheme } = useTheme()

  // Campos sueltos
  const [texto, setTexto] = useState("")
  const [cedula, setCedula] = useState("17123")
  const [monto, setMonto] = useState("150.50")
  const [dia, setDia] = useState("2026-11-11")
  const [socio, setSocio] = useState("")
  const [nota, setNota] = useState("Pago adelantado por viaje")
  const [correoIcono, setCorreoIcono] = useState("")

  // Formulario
  const [correo, setCorreo] = useState("")
  const [clave, setClave] = useState("")
  const [errorCorreo, setErrorCorreo] = useState<string>()
  const [errorGeneral, setErrorGeneral] = useState<string>()
  const [enviando, setEnviando] = useState(false)
  const [envios, setEnvios] = useState(0)

  async function enviar() {
    setErrorGeneral(undefined)
    setErrorCorreo(correo.includes("@") ? undefined : "Escribe un correo válido")
    if (!correo.includes("@")) return
    setEnviando(true)
    await new Promise((r) => setTimeout(r, 600))
    setEnviando(false)
    setEnvios((n) => n + 1)
    if (clave !== "domus") setErrorGeneral("Correo o contraseña incorrectos")
  }

  // Modal
  const [modal, setModal] = useState<"" | "normal" | "amplio" | "confirmar">("")
  const [deposito, setDeposito] = useState("")

  return (
    <PageShell titulo="Componentes (desarrollo)" ancho="completo">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-secondary">
          Primitivos de la Etapa 1. Cambia el modo para revisarlos en claro y oscuro.
        </p>
        <Button
          variant="secondary"
          label={isDark ? "Ver en modo claro" : "Ver en modo oscuro"}
          icon={isDark ? Sun : Moon}
          onClick={toggleTheme}
        />
      </div>

      <Seccion titulo="Colores" nota="Tokens de index.css. Clases en docs/SISTEMA_DE_DISENO.md.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Muestra clase="bg-accion-primaria" nombre="accion-primaria" />
          <Muestra clase="bg-accion-primaria-hover" nombre="accion-primaria-hover" />
          <Muestra clase="bg-destructivo" nombre="destructivo" />
          <Muestra clase="bg-destructivo-hover" nombre="destructivo-hover" />
          <Muestra clase="bg-estado-ok" nombre="estado-ok" />
          <Muestra clase="bg-estado-alerta" nombre="estado-alerta" />
          <Muestra clase="bg-base" nombre="bg-base" />
          <Muestra clase="bg-surface" nombre="bg-surface" />
          <Muestra clase="bg-surface-2" nombre="bg-surface-2" />
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <span className="text-primary">text-primary</span>
          <span className="text-secondary">text-secondary</span>
          <span className="text-muted">text-muted</span>
          <span className="text-accion-primaria">text-accion-primaria</span>
          <span className="text-destructivo">text-destructivo</span>
          <span className="text-estado-ok">text-estado-ok</span>
          <span className="text-estado-alerta">text-estado-alerta</span>
        </div>
      </Seccion>

      <Seccion titulo="Button" nota="Un solo primary por pantalla. Cancelar y Cerrar son ghost.">
        <div className="flex flex-wrap gap-3">
          <Button label="Guardar" />
          <Button variant="secondary" label="Ver tabla" />
          <Button variant="ghost" label="Cancelar" />
          <Button variant="destructive" label="Eliminar socio" icon={Trash2} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button label="Descargar PDF" icon={Download} />
          <Button label="Guardando" loading />
          <Button variant="secondary" label="Deshabilitado" disabled />
          <Button variant="destructive" label="Deshabilitado" disabled />
        </div>
        <div className="max-w-sm">
          <Button label="Ancho completo" fullWidth />
        </div>
      </Seccion>

      <Seccion titulo="Campos" nota="TextField, SelectField y TextareaField sobre FieldBase.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Nombre"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ana Pérez"
            hint="Como aparece en la cédula"
            required
          />
          <TextField
            label="Cédula"
            value={cedula}
            onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={10}
            error={cedula.length === 10 ? undefined : "La cédula debe tener 10 dígitos"}
            required
          />
          <TextField
            label="Monto"
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            min={0}
            step="0.01"
            hint={`Se mostrará como ${moneda(Number(monto))}`}
          />
          <TextField
            label="Fecha de ingreso"
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            hint={`Se mostrará como ${fecha(dia)}`}
          />
          <SelectField
            label="Socio"
            value={socio}
            onChange={(e) => setSocio(e.target.value)}
            options={SOCIOS}
            placeholder="Selecciona un socio…"
          />
          <TextField
            label="No editable"
            value="Caja Comunitaria San José"
            onChange={() => {}}
            disabled
          />
          <TextareaField
            label="Observaciones"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
          />
          <TextField
            label="Correo con ícono"
            type="email"
            value={correoIcono}
            onChange={(e) => setCorreoIcono(e.target.value)}
            placeholder="ana@cajacomunidad.ec"
            icon={Mail}
          />
        </div>
      </Seccion>

      <Seccion
        titulo="Form"
        nota="Enter en un campo envía. Correo sin @ marca el campo; cualquier clave distinta de «domus» da el error general."
      >
        <div className="max-w-md">
          <Form
            onSubmit={enviar}
            error={errorGeneral}
            actions={
              <>
                <Button type="submit" label="Ingresar" loading={enviando} />
                <Button
                  variant="ghost"
                  label="Limpiar"
                  onClick={() => {
                    setCorreo("")
                    setClave("")
                    setErrorCorreo(undefined)
                    setErrorGeneral(undefined)
                  }}
                />
              </>
            }
          >
            <TextField
              label="Correo"
              type="email"
              name="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              onBlur={() =>
                setErrorCorreo(
                  correo && !correo.includes("@") ? "Escribe un correo válido" : undefined,
                )
              }
              error={errorCorreo}
              required
            />
            <TextField
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
            />
          </Form>
          <p className="mt-4 text-xs text-muted">Envíos completados: {envios}</p>
        </div>
      </Seccion>

      <Seccion titulo="Modal" nota="Escape, clic afuera y ✕ cierran. El foco queda dentro.">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            label="Modal con formulario"
            onClick={() => setModal("normal")}
          />
          <Button variant="secondary" label="Modal amplio" onClick={() => setModal("amplio")} />
          <Button
            variant="destructive"
            label="Confirmación"
            onClick={() => setModal("confirmar")}
          />
        </div>

        <Modal
          abierto={modal === "normal"}
          onCerrar={() => setModal("")}
          titulo="Registrar depósito"
          descripcion="El monto se suma al saldo de la cuenta."
          cerrarAlClicFuera={false}
        >
          <Form
            onSubmit={() => setModal("")}
            actions={
              <>
                <Button type="submit" label="Depositar" />
                <Button variant="ghost" label="Cancelar" onClick={() => setModal("")} />
              </>
            }
          >
            <TextField
              label="Monto"
              type="number"
              value={deposito}
              onChange={(e) => setDeposito(e.target.value)}
              step="0.01"
              min={0}
            />
          </Form>
        </Modal>

        <Modal
          abierto={modal === "amplio"}
          onCerrar={() => setModal("")}
          titulo="Tabla de amortización"
          ancho="amplio"
          acciones={<Button variant="ghost" label="Cerrar" onClick={() => setModal("")} />}
        >
          <p className="text-sm text-secondary">
            768 px de ancho, para tablas. El cuerpo se desplaza si el contenido es más alto que la
            ventana.
          </p>
        </Modal>

        <Modal
          abierto={modal === "confirmar"}
          onCerrar={() => setModal("")}
          titulo="¿Eliminar a Ana Pérez?"
          descripcion="Se borrarán sus cuentas sin movimientos. Esta acción no se puede deshacer."
          acciones={
            <>
              <Button variant="ghost" label="Cancelar" onClick={() => setModal("")} />
              <Button variant="destructive" label="Eliminar" onClick={() => setModal("")} />
            </>
          }
        />
      </Seccion>

      <Seccion titulo="LoadingState y EmptyState">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-base">
            <LoadingState texto="Cargando socios…" />
          </div>
          <div className="rounded-xl border border-base">
            <EmptyState
              icono={Users}
              titulo="Aún no hay socios"
              descripcion="Registra al primer socio para empezar a abrir cuentas."
              accion={<Button label="Nuevo socio" icon={Plus} />}
            />
          </div>
          <div className="rounded-xl border border-base">
            <EmptyState icono={Search} titulo="Ningún socio coincide con «ana»" />
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Badge"
        nota="Contorno sin relleno, para cumplir AA sobre cualquier superficie."
      >
        <div className="flex flex-wrap gap-2">
          <Badge tono="ok" label="Activo" />
          <Badge tono="alerta" label="Pendiente" />
          <Badge tono="destructivo" label="En mora" />
          <Badge tono="neutral" label="Tesorero" />
          <Badge tono="ok" label="Al día" icon={CircleCheck} />
          <Badge tono="alerta" label="Por vencer" icon={Clock} />
          <Badge tono="destructivo" label="Castigado" icon={TriangleAlert} />
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg bg-surface-2 p-4">
          <Badge tono="ok" label="Sobre surface-2" />
          <Badge tono="alerta" label="Sobre surface-2" />
          <Badge tono="destructivo" label="Sobre surface-2" />
        </div>
      </Seccion>

      <Seccion titulo="Formato" nota="src/lib/format.ts">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">
            <code>moneda(1234.5)</code>
          </dt>
          <dd className="text-primary">{moneda(1234.5)}</dd>
          <dt className="text-muted">
            <code>fecha("2026-11-11")</code>
          </dt>
          <dd className="text-primary">{fecha("2026-11-11")}</dd>
          <dt className="text-muted">
            <code>fechaHora(ahora)</code>
          </dt>
          <dd className="text-primary">{fechaHora(new Date())}</dd>
          <dt className="text-muted">
            <code>porcentaje(12.5)</code>
          </dt>
          <dd className="text-primary">{porcentaje(12.5)}</dd>
          <dt className="text-muted">
            <code>porcentaje(1.23456, 4)</code>
          </dt>
          <dd className="text-primary">{porcentaje(1.23456, 4)}</dd>
          <dt className="text-muted">
            <code>moneda(null)</code>
          </dt>
          <dd className="text-primary">{moneda(null)}</dd>
        </dl>
      </Seccion>
    </PageShell>
  )
}
