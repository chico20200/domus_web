# Especificaciones de actualización — DOMUS Web

Revisión del repositorio `chico20200/domus_web` (commit `c844dfb`) contrastada con el documento de Trabajo de Integración Curricular y con las observaciones de las revisiones 4 y 5.

- Fecha: 11 de noviembre de 2026
- Alcance revisado: 11.001 líneas, 13 páginas, 10 componentes, 11 rutas de backend
- Autor de la revisión: análisis automatizado sobre el código publicado

---

## 1. Diagnóstico

El sistema funciona. Lo que falla es que **no existe un lenguaje común**: cada página resuelve por su cuenta el color, el ancho, el espaciado, el formato de fecha y el manejo del teclado. No hay partes mal hechas y partes bien hechas; hay doce soluciones distintas al mismo problema, y por eso se perciben como superpuestas.

Tres mediciones resumen el estado:

| Medición | Valor | Qué significa |
| --- | --- | --- |
| Elementos `<form>` en todo el frontend | **0** | Enter no funciona en ninguna pantalla, no solo en login y registro |
| Usos de `variant="secondary"` | **23**, en 15 acciones distintas | El mismo verde es "Cancelar" y también "Guardar cambios" |
| Archivos que mezclan `style={{}}` con clases Tailwind | **20 de 22** | Dos sistemas de estilo compitiendo en el mismo archivo |

A esto se suma que `verificarRol` está copiado y pegado en seis archivos de backend, y que `Intl.NumberFormat` se vuelve a declarar en seis archivos de frontend.

**La conclusión práctica:** no conviene parchar pantalla por pantalla. Conviene construir primero la capa compartida (tokens, primitivos, layout, permisos) y después migrar las páginas una por una contra esa capa. Las secciones 2 a 5 describen esa capa; las secciones 6 a 9, la migración.

---

## 2. Sistema de diseño

### 2.1 El problema de los colores

Hoy las variantes del botón se llaman por su color, no por su intención:

```ts
// frontend/src/components/Button.tsx
primary:   "bg-primary_y   hover:bg-primary_yh   text-white"   // naranja
secondary: "bg-secondary_g hover:bg-secondary_gh text-white"   // verde
danger:    "bg-danger_r    hover:bg-danger_rh    text-white"   // rojo
```

Como solo hay tres y una es roja, todo lo que no es la acción principal cae en `secondary`. El resultado medido:

| Acción | Variante actual | Color que sale |
| --- | --- | --- |
| Cancelar (9 veces) | secondary | Verde |
| Cerrar (3 veces) | secondary | Verde |
| Guardar cambios | secondary | Verde |
| Crear nueva caja | secondary | Verde |
| Crear solicitud | secondary | Verde |
| Abrir cuenta | secondary | Verde |
| Depósito | secondary | Verde |

Cancelar y Guardar cambios se ven idénticos. El verde, que culturalmente significa confirmación, está puesto en el botón que descarta.

### 2.2 Escala de prioridad que hay que adoptar

El color debe salir del **nivel de la acción**, no del gusto de cada pantalla. Cuatro niveles bastan:

| Nivel | Nombre de la variante | Uso | Tratamiento visual | Cuántos por pantalla |
| --- | --- | --- | --- | --- |
| 1 | `primary` | La acción que la pantalla existe para hacer: Guardar, Crear caja, Registrar depósito | Relleno naranja de marca | **Uno solo** |
| 2 | `secondary` | Acción alternativa real: Ver tabla de amortización, Generar nuevo código | Contorno, sin relleno | Los que hagan falta |
| 3 | `ghost` | Salida sin consecuencia: Cancelar, Cerrar, Volver | Sin contorno ni relleno, solo texto | Los que hagan falta |
| 4 | `destructive` | Borra o desactiva: Eliminar socio, Desactivar miembro, Suspender cuenta | Rojo, y siempre con confirmación previa | Uno |

El verde deja de ser un color de botón. Pasa a ser **color de estado**, para lo que ya está bien: ciclo vigente, crédito al día, saldo positivo, operación registrada.

### 2.3 Tokens

Hoy conviven dos juegos de tokens que no se hablan:

- `@theme` en `index.css` define `--color-primary_y`, `--color-secondary_g`, etc., que Tailwind expone como clases (`bg-primary_y`). Lo usan `Button` y `Field`.
- `:root` y `.dark` definen `--bg-surface`, `--text-primary`, etc., que solo se pueden leer con `style={{}}`. Lo usa todo lo demás.

Por eso `Button` no cambia con el modo oscuro igual que `Card`, y por eso `Field` necesita una prop `variant="dark" | "light"` que duplica lo que ya sabe `ThemeContext`.

**Acción:** un solo juego de tokens semánticos, declarados en `:root` y redefinidos en `.dark`, y expuestos a Tailwind en el mismo `@theme`. Nombres por función, no por color:

```
--color-accion-primaria      (hoy primary_y)
--color-accion-primaria-hover
--color-destructivo          (hoy danger_r)
--color-estado-ok            (hoy secondary_g)
--color-estado-alerta
--bg-base / --bg-surface / --bg-surface-2
--text-primary / --text-secondary / --text-muted
--border-base / --border-focus
```

Regla de oro para la migración: **ningún componente nuevo usa `style={{}}` para color**. Si un color no se puede expresar con una clase, falta un token.

### 2.4 Escalas de espaciado y tipografía

No hay escala. Hay `p-4`, `p-5`, `p-3`, `px-6 py-4`, `padding: "0 20px"`, `padding: "9px 14px"` conviviendo. Igual con los tamaños de texto: `text-xs`, `text-sm`, `13px`, `15px`, `10px`.

**Acción:** fijar y documentar una escala corta y prohibir valores fuera de ella.

- Espaciado: 4, 8, 12, 16, 24, 32, 48 px
- Radios: 8 px (controles), 12 px (tarjetas y modales)
- Texto: 12 (auxiliar), 14 (cuerpo), 16 (subtítulo), 20 (título de sección), 24 (título de página)

---

## 3. Componentes que faltan

Cada uno de estos existe hoy copiado dentro de las páginas. Son la causa directa de la inconsistencia.

| Componente | Reemplaza a | Dónde está duplicado hoy |
| --- | --- | --- |
| `PageShell` | El contenedor de cada página | Ver sección 4.1, es el origen del problema de alineación |
| `Modal` | Overlays escritos a mano | `AbonoModal`, `ConfirmarPagoModal`, `DonacionModal`, `TablaAmortizacion`, `AhorrosPage` |
| `Form` | Nada: no existe ningún `<form>` | Las 13 páginas |
| `Select` | `<select>` suelto con estilo propio | `ConfiguracionPage`, `CreditosPage`, `SociosPage` |
| `Textarea` | `<textarea>` suelto | `SociosPage`, `CreditosPage` |
| `DataTable` | Tablas escritas a mano | `SociosPage`, `CreditosPage`, `PagosPage`, `ReportesPage`, `TablaAmortizacion` |
| `EmptyState` | Bloques "aún no hay…" | 6 páginas, cada una con su ícono y su texto |
| `LoadingState` | `<p>Cargando…</p>` | 8 páginas, más `App.tsx` sin layout |
| `Badge` | Etiquetas de estado y de rol | `CajasPage`, `ConfiguracionPage`, `CreditosPage`, `PagosPage` |
| `InfoTip` | No existe | Ver sección 8 |
| `ConfirmDialog` | `confirm()` de `NotifContext` | Está parcialmente hecho, falta unificar su uso |

### 3.1 Primitivos que hay que corregir, no crear

**`Button`**

1. Variantes por prioridad, según la tabla 2.2.
2. Añadir `type?: "button" | "submit"`, con `"button"` por defecto. Sin esto, cuando los formularios existan, todo botón dentro de uno enviará el formulario sin querer.
3. Eliminar `onEnter` y el `onKeyPress`. Un `<button>` ya responde a Enter cuando tiene el foco; el problema real es que no hay formulario, y se resuelve en el formulario, no en el botón.
4. `onKeyPress` está obsoleto en React 19.
5. Añadir `fullWidth?: boolean`, hoy resuelto con `className` externo que el componente no acepta.
6. Quitar el `m-1` del estilo base: el margen lo decide quien coloca el botón, no el botón.

**`Field`**

1. Soportar `select`, `textarea`, `date` y `number`, o separarlo en `TextField`, `SelectField`, `TextareaField` sobre una base común.
2. Quitar la prop `variant` dark/light. El tema ya lo sabe `ThemeContext`.
3. Añadir `name` e `id`, hoy ausentes: sin ellos el `<label>` no está asociado al input y el navegador no puede autocompletar.
4. Añadir `onBlur` para validar al salir del campo, no solo al enviar.
5. Añadir `maxLength` e `inputMode`, necesarios para la cédula y el teléfono.

**`Card`**

Hoy solo sirve para métricas (`label` + `value` + `subtext`). Las páginas que necesitan una tarjeta contenedora vuelven a escribir el `div` con borde. Separar en dos: `StatCard` (lo actual) y `Panel` (contenedor genérico con título opcional).

---

## 4. Problemas de maquetación

### 4.1 La página de configuración se va a la izquierda

Causa exacta, en `ConfiguracionPage.tsx:235`:

```tsx
<div className="flex flex-col gap-6 max-w-2xl">
```

`max-w-2xl` limita el ancho pero **no hay `mx-auto`**, así que el bloque se pega al borde izquierdo del área de contenido, que es mucho más ancha. El mismo defecto está en:

- `AhorrosPage.tsx:173` — `max-w-2xl` sin centrar
- `CreditosPage.tsx:245` — `max-w-2xl` sin centrar
- `ProfilePage.tsx:144` — `max-w-xl` sin centrar

Y en cambio `DashboardPage`, `SociosPage` y `ReportesPage` usan rejillas a todo lo ancho. De ahí que unas pantallas se vean centradas y otras arrinconadas: no es un error de una página, es la ausencia de una regla.

**Acción:** `PageShell` con dos anchos declarados y centrado siempre.

```tsx
<PageShell titulo="Configuración" ancho="formulario">   // 640px centrado
<PageShell titulo="Dashboard"     ancho="completo">     // 1200px centrado
```

Ninguna página vuelve a escribir `max-w-*` ni `AppLayout` directamente.

### 4.2 Tres sistemas de estilo en el mismo árbol

- `Sidebar`, `TopBar` y `ChatbotFlotante`: 100 % objetos de estilo en línea, cero clases.
- `Field` y `Button`: 100 % clases Tailwind con tokens de marca.
- Todo lo demás: mezcla, hasta 53 bloques `style={{}}` en un solo archivo (`TablaAmortizacion`).

Además hay efectos de hover implementados mutando el DOM a mano, lo que no se puede mantener ni probar:

```tsx
// CajasPage.tsx:180
onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary_y)" }}
```

**Acción:** una sola convención, clases Tailwind sobre tokens semánticos. El `style={{}}` queda permitido solo para valores calculados en tiempo de ejecución, como el ancho de una barra de progreso.

### 4.3 Utilidades duplicadas

`Intl.NumberFormat` se declara en 6 archivos y `toLocaleDateString` en 6. Cada uno con sus propias opciones, así que el mismo monto se ve distinto según la pantalla.

**Acción:** `src/lib/format.ts` con `moneda()`, `fecha()`, `fechaHora()`, `porcentaje()`. Un solo lugar define que la moneda es USD y el formato de fecha es `dd/MM/yyyy`.

---

## 5. Flujos que hay que rehacer

### 5.1 Crear una caja

**Hoy:** en `CajasPage` se abre un formulario en línea con dos campos (nombre y descripción), se pulsa "Crear caja" y se navega a `/dashboard`. Si el contexto de caja todavía no se ha propagado, `RolRoute` lee `cajaActiva` como nulo, asume rol `socio` y redirige a `/ahorros`. Esa es la causa del salto inesperado que observaste.

Además el formulario **no pide fecha de fundación, mes de inicio de ciclo ni duración del ciclo**, que la historia HU004 del documento sí exige. Esos campos solo existen en Configuración, a donde el usuario nunca es llevado.

**Flujo nuevo, en cinco pasos:**

1. **Qué es una caja.** Pantalla previa, antes del formulario. Explica que una caja representa a una organización real, que su información no se comparte con ninguna otra y que quien la crea queda como coordinador, responsable de configurarla e invitar al resto. Es el instructivo que pidió la directora en la revisión del 30 de octubre.
2. **Políticas de uso y tratamiento de datos.** Aceptación obligatoria, con las cuatro secciones de la historia HU022: para qué existe el sistema, qué puede hacer según su rol, qué datos agregados conoce el ámbito de administración y qué no sale nunca de la caja.
3. **Datos de la caja.** Nombre, descripción (obligatoria, hoy marcada como opcional) y los tres campos de ciclo, cada uno con su texto de ayuda. La fecha de fundación admite fechas anteriores a hoy.
4. **Confirmación.** Resumen de lo que se acaba de crear: nombre, primer ciclo calculado, y la frase de que esta cuenta quedó como coordinadora de esta caja y de ninguna otra.
5. **Dashboard**, con una lista de siguientes pasos visible: registrar las fichas de socio e invitar al tesorero.

Implementar como asistente de pasos en `/cajas/nueva`, no como formulario en línea. El paso 3 reemplaza la configuración inicial que hoy queda huérfana en `/configuracion`.

### 5.2 Enter en los formularios

No es un defecto de login y registro: **no hay un solo `<form>` en el proyecto**. Afecta a las 13 páginas.

**Acción:** componente `Form` que envuelva en `<form onSubmit={...}>` y llame a `preventDefault()`, más `type="submit"` en el botón principal de cada formulario. Con eso Enter funciona en todas las pantallas a la vez, y de paso llegan gratis el autocompletado del navegador y el manejo de contraseñas.

Lista de formularios afectados: login, registro, recuperar contraseña, restablecer contraseña, crear caja, unirse con código, perfil, nuevo socio, abrir cuenta, depósito, retiro, nuevo crédito, pago, abono, configuración de periodo, generar invitación.

### 5.3 El enlace de registro

`Login.tsx:89` coloca "¿No tienes cuenta? Regístrate aquí" al pie de la pantalla, separado del formulario, en color verde. La observación del 30 de octubre pedía que estuviera debajo de "¿Olvidaste tu contraseña?". Sigue sin aplicarse.

### 5.4 Unirse con un código

`CajasPage.tsx:311` lo resuelve con un texto pequeño en color secundario. Debe ser un botón con el mismo peso visual que "Crear nueva caja", y debe indicar quién genera el código: el coordinador de la caja de destino. También debe ser alcanzable desde "Cambiar caja" en la barra lateral.

### 5.5 Errores de validación

En `Login.tsx` la misma variable `error` se pinta en el campo de correo y además se traduce a un mensaje distinto e inventado en el campo de contraseña ("Correo o contraseña incorrectos"). Son dos mensajes para un solo fallo.

**Acción:** un error general por formulario y errores por campo solo cuando el fallo es de ese campo.

---

## 6. Backend

### 6.1 La función de permisos está copiada seis veces

`verificarRol` aparece, idéntica, en `ahorros.routes.js`, `creditos.routes.js`, `pagos.routes.js`, `miembros.routes.js`, `reportes.routes.js` y `socios.routes.js`. El propio código lo admite: `// Helper de rol (misma lógica que en ahorros)`.

**Acción:** un middleware `requierePermiso('caja.configurar')` en `middlewares/permisos.middleware.js`, con una tabla única de permisos que sea exactamente la Tabla 1.1 del documento.

### 6.2 La jerarquía de roles contradice el documento

Tanto el backend como `RolRoute` usan una escalera:

```js
const jerarquia = { socio: 1, tesorero: 2, admin: 3 }
```

Una escalera significa que quien es admin puede todo lo que puede el tesorero. Pero la Tabla 1.1 del documento dice otra cosa:

| Permiso | Coordinador | Tesorero |
| --- | --- | --- |
| Configurar parámetros y ciclos | Sí | No |
| Registrar ahorros, créditos y pagos | **No** | Sí |

**Decidido el 11 de noviembre: el coordinador sí puede registrar movimientos.** El argumento es el del marco teórico: en cajas pequeñas una misma persona asume las dos funciones y el cargo de tesorería rota, así que negarle al coordinador las operaciones del tesorero describiría mal el dominio.

En consecuencia:

- **El documento ya está corregido.** Las dos filas en conflicto de la Tabla 1.1 pasan a Coordinador = Sí: "Registrar ahorros, créditos y pagos" y "Generar la distribución de intereses". Se añadió un párrafo al encuadre del alcance y una regla de negocio en la historia HU007 que dejan escrito que la inclusión es en un solo sentido: el coordinador puede hacer lo del tesorero, el tesorero no puede hacer lo del coordinador.
- **La escalera del código queda válida y se conserva.** `{socio:1, tesorero:2, admin:3}` expresa exactamente esa inclusión en un sentido, así que no hay que cambiar la semántica de permisos en ninguna ruta.
- **Lo que sí hay que hacer sigue en pie:** dejar de copiar `verificarRol` en seis archivos. El middleware único de la sección 6.1 implementa la misma escalera en un solo lugar, con los nombres nuevos de rol.

Las tres filas donde el coordinador sigue en No son de ámbito sistema, no de caja, y ahí la escalera no aplica porque el administrador del sistema no está en ella.

### 6.3 El aislamiento no es el que dice el documento

El documento afirma, en el marco teórico y en la historia HU004, que el aislamiento entre cajas se aplica con políticas de seguridad a nivel de fila y no depende de la interfaz.

En el código, **las once rutas usan `supabaseAdmin`, creado con `SUPABASE_SERVICE_KEY`**. Esa clave omite las políticas de fila por diseño. El aislamiento real lo producen los `.eq('caja_id', cajaId)` escritos a mano en cada consulta.

Funciona hoy, pero es frágil. Revisando las escrituras:

```js
// creditos.routes.js:177 y pagos.routes.js:170
.from('creditos').update({...}).eq('id', creditoId)    // sin .eq('caja_id', cajaId)
```

La protección depende de que una lectura anterior en el mismo manejador sí haya filtrado por caja. En los casos revisados la lectura previa existe, así que no hay una fuga abierta, pero basta que un manejador futuro omita ese paso para abrirla.

**Acción, en este orden:**

1. Añadir `.eq('caja_id', cajaId)` a toda escritura, no solo a las lecturas. Es barato y cierra la fragilidad.
2. Activar políticas de fila reales y pasar las rutas de datos a un cliente con el token del usuario, dejando `supabaseAdmin` solo para operaciones administrativas. Esto es lo que haría cierta la afirmación del documento.
3. Si por tiempo no se hace el punto 2, **corregir el documento** para que describa el aislamiento por filtro en la capa de servicio. Es preferible un documento exacto a uno aspiracional.

### 6.4 Otros puntos del backend

- No hay middleware de validación de entrada. Cada ruta valida a mano y de forma desigual.
- No hay `helmet` ni límite de peticiones.
- `server.js` imprime en consola la presencia de las claves al arrancar, y `config/paypal.js` imprime la longitud del secreto. Quitar ambos.
- `config/supabase.js` crea un segundo cliente con la clave de servicio que nadie usa. Eliminar el archivo.
- 316 líneas comentadas repartidas en las rutas, incluido un endpoint de pago completo comentado en `creditos.routes.js`. Borrarlas; para eso está el historial de Git.
- Indentación con tabuladores en `creditos.routes.js` y con espacios en el resto. Añadir Prettier y ESLint con una regla común, y pasarlo una vez a todo el repositorio.

---

## 7. Módulos que hay que quitar

El alcance del documento los excluye expresamente, y la directora los vería como funcionalidad no documentada si abre el repositorio.

| Qué | Archivos |
| --- | --- |
| Donaciones y PayPal | `backend/routes/donaciones.routes.js`, `backend/config/paypal.js`, el montaje en `server.js:42`, `frontend/src/components/DonacionModal.tsx`, el botón "Donar" en `TopBar.tsx` |
| Chatbot | `backend/routes/chatbot.routes.js`, el montaje en `server.js:43`, `frontend/src/components/ChatbotFlotante.tsx`, `frontend/src/api/chatbot.service.ts`, el render en `AppLayout.tsx` |

Dos observaciones adicionales:

- El botón "Donar" usa el color `danger_r`, el rojo reservado para acciones destructivas. Otro síntoma del problema de la sección 2.
- El texto de contexto del chatbot describe los roles con la nomenclatura antigua ("Administrador: controla toda la caja"). Si por alguna razón se conserva, hay que reescribirlo con la nomenclatura de la sección 9.

En el documento, declararlos como trabajo futuro en la sección 1.3 en lugar de eliminarlos en silencio.

---

## 8. Textos de ayuda

Pediste que conceptos clave tengan información explícita accesible desde un ícono. Es la respuesta directa a que la directora creara una caja sin saber qué estaba creando.

**Mecanismo:** componente `InfoTip`, un ícono de interrogación junto al título de la sección o a la etiqueta del campo. Al pulsarlo abre un panel corto con tres partes fijas: qué es, qué pasa cuando lo haces, y qué necesitas tener antes. No un tooltip al pasar el ratón, porque no funciona en teléfono.

Contenido mínimo a redactar:

| Concepto | Dónde aparece | Qué debe explicar |
| --- | --- | --- |
| Crear una caja | Asistente de creación, paso 1 | Que representa una organización real, que queda aislada de las demás y que quien la crea es su coordinador |
| Ciclo de la caja | Configuración y paso 3 del asistente | Que es el periodo entre cortes de cuentas, que al cerrarlo se reparten los intereses, y que la fecha de fundación puede ser anterior al registro |
| Código de invitación | Unirse a una caja y Configuración | Quién lo genera, cuánto dura y que el código determina el rol de ingreso |
| Crear un socio | Módulo Socios | Que es la ficha contable de la persona, que la registra el coordinador o el tesorero porque no todo socio tiene dispositivo, y que se vincula a una cuenta de usuario cuando el correo coincide |
| Abrir una cuenta de ahorro | Módulo Ahorros | Que es la libreta de un socio dentro de esta caja y que un socio puede tener más de una |
| Crear un crédito | Módulo Créditos | Que se otorga solo entre socios de la misma caja, qué significa el plazo y cómo se genera la tabla de amortización |
| Aprobar un crédito | Módulo Créditos | Que al aprobar se fijan las fechas, se desembolsa y ya no se puede editar |
| Abono y prepago | Modal de pagos | La diferencia entre pagar solo interés, solo capital y cuota completa |
| Distribución de intereses | Reportes | Los dos modelos de reparto, en partes iguales o proporcional al monto y al tiempo |
| Estado de la cuenta | Perfil y panel de administración | Los cuatro estados y qué significa cada motivo |
| Rol y membresía | Selector de cajas y perfil | Que el rol es por caja y que la misma cuenta puede tener roles distintos en cajas distintas |

Los textos salen del Marco Teórico del documento, así que el sistema y la tesis dirán lo mismo con las mismas palabras.

---

## 9. Coherencia con el documento de TIC

### 9.1 Nomenclatura

La revisión 5 cerró los nombres. El código usa los viejos en todas partes.

| En el documento | En el código hoy | Dónde |
| --- | --- | --- |
| Coordinador | `admin`, "Administrador", "Admin" | `CajaContext`, `RolRoute`, `Sidebar`, `CajasPage:14`, `ConfiguracionPage:34`, toda la base de datos |
| Administrador (ámbito sistema) | No existe | — |
| Tesorero | `tesorero` | Coincide |
| Socio (rol) | `socio` | Coincide |
| Ficha de socio | "socio" a secas | Módulo Socios |
| Estado de la cuenta | No existe | — |

El valor `admin` está en la columna `rol` de `miembros_caja`, así que el cambio necesita una migración de base de datos, no solo un reemplazo de texto. Conviene hacerlo en un solo paso y temprano: cuanto más código nuevo se escriba sobre `admin`, más caro sale.

La barra lateral además muestra el rol en crudo y en minúscula (`Sidebar.tsx:133` imprime `{rol}`, que sale como "admin"). Debe mostrar la etiqueta.

### 9.2 Funcionalidad del documento que no está en el código

| Historia | Estado |
| --- | --- |
| HU001 — contraseña de 8 caracteres con letras y números | **No.** `Register.tsx` valida 6 caracteres sin exigir combinación |
| HU001 — activación por correo | **No.** El comentario del código dice "como no requiere confirmación, loguea directo" |
| HU002 — enlace de registro bajo el de recuperación | **No.** Está al pie de la pantalla |
| HU004 — explicación previa y dos opciones con el mismo peso | **No** |
| HU004 — descripción obligatoria | **No.** Está marcada como opcional |
| HU004 — fecha de fundación, mes y duración al crear | **No.** Solo en Configuración |
| HU004 — pantalla de confirmación con siguientes pasos | **No** |
| HU004 — límite de cinco cajas por cuenta | **No** |
| HU016 — nombre de mínimo 6 caracteres, solo letras | Por verificar en `ProfilePage` |
| HU016 — teléfono de exactamente 10 dígitos | Por verificar en `ProfilePage` |
| HU019 y HU020 — panel del administrador del sistema | **No existe** |
| HU021 — acuerdo de confidencialidad | **No existe** |
| HU022 — políticas de uso de la caja | **No existe** |
| Figura 1.2 — estado de la cuenta visible | **No existe** |

### 9.3 Funcionalidad del código que no está en el documento

- Donaciones con PayPal y chatbot. Ver sección 7.
- Notificaciones en la barra superior: el ícono existe y no hace nada. O se implementa y se documenta, o se quita.
- `ChatbotFlotante` se renderiza en todas las pantallas desde `AppLayout`.

### 9.4 Permisos de ruta

`App.tsx` no protege `/configuracion`, `/creditos`, `/pagos` ni `/ahorros` con `RolRoute`. La barra lateral oculta los enlaces, pero escribir la dirección a mano entra igual. El backend sí verifica, así que no hay fuga de datos, pero la interfaz se rompe y la experiencia es mala. `/configuracion` además aparece en la barra lateral para el socio con `visible: true`.

### 9.5 El rol vive en localStorage

`CajaContext` guarda `{ id, nombre, descripcion, rol }` en localStorage y nunca lo vuelve a validar contra el servidor. Editando ese valor a mano, la interfaz muestra las pantallas de coordinador. No hay fuga porque el backend verifica cada petición, pero conviene revalidar el rol al seleccionar la caja y al recargar.

---

## 10. Revisión por página

| Página | Problemas detectados |
| --- | --- |
| `Login` | Sin `<form>`, Enter inactivo. Enlace de registro al pie y en verde. Doble mensaje para un solo error. Mezcla de clases y estilos en línea |
| `Register` | Sin `<form>`. Contraseña de 6 caracteres sin exigir letras y números. Sin verificación de correo. Sin indicador de fortaleza |
| `ForgotPassword` / `ResetPassword` | Sin `<form>`. Sin estado de carga ni confirmación visible |
| `CajasPage` | Flujo de creación sin instructivo ni políticas ni campos de ciclo. "Crear nueva caja" y "Cancelar" ambos en verde. "Únete aquí" como texto diminuto. Hover mutando el DOM. Llamada directa a `apiClient` saltándose el servicio. `console.log` en lugar de aviso al usuario. Etiqueta de rol "Administrador" |
| `DashboardPage` | Rejilla a todo lo ancho frente a otras páginas angostas. Formato de moneda propio. Sin lista de siguientes pasos para una caja recién creada |
| `SociosPage` | Formulario de 7 campos sin `<form>`. Sin validación de cédula ni de teléfono. Tabla escrita a mano. "Cancelar" en verde. Falta la explicación de qué es una ficha de socio y su vínculo por correo |
| `AhorrosPage` | `max-w-2xl` sin centrar. Modal propio en lugar de componente. Formato de fecha propio. Única página que el socio ve, sin adaptarse a ese rol |
| `CreditosPage` | 591 líneas. `max-w-2xl` sin centrar. 50 bloques de estilo en línea. Cinco botones de acción todos en verde. Sin explicación de plazo ni de amortización |
| `PagosPage` | Tabla a mano. Formato de moneda propio. Sin confirmación visible tras registrar |
| `ReportesPage` | 584 líneas. `toFixed(2)` seis veces en lugar de formato de moneda. Rejilla propia. Sin estado vacío cuando el ciclo no está configurado |
| `ConfiguracionPage` | 684 líneas, la más larga. `max-w-2xl` sin centrar: **el defecto de alineación que reportaste**. Sin protección de rol en la ruta. Visible para el socio. Mezcla `apiClient` directo con servicios. Tres secciones que deberían ser tres componentes |
| `ProfilePage` | `max-w-xl` sin centrar. Verificar validaciones de nombre y teléfono de HU016 |

---

## 11. Historias de usuario para la revisión

Lista contra la que revisar el sistema completo cuando termine la refactorización. Cada una se da por cumplida solo si sus criterios se verifican en pantalla.

### Transversales

**HT01 — Teclado.** Como usuario, quiero completar cualquier formulario con el teclado.
- Enter envía el formulario desde cualquier campo.
- Tab recorre los campos en el orden visual.
- El botón principal es el que se activa con Enter.
- Escape cierra cualquier modal.

**HT02 — Jerarquía visual.** Como usuario, quiero distinguir de un vistazo la acción principal.
- Cada pantalla tiene una sola acción de nivel 1.
- Cancelar y Cerrar nunca llevan relleno de color.
- El rojo aparece solo en acciones que borran o desactivan, y siempre pide confirmación.
- El verde no aparece en ningún botón, solo en estados.

**HT03 — Consistencia de página.** Como usuario, quiero que todas las pantallas se vean de la misma familia.
- Toda página usa `PageShell` y uno de los dos anchos definidos.
- Ningún contenido queda pegado al borde izquierdo.
- Montos y fechas se ven idénticos en todas las pantallas.
- Cargando, vacío y error usan el mismo componente en todas partes.

**HT04 — Ayuda en contexto.** Como usuario sin formación financiera, quiero entender qué significa cada acción antes de ejecutarla.
- Los once conceptos de la sección 8 tienen `InfoTip`.
- El panel abre con pulsación, no con el ratón encima.
- El texto coincide con el Marco Teórico del documento.

**HT05 — Modo oscuro.** Como usuario, quiero que el modo oscuro se aplique completo.
- Ningún componente queda con colores fijos.
- El contraste de texto sobre fondo cumple el mínimo de accesibilidad en ambos modos.

### Cuenta y acceso

**HU-A01 — Crear una cuenta.** Contraseña de 8 caracteres con letras y números, indicador de fortaleza, y la cuenta no habilita el ingreso hasta confirmar el correo.

**HU-A02 — Iniciar sesión.** Enter funciona, el enlace de registro está bajo el de recuperación, y un solo mensaje por fallo.

**HU-A03 — Estado de la cuenta.** El perfil muestra el estado y su motivo. Una cuenta sin caja se ve como Inactiva, no en blanco.

### Caja

**HU-C01 — Crear una caja con conocimiento.** Los cinco pasos de la sección 5.1, en ese orden, terminando en el dashboard con los siguientes pasos visibles.

**HU-C02 — Unirse con un código.** Botón con el mismo peso que crear caja, indicación de quién genera el código, y acceso desde "Cambiar caja".

**HU-C03 — Configurar el periodo.** Contenido centrado, los tres campos con ayuda, y el ciclo calculado como fecha de inicio más la duración en meses.

**HU-C04 — Cambiar de caja.** Desde la barra lateral, con el rol de cada caja visible y con su etiqueta correcta.

### Operación

**HU-O01 — Registrar una ficha de socio.** Validación de cédula y de teléfono, explicación del vínculo por correo, y confirmación visible.

**HU-O02 — Abrir una cuenta de ahorro.** Desde un modal del sistema de diseño, con explicación de qué es una cuenta.

**HU-O03 — Registrar depósito o retiro.** Confirmación antes de guardar, saldo actualizado a la vista, y formato de moneda unificado.

**HU-O04 — Solicitar y aprobar un crédito.** Explicación del plazo y de la amortización, confirmación antes de aprobar, y aviso de que tras aprobar no se puede editar.

**HU-O05 — Registrar un pago.** Las tres modalidades explicadas en el momento de elegir, con desglose de capital e interés.

### Administración del sistema

**HU-S01 — Panel del administrador.** Listado de cajas y de cuentas con conteos de socios y de créditos, sin montos.

**HU-S02 — Bloquear y restablecer.** Con motivo obligatorio y registro en bitácora.

**HU-S03 — Acuerdo de confidencialidad.** Aceptación antes de abrir el panel, con versión y fecha.

**HU-S04 — Políticas de uso.** Aceptación al entrar a cada caja, con las cuatro secciones.

---

## 12. Orden de trabajo

Cada etapa deja el sistema funcionando. No conviene saltarse el orden: las etapas 1 y 2 son las que evitan volver a parchar.

**Etapa 1 — Fundaciones.** Tokens unificados. `Button` con las cuatro variantes por prioridad. `Field` con select, textarea y date. `PageShell`, `Modal`, `Form`, `EmptyState`, `LoadingState`, `Badge`. `lib/format.ts`. Prettier y ESLint sobre todo el repositorio.

**Etapa 2 — Limpieza.** Quitar donaciones, PayPal y chatbot. Borrar las 316 líneas comentadas y `config/supabase.js`. Quitar los `console.log` de claves. Migración de `admin` a `coordinador`. Middleware único de permisos y `.eq('caja_id')` en toda escritura.

**Etapa 3 — Migración de pantallas.** Una página por vez a `PageShell` y a los primitivos nuevos. Orden sugerido por impacto: Configuración, Créditos, Reportes, Ahorros, Socios, Dashboard, Pagos, Perfil, y al final las cuatro de autenticación. Antes de migrar la primera página que los necesite, construir los componentes de la sección 3 que no entraron en la Etapa 1: `DataTable`, la división de `Card` en `StatCard` y `Panel`, y la unificación de `ConfirmDialog` (decidido el 11 de noviembre).

**Etapa 4 — Flujos.** Asistente de creación de caja. Verificación por correo y política de contraseña. Protección de rol en todas las rutas. Revalidación del rol contra el servidor.

**Etapa 5 — Lo nuevo del documento.** `InfoTip` con los once textos. Panel del administrador del sistema. Acuerdo de confidencialidad y políticas de uso. Estado de la cuenta.

**Etapa 6 — Verificación.** Recorrer las historias de la sección 11 una por una y dejar constancia del resultado. Esa lista es la evidencia de las pruebas de usabilidad que pide el objetivo específico 3 del documento.

---

## 13. Decisiones que no puedo tomar por ti

1. ~~La jerarquía de roles de la sección 6.2.~~ **Resuelto el 11 de noviembre:** el coordinador sí registra movimientos. El documento ya está corregido y la escalera del código se conserva.
2. **El aislamiento de la sección 6.3.** Implementar políticas de fila reales o corregir el documento para que describa lo que el código hace.
3. **El límite de cinco cajas por cuenta.** Está en el documento y no en el código. Implementarlo o quitarlo del documento.
4. **Las notificaciones.** Implementar el ícono de la barra superior o retirarlo.
5. **"Bloqueado" o "Suspendido".** Las historias HU019 y HU020 dicen suspender; el modelo de estados dice bloqueado. Hay que quedarse con uno en el documento, en el código y en la interfaz.
