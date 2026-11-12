# Estado del proyecto — DOMUS Web

Documento vivo. Se actualiza cada vez que se termina una tarea, se toma una decisión o se encuentra algo nuevo.

- **Última actualización:** 12 de noviembre de 2026
- **Etapa actual:** Etapa 3, Migración de pantallas: en curso (0 de 15). Las etapas 1 y 2 están fusionadas en `main` (`9a22d71`, `e34de4f`), sin subir a GitHub. **Falta subir `main` y ejecutar la migración `001` en Supabase** (pasos en Decisiones).
- **Rama de trabajo:** `etapa-3`, abierta desde `main` en `e34de4f`. Las etapas 1 y 2 se trabajaron en `etapa-1` y `etapa-2` y se fusionaron con `--no-ff`.
- **Fuente de verdad:** `docs/ESPECIFICACIONES.md` (sección 12 para el orden de trabajo)
- **Último commit de referencia:** `e34de4f`

---

## Etapas (sección 12)

| Etapa | Nombre | Estado |
| --- | --- | --- |
| 1 | Fundaciones | Hecha: 15/15, fusionada en `main` |
| 2 | Limpieza | Hecha: 10/10, fusionada en `main`. Migración de base pendiente de ejecutar |
| 3 | Migración de pantallas | En curso: 0/15 |
| 4 | Flujos | Pendiente |
| 5 | Lo nuevo del documento | Pendiente |
| 6 | Verificación | Pendiente |

---

## Etapa 1: tareas

Leyenda: ⬜ pendiente · 🔄 en curso · ✅ hecha (con commit)

| # | Tarea | Depende de | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | Prettier y ESLint en todo el repositorio, en un commit solo de formato | — | ✅ | `b64c07f` herramientas, `3699443` formato |
| T2 | Tokens semánticos únicos en `:root` y `.dark`, expuestos en `@theme`, con alias de los nombres viejos | T1 | ✅ | `aa9fc24` |
| T3 | Verificar contraste AA y oscurecer el naranja de marca para usar texto blanco | T2 | ✅ | `7cd1f4d` |
| T4 | Documentar la escala de espaciado, texto y radios (equivalencias con Tailwind) | T2 | ✅ | `0d06d1e` |
| T5 | `src/lib/format.ts`: `moneda`, `fecha`, `fechaHora`, `porcentaje` | T1 | ✅ | `d6e79eb` |
| T6 | `Button`: variantes `primary`, `secondary`, `ghost`, `destructive`; `type`, `fullWidth`; sin `onEnter` ni `m-1` | T2 | ✅ | `e702fa9` |
| T7 | `FieldBase`: label asociado con `useId`, colores por token, sin la prop `variant` | T2 | ✅ | `c515aaf` |
| T8 | `TextField` (incluye date y number); `Field` queda como alias | T7 | ✅ | `29bb919` |
| T9 | `SelectField` y `TextareaField` | T7 | ✅ | `118967e` |
| T10 | `Form`: `preventDefault`, envío con Enter, error general | T6 | ✅ | `30b5c23` |
| T11 | `PageShell`: anchos `formulario` (640 px) y `completo` (1200 px), siempre centrado | T2 | ✅ | `e7f9730` |
| T12 | `Modal`: Escape, clic afuera, foco atrapado, `aria-modal` | T2 | ✅ | `1394d95` |
| T13 | `LoadingState` y `EmptyState` | T2 | ✅ | `01c40a6` |
| T14 | `Badge`: tonos `ok`, `alerta`, `destructivo`, `neutral` | T2 | ✅ | `60ff35d` |
| T15 | Página de muestra solo para desarrollo (`/dev/componentes`), en modo claro y oscuro | T6–T14 | ✅ | `efb5891` |

Cada tarea se cierra con `npm run build`, `npm run lint` y commit (CLAUDE.md).

---

## Etapa 2: tareas

Rama `etapa-2`. Alcance de §12: quitar donaciones, PayPal y chatbot; borrar el código comentado y `config/supabase.js`; quitar los `console.log` de claves; migrar `admin` a `coordinador`; middleware único de permisos y `.eq('caja_id')` en toda escritura. Se suman los hallazgos de la Etapa 1 asignados a esta etapa.

| # | Tarea | Depende de | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | Quitar donaciones y PayPal: ruta, `config/paypal.js`, montaje, `DonacionModal`, botón "Donar", script de PayPal en `index.html`, variables del README | — | ✅ | `8c5d48a` |
| T2 | Quitar el chatbot: ruta, montaje, `ChatbotFlotante`, `chatbot.service.ts`, render en `AppLayout`, variable del README | — | ✅ | `c65a8dc` |
| T3 | Quitar los archivos de la plantilla de Vite (`favicon.svg`, `icons.svg`, `hero.png`, `react.svg`, `vite.svg`, `frontend/README.md`) | — | ✅ | `bc5cbc7` |
| T4 | Quitar los `console.log` de claves y de depuración; reemplazar `config/supabase.js` y borrarlo | — | ✅ | `e6c9b65` |
| T5 | Borrar el código comentado de las rutas del backend | T4 | ✅ | `bac67b4` |
| T6 | Ruta `/resumen` duplicada y variables sin usar (lint del backend en cero); revisar `montoCapital` en pagos | T5 | ✅ | `6f51f35` |
| T7 | Fecha local de Ecuador en el backend en lugar de `toISOString()` | T5 | ✅ | `55f114a` |
| T8 | Middleware único `requierePermiso` con la tabla de permisos; se borran las copias de `verificarRol` | T5 | ✅ | `dd80830` |
| T9 | `.eq('caja_id', cajaId)` en toda escritura | T8 | ✅ | `74c7323` |
| T10 | Migración de `admin` a `coordinador`: base de datos, backend y frontend | T8 | ✅ Código. SQL escrito, **sin ejecutar** | `1aebb13` |

---

## Etapa 3: tareas

Rama `etapa-3`. Alcance de §12: cada página a `PageShell` y a los primitivos nuevos, en el orden Configuración, Créditos, Reportes, Ahorros, Socios, Dashboard, Pagos, Perfil y las cuatro de autenticación. Antes, los componentes de §3 que no entraron en la Etapa 1. Cada página migrada resuelve sus hallazgos asignados a la Etapa 3 (fechas, `<select>`, overlays, cargando y vacío, `Badge`, variantes de botón, valores fuera de escala). Los flujos nuevos (asistente de caja, contraseña, rutas) siguen en la Etapa 4, y `InfoTip` en la 5.

| # | Tarea | Depende de | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | `DataTable`: columnas declaradas, alineación, primera columna fija, pie de totales, cargando y vacío | — | ⬜ | |
| T2 | `Card` se divide en `StatCard` y `Panel` | — | ⬜ | |
| T3 | `ConfirmDialog` sobre `Modal`; `confirm()` de `NotifContext` lo usa, y el `window.confirm` de Socios pasa a él | — | ⬜ | |
| T4 | Marco de la aplicación: `Sidebar`, `TopBar` y `AppLayout` a clases sobre tokens | — | ⬜ | |
| T5 | Configuración, en tres componentes de sección | T1–T4 | ⬜ | |
| T6 | Créditos, con `TablaAmortizacion` y `AbonoModal` sobre `Modal` | T1–T4 | ⬜ | |
| T7 | Reportes, incluidos los colores de los PDF | T1–T4 | ⬜ | |
| T8 | Ahorros | T1–T4 | ⬜ | |
| T9 | Socios | T1–T4 | ⬜ | |
| T10 | Dashboard | T1–T4 | ⬜ | |
| T11 | Pagos, con `ConfirmarPagoModal` sobre `Modal` | T1–T4 | ⬜ | |
| T12 | Perfil | T1–T4 | ⬜ | |
| T13 | Cajas (solo la migración visual; el asistente de creación es Etapa 4) | T1–T4 | ⬜ | |
| T14 | Las cuatro de autenticación, y `lang="es"` en `index.html` | T1–T4 | ⬜ | |
| T15 | Cierre: borrar los alias de color, `Field.tsx` y `Card.tsx`; lint del frontend en cero | T5–T14 | ⬜ | |

---

## Decisiones tomadas

| Fecha | Decisión | Dónde quedó escrita |
| --- | --- | --- |
| 12 nov 2026 | Etapa 3 en 15 tareas: primero los componentes que faltan y el marco (T1–T4), después una página por tarea en el orden de §12, y un cierre que borra lo viejo. Se suman dos tareas que §12 no nombra: el marco (`Sidebar` y `TopBar` son 100 % estilos en línea, §4.2) y `CajasPage`, que no está en la lista | Este documento |
| 11 nov 2026 | Etapa 2 en 10 tareas, en la rama `etapa-2`. Primero lo que solo borra (T1–T5), después lo que cambia lógica (T6–T9) y al final la migración de rol (T10), que toca la base de datos | Este documento |
| 11 nov 2026 | `config/supabase.js` no estaba sin usar, como dice §6.4: lo importaban `auth.routes.js` y `profile.routes.js`. Auth pasa a `config/supabaseAuth.js` (clave anon, sin sesión persistente) y perfiles a `supabaseAdmin`. Un cliente que hace `signInWithPassword` guarda esa sesión en memoria y sus consultas siguientes salen con el token de ese usuario, así que el cliente de auth nunca se usa para tablas | `backend/config/supabaseAuth.js` |
| 11 nov 2026 | Se quita `POST /api/auth/test-email`: era de prueba, no pedía sesión y permitía mandar correos de recuperación a cualquier dirección. El frontend no lo usaba | `backend/routes/auth.routes.js` |
| 11 nov 2026 | El resumen de caja devuelve 500 si alguna consulta falla, en vez de mostrar ceros. Antes el error solo se imprimía en consola | `backend/routes/cajas.routes.js` |
| 11 nov 2026 | Las "316 líneas comentadas" de §6.4 eran casi todas comentarios que explican el código y se conservan. Código comentado de verdad solo había uno: el endpoint de pago de `creditos.routes.js` (58 líneas), más su método y tipo en el frontend y restos en `Sidebar` y `ReportesPage` | Este documento |
| 11 nov 2026 | `montoCapital` en `/abono` no era un error de cálculo: el `0` inicial se sobrescribía en las dos ramas del `if`. Se reescribió sin cambiar el resultado (comprobado con 5 casos). Se cierra el hallazgo | `backend/routes/pagos.routes.js` |
| 11 nov 2026 | Zona horaria: `server.js` fija `process.env.TZ = "America/Guayaquil"` antes de todo, y `utils/fechas.js` da `fechaLocal()` y `leerFecha()`. Se eligió fijar la zona del proceso porque `amortizacion.js` y `ciclos.js` ya calculan con los métodos locales de `Date`, que en Render daban la hora UTC | `backend/utils/fechas.js` |
| 11 nov 2026 | La distribución de intereses asigna cada depósito o retiro al mes de Ecuador, no al mes UTC: un depósito del 31 a las 21:00 contaba en el mes siguiente | `backend/utils/reportes.js` |
| 11 nov 2026 | `calcularCiclos` compara fechas `YYYY-MM-DD` en lugar de instantes. Antes comparaba la medianoche del último día con la hora actual y daba el ciclo por cerrado durante todo su último día | `backend/utils/ciclos.js` |
| 11 nov 2026 | Tabla de permisos (T8). La Tabla 1.1 completa no está en el repositorio, así que la tabla se armó con el rol mínimo que ya exigía cada ruta, como pide §6.2 (la escalera se conserva). Permisos: `caja.ver` (socio); `socios.gestionar`, `movimientos.registrar`, `creditos.aprobar`, `reportes.generar` (tesorero); `caja.configurar`, `miembros.gestionar`, `socios.eliminar`, `cuentas.cambiar_estado`, `creditos.cambiar_estado` (admin). Comprobado: las 35 rutas dejan pasar exactamente los mismos roles que antes (175 casos con un Supabase simulado) | `backend/middlewares/permisos.middleware.js` |
| 11 nov 2026 | Había siete copias de `verificarRol`, no seis (§6.1 no cuenta la de `cajas.routes.js`), más dos chequeos escritos a mano en el resumen y la edición de la caja. Todo pasa al middleware | `backend/middlewares/permisos.middleware.js` |
| 11 nov 2026 | **Un rol desconocido ahora se rechaza.** La comparación vieja `jerarquia[rol] < jerarquia[minimo]` da `undefined < 3`, que es `false`, así que un rol fuera de la tabla pasaba todas las verificaciones. Importa para T10: si la base pasa a `coordinador` antes que el código, con la versión vieja cualquier rol raro tenía acceso total; con la nueva queda sin acceso. `RolRoute` del frontend tiene el mismo patrón (se corrige en T10) | `backend/middlewares/permisos.middleware.js` |
| 11 nov 2026 | Mensajes de 403 unificados: "Sin acceso a esta caja" (no es miembro) y "Tu rol no permite esta acción". El frontend no dependía de los textos viejos | `backend/API.md` |
| 11 nov 2026 | T9: ocho `update` sin `caja_id` (depósito, retiro, aprobar crédito, pago, prepago, abono, y socio e invitación en `/unirse`). Los `insert` ya lo llevaban. Los `update` sobre la tabla `cajas` filtran por su `id`, que es la caja misma | `backend/routes/` |
| 12 nov 2026 | Esquema de Supabase revisado con acceso de solo lectura. `rol` es el enum `rol_caja` (`admin`, `tesorero`, `socio`), usado por `miembros_caja` (6 coordinadores, 2 socios) e `invitaciones_caja` (3 invitaciones de socio, todas usadas). Ninguna política, función, trigger ni vista menciona el valor | Este documento |
| 12 nov 2026 | La migración es `alter type public.rol_caja rename value 'admin' to 'coordinador'`: cambia las filas existentes sin copiarlas y se deshace con la sentencia inversa. Queda en `backend/migraciones/001_admin_a_coordinador.sql`. La ejecuta el usuario en el editor SQL, en el mismo momento en que despliega este backend: el backend viejo inserta `'admin'` al crear una caja, y el nuevo no reconoce `'admin'` | `backend/migraciones/001_admin_a_coordinador.sql` |
| 12 nov 2026 | **Despliegue de la Etapa 2: hay que desplegar backend y frontend, no solo el backend.** Con la base ya migrada, el frontend viejo deja en blanco "Mis cajas" y Configuración para los coordinadores (`rolConfig["coordinador"]` no existe), y el backend viejo no puede crear cajas. Orden más seguro: subir `main`, esperar a que terminen Render y Netlify, y entonces ejecutar el SQL. Mientras tanto, los coordinadores solo tienen permisos de socio, pero nada se rompe | Este documento |
| 12 nov 2026 | Frontend: `src/lib/roles.ts` es el único lugar con el tipo `RolCaja`, la escalera, las etiquetas ("Coordinador") y `normalizarRol()`. `RolRoute` usa `tieneRol()`, que rechaza roles desconocidos (antes tenía el mismo fallo que el backend). La barra lateral muestra la etiqueta y no el valor en crudo. `CajaContext` traduce el `admin` que haya quedado en el localStorage y descarta la caja guardada si el rol no es válido | `frontend/src/lib/roles.ts` |
| 12 nov 2026 | `POST /miembros/invitaciones` valida `rolInvitado`; antes un valor fuera del enum daba un 500 de la base | `backend/routes/miembros.routes.js` |
| 12 nov 2026 | `fecha_pago` se manda desde el backend con `fechaLocal()`. Confirmado en la base: el valor por defecto es `CURRENT_DATE` y la base está en UTC | `backend/routes/pagos.routes.js` |
| 11 nov 2026 | Los toasts bajan a 24 px del borde: estaban a 90 px para no tapar el botón del chatbot | `frontend/src/context/NotifContext.tsx` |
| 11 nov 2026 | El coordinador sí registra movimientos; se conserva la escalera `socio < tesorero < admin` | Especificaciones §6.2 y §13 |
| 11 nov 2026 | Naranja de marca más oscuro con texto blanco, para cumplir AA (hoy blanco sobre `#DD9A4C` da 2,4:1) | Este documento, tarea T3 |
| 11 nov 2026 | `DataTable`, `StatCard`/`Panel` y `ConfirmDialog` pasan a la Etapa 3 | Especificaciones §12, Etapa 3 |
| 11 nov 2026 | Prettier se pasa al inicio de la Etapa 1 (T1), no al final, para que los diffs de las demás tareas queden limpios | Este documento |
| 11 nov 2026 | Se hace una página de muestra de componentes solo para desarrollo (T15) | Este documento |
| 11 nov 2026 | Un solo estilo Prettier para todo el repositorio: sin punto y coma, comillas dobles, 2 espacios, ancho 100. Los `.md` no se formatean | `.prettierrc.json`, `.prettierignore` |
| 11 nov 2026 | Tokens: los colores de acción y estado (`--color-*`) van en `@theme static` y se redefinen en `.dark`; superficies, texto y bordes (`--bg-*`, `--text-*`, `--border-*`) van en `:root`/`.dark` y se exponen con `@theme inline` en los espacios de Tailwind `--background-color-*`, `--text-color-*`, `--border-color-*`, `--ring-color-*`, `--outline-color-*`. Así las clases quedan cortas: `bg-surface`, `text-muted`, `border-focus`, `ring-focus` | `frontend/src/index.css` |
| 11 nov 2026 | Tokens añadidos a la lista de §2.3 porque los primitivos los necesitan: `--color-destructivo-hover` (botón destructivo) y `--color-sobre-accion` (texto sobre el naranja, blanco). `--border-focus` apunta a la acción primaria | `frontend/src/index.css` |
| 11 nov 2026 | Los alias viejos (`primary_y`, `secondary_g`, `danger_r`, `blk_1`, `blk_2`, `secondary_wt`) y `--sidebar-bg`/`--sidebar-text` se conservan hasta terminar la Etapa 3. `secondary_gh`, `blk_*` y `secondary_wt` siguen con valor fijo porque no tienen equivalente semántico | `frontend/src/index.css` |
| 11 nov 2026 | Paleta AA (T3). Claro: acción `#a35800` (hover `#8c4b00`), destructivo `#bc4227` (`#a23921`), ok `#47772a`, alerta `#8a6500`, text-secondary `#555555`, text-muted `#6b6b6b`. Oscuro: acción `#dd9a4c` (hover `#e6ad6a`), destructivo `#df7b64` (`#e4907e`), ok `#6ab23e`, alerta `#d4a72c`, text-secondary `#bdbdbd`, text-muted `#979797`. 60 combinaciones medidas, mínimo 4,61:1 | `frontend/src/index.css` |
| 11 nov 2026 | En modo oscuro el texto sobre los rellenos es oscuro (`--color-sobre-accion: #1a1a1a`), no blanco. Ningún naranja sirve a la vez para llevar texto blanco encima y para leerse como texto sobre fondo oscuro, así que en oscuro el relleno se aclara y el texto se oscurece. La decisión de "texto blanco" queda para el modo claro | `frontend/src/index.css` |
| 11 nov 2026 | El hover oscurece en modo claro y aclara en modo oscuro (antes aclaraba siempre, y eso bajaba el contraste) | `frontend/src/index.css` |
| 11 nov 2026 | Alerta pasa a un ámbar más amarillo (tono 44°) para no confundirse con la acción primaria (tono 32°) | `frontend/src/index.css` |
| 11 nov 2026 | `text-muted` también tiene que cumplir 4,5:1 porque se usa para texto informativo. Para que la jerarquía no se pierda, `text-secondary` se oscureció en claro y se aclaró en oscuro | `frontend/src/index.css` |
| 11 nov 2026 | El sistema de diseño se documenta en `docs/SISTEMA_DE_DISENO.md`: clases por función, escalas y excepciones. `index.css` remite a ese archivo | `docs/SISTEMA_DE_DISENO.md` |
| 11 nov 2026 | Las escalas se usan con las clases normales de Tailwind (`p-4`, `text-sm`, `rounded-xl`), sin tokens nuevos. Los valores de la escala ya coinciden con los de Tailwind | `docs/SISTEMA_DE_DISENO.md` |
| 11 nov 2026 | Excepciones a la escala: anchos y altos libres; el hueco del ícono dentro de un campo (`pl-9`) lo resuelve `FieldBase`; `rounded-full` solo para elementos circulares o en píldora (avatares, puntos, `Badge`); los PDF de jsPDF tienen sus propios tamaños | `docs/SISTEMA_DE_DISENO.md` |
| 11 nov 2026 | Peso de letra provisional, porque las especificaciones no lo fijan: `font-normal` cuerpo, `font-medium` etiquetas y botones, `font-semibold` títulos | `docs/SISTEMA_DE_DISENO.md` |
| 11 nov 2026 | Formato (T5): configuración regional `es-EC`, que es la que ya usaban todas las páginas. Moneda `$1.234,50`; fecha `11/11/2026`; fecha y hora `11/11/2026 17:05` (24 h, hora local de quien mira); porcentaje `12,50%` | `frontend/src/lib/format.ts` |
| 11 nov 2026 | `porcentaje()` recibe puntos porcentuales (12.5, como `tasa_interes` en la base), no fracciones. Tiene un segundo parámetro de decimales porque Reportes muestra 4 | `frontend/src/lib/format.ts` |
| 11 nov 2026 | Las cuatro funciones devuelven "—" si el valor falta o no es válido, como ya hacía Reportes. Una fecha imposible (`2026-02-30`) también da "—" | `frontend/src/lib/format.ts` |
| 11 nov 2026 | No se agregó un framework de pruebas: las funciones se probaron con un guion temporal en tres zonas horarias. Si hace falta, se decide en la Etapa 6 | Este documento |
| 11 nov 2026 | `Button` (T6): `secondary` es contorno y texto naranja de acción; `ghost` es texto secundario que pasa a principal al pasar el cursor; las cuatro variantes miden lo mismo (borde transparente en las que no tienen contorno). El hover solo aplica si el botón está habilitado | `frontend/src/components/Button.tsx` |
| 11 nov 2026 | `Button` en carga: muestra un spinner en lugar del ícono y conserva el texto, en vez de cambiarlo por "Cargando…", para que el botón no cambie de ancho. Marca `aria-busy` | `frontend/src/components/Button.tsx` |
| 11 nov 2026 | `Button`: el ícono va antes del texto (antes iba después) | `frontend/src/components/Button.tsx` |
| 11 nov 2026 | En T6 las páginas solo se tocaron donde dejaban de compilar o de verse bien (`danger` → `destructive`, sin `onEnter`, un `gap-3` en Reportes). Reasignar cada botón a su variante correcta es migración de páginas y se hace en la Etapa 3 | Este documento, Hallazgos |
| 11 nov 2026 | Nuevo token `--border-control` (`#878782` claro, `#797974` oscuro) para el borde de los campos: 3:1 contra las tres superficies (WCAG 1.4.11). `--border-base` queda como borde decorativo | `frontend/src/index.css` |
| 11 nov 2026 | `FieldBase` le pasa el control por una función hija (`{(control) => <input {...control} />}`), así `TextField`, `SelectField` y `TextareaField` comparten etiqueta, ayuda, error e ícono sin repetirlos | `frontend/src/components/FieldBase.tsx` |
| 11 nov 2026 | Obligatorio se marca con `aria-required` y no con `required`, para que el navegador no muestre sus propios globos de validación cuando exista `Form` (T10). La validación la hace la aplicación | `frontend/src/components/FieldBase.tsx` |
| 11 nov 2026 | Los campos tienen fondo `bg-surface` en los dos modos y se distinguen por el borde. Se quitaron sus márgenes propios (`mb-1`, `mt-1`): el espacio lo pone el contenedor | `frontend/src/components/FieldBase.tsx` |
| 11 nov 2026 | `Field` se reescribió sobre `FieldBase` con la misma API (sin `variant` ni `status`, que nadie usaba; se agrega `disabled`), para no tocar las 29 llamadas | `frontend/src/components/Field.tsx` |
| 11 nov 2026 | `TextField` acepta solo `text`, `email`, `password`, `tel`, `number`, `date` y `search`. Las 29 llamadas actuales ya usan esos valores | `frontend/src/components/TextField.tsx` |
| 11 nov 2026 | Para cédula y teléfono se usará `type="text"` con `inputMode="numeric"` y `maxLength`, no `type="number"`: así sale el teclado numérico y no se pierden los ceros a la izquierda | `frontend/src/components/TextField.tsx` |
| 11 nov 2026 | `color-scheme: light` en `:root` y `dark` en `.dark`, para que el calendario, las flechas de número y las barras de scroll nativas sigan el modo | `frontend/src/index.css` |
| 11 nov 2026 | `Field.tsx` queda como una reexportación de `TextField`. Se borra cuando la Etapa 3 termine de migrar las páginas | `frontend/src/components/Field.tsx` |
| 11 nov 2026 | `SelectField` recibe `options` como arreglo `{ value, label }` con valores de texto; la página convierte a número si lo necesita. `placeholder` crea una primera opción vacía, deshabilitada y atenuada. Una opción "Todos" de un filtro va en `options`, no como placeholder | `frontend/src/components/SelectField.tsx` |
| 11 nov 2026 | `SelectField` reemplaza la flecha nativa por un chevron en el lugar del ícono de `FieldBase`, para que se vea igual en todos los navegadores | `frontend/src/components/SelectField.tsx` |
| 11 nov 2026 | `TextareaField`: 3 líneas por defecto, solo se agranda hacia abajo, y con `maxLength` muestra un contador "n / máximo" (sin anunciarlo en cada tecla al lector de pantalla) | `frontend/src/components/TextareaField.tsx` |
| 11 nov 2026 | `Form` fija el orden: campos, error general, acciones (prop `actions`, en fila con `gap-3`). Los campos van en columna con `gap-4` (16 px, la separación entre campos de §2 de `SISTEMA_DE_DISENO.md`) | `frontend/src/components/Form.tsx` |
| 11 nov 2026 | `Form` usa `noValidate`, en línea con `aria-required` de T7: valida la aplicación, no el navegador | `frontend/src/components/Form.tsx` |
| 11 nov 2026 | `Form` ignora un segundo envío mientras el primero no termina (si `onSubmit` devuelve una promesa). Evita depósitos o pagos duplicados por pulsar Enter dos veces | `frontend/src/components/Form.tsx` |
| 11 nov 2026 | El error general se pinta dentro de un contenedor `role="alert"` que siempre está montado, para que el lector de pantalla lo anuncie al aparecer | `frontend/src/components/Form.tsx` |
| 11 nov 2026 | Los anchos de página son tokens de Tailwind: `--container-formulario` (40rem, 640 px) y `--container-completo` (75rem, 1200 px), con clases `max-w-formulario` y `max-w-completo`. Solo los usa `PageShell` | `frontend/src/index.css` |
| 11 nov 2026 | `PageShell` exige `ancho`, sin valor por defecto: cada página decide el suyo. No pinta encabezado propio porque `TopBar` ya muestra el título como `<h1>`. Las secciones de la página van separadas 32 px (`gap-8`) | `frontend/src/components/layout/PageShell.tsx` |
| 11 nov 2026 | `Modal` usa el `<dialog>` nativo con `showModal()` en vez de un `div` fijo: el navegador deja inerte la página de atrás (foco atrapado sin código propio), maneja Escape y lo pone encima de todo sin `z-index`. Con Tab, el foco puede pasar a la interfaz del navegador, pero nunca a la página de atrás | `frontend/src/components/Modal.tsx` |
| 11 nov 2026 | `Modal` es controlado: Escape, clic afuera y el botón Cerrar solo llaman a `onCerrar`. `cerrarAlClicFuera={false}` para formularios largos | `frontend/src/components/Modal.tsx` |
| 11 nov 2026 | Anchos de modal: `normal` 448 px (`max-w-md`, un poco más que el `max-w-sm` de hoy para que quepan formularios) y `amplio` 768 px (`max-w-3xl`, como la tabla de amortización) | `frontend/src/components/Modal.tsx` |
| 11 nov 2026 | Foco inicial: primer control del cuerpo; si no hay, el botón Cerrar. Al cerrar vuelve al elemento que abrió el modal | `frontend/src/components/Modal.tsx` |
| 11 nov 2026 | `LoadingState` usa `role="status"` y no gira con "reducir movimiento". `pantallaCompleta` cubre el caso de `App.tsx`, que carga antes de tener layout | `frontend/src/components/LoadingState.tsx` |
| 11 nov 2026 | `EmptyState` tiene título, descripción opcional, ícono opcional y acción opcional. La búsqueda sin resultados se escribe con el mismo componente, sin acción. La acción se omite cuando el rol no puede crear | `frontend/src/components/EmptyState.tsx` |
| 11 nov 2026 | `Badge` es de contorno, sin relleno. El patrón de hoy (texto sobre su propio color al 12 %) deja el texto en 3,9:1 sobre `bg-surface-2`, y con la paleta de T3 ningún tinte cumple: el destructivo sobre `surface-2` ya está en 4,62:1 sin fondo. Se descartó el relleno sólido porque una columna de estados se vería muy cargada | `frontend/src/components/Badge.tsx` |
| 11 nov 2026 | Tonos de `Badge` por significado: `ok` al día o activo; `alerta` pendiente o por vencer; `destructivo` mora, castigado o bloqueado; `neutral` roles y estados sin carga. `neutral` usa `text-secondary` | `frontend/src/components/Badge.tsx` |
| 11 nov 2026 | Consecuencia general: los fondos teñidos detrás de texto de color (`rgba(…, 0.06–0.12)`, como los avisos de prepago en Créditos) tampoco cumplen AA con esta paleta. Al migrar se usan superficies (`bg-surface-2`) con texto normal, o un borde del color del estado | Este documento, Hallazgos |
| 11 nov 2026 | La página de muestra se registra solo con `import.meta.env.DEV` y se carga con `lazy()`: no llega al build de producción (comprobado buscando su texto en `dist`) | `frontend/src/App.tsx` |
| 11 nov 2026 | Un modal con formulario lleva el `Form` dentro del cuerpo, con sus botones en `actions` del `Form`, no en `acciones` del `Modal`: el botón de envío tiene que quedar dentro del `<form>` para que Enter funcione. `acciones` del `Modal` es para modales sin formulario (confirmaciones, tablas) | `frontend/src/pages/dev/ComponentesPage.tsx` |
| 11 nov 2026 | Regla de clases: un componente no pone en su base una clase que una variante necesita sobrescribir (`border-transparent` contra `border-accion-primaria`). Dos utilidades de la misma propiedad empatan en especificidad y gana la que Tailwind escriba después, no la última del `className` | `frontend/src/components/Button.tsx` |
| 11 nov 2026 | **Naranja de modo claro un tono más claro, a pedido.** El relleno pasa de `#a35800` a `#b26000` (4,6:1 con blanco, lo más claro posible con texto blanco), con hover `#a35800`. Se separa un token `--color-accion-texto` (`#a35800` claro, `#dd9a4c` oscuro) para el naranja como texto o borde (botón secundario, enlaces, foco), porque `#b26000` como texto da 3,9:1 sobre `bg-surface-2`. El alias `primary_y` apunta a `accion-texto`: sus 33 usos son de texto, así que los 10 fondos viejos (avatar, tarjeta destacada, botón del chat) conservan `#a35800` hasta la Etapa 3. Se consideró aclararlo más con texto oscuro y se descartó para mantener el texto blanco | `frontend/src/index.css`, `docs/SISTEMA_DE_DISENO.md` |
| 11 nov 2026 | Los errores de lint que ya existían no se corrigen en T1: son de lógica, no de formato. Se registran como hallazgos y se resuelven en su etapa | Este documento, Hallazgos |

## Decisiones pendientes (especificaciones §13)

- Aislamiento entre cajas: políticas de fila reales, o corregir el documento para que describa el filtro por `caja_id`.
- Límite de cinco cajas por cuenta: implementarlo o quitarlo del documento.
- Ícono de notificaciones: implementarlo o retirarlo.
- "Bloqueado" o "Suspendido" como nombre del estado de la cuenta.

---

## Hallazgos sin resolver

Problemas encontrados fuera de la etapa actual. Se resuelven cuando les toque su etapa.

| Hallazgo | Etapa que lo resuelve |
| --- | --- |
| `frontend/index.html` declara `lang="en"`; la interfaz es solo en español | Etapa 3 |
| `graphify-out/` no está en `.gitignore` | Sin asignar |
| Los alias `--color-primary_y` y compañía se resuelven en `:root`, así que solo siguen el modo oscuro porque `ThemeContext` pone `.dark` en `<html>`. Si algún día `.dark` se aplica a un subárbol, los alias no cambiarían. Desaparece al borrar los alias | Etapa 3 |
| 5 sitios fuera de `Button` ponen `text-white` sobre un relleno de color. En modo oscuro dan 2,4:1. Se corrige usando `text-sobre-accion` | Etapa 3 |
| Valores fuera de escala en las páginas: 57 usos de 20 px (`p-5`, `px-5`…), 12 de 40 px, 13 `borderRadius` y 12 `fontSize` en `style={{}}`, 6 `text-lg`. Inventario y reemplazos en `docs/SISTEMA_DE_DISENO.md` §5 | Etapa 3, página por página |
| Los PDF de `ReportesPage` pintan la cabecera con el naranja viejo `[221, 154, 76]` y texto blanco (2,4:1) | Etapa 3 (Reportes) |
| **Fechas un día atrasadas.** Las columnas `date` llegan como `"2026-11-11"` y las páginas hacen `new Date(f)`, que las toma como UTC: en Ecuador se ven como el día anterior (`fecha_apertura`, `fecha_ingreso`, `fecha_desembolso`, vencimientos). `fecha()` ya lo corrige; falta reemplazar las 6 funciones locales | Etapa 3, al migrar cada página |
| `DashboardPage` muestra fechas relativas ("Hoy", "Ayer") que `format.ts` no cubre. Al migrar, decidir si se agrega `fechaRelativa()` o se usa `fecha()` | Etapa 3 (Dashboard) |
| `ForgotPasswordPage` y `ResetPasswordPage` usan una tarjeta `bg-secondary_wt` de color fijo que no cambia en modo oscuro | Etapa 3 (autenticación) |
| §3 dice que hay `<textarea>` sueltos en `SociosPage` y `CreditosPage`, pero en el código actual no hay ninguno. `TextareaField` se hizo igual; corregir la tabla de §3 o confirmar dónde hacen falta | Sin asignar (documento) |
| 8 `<select>` sueltos con estilo propio y `style={{}}` (Créditos, Ahorros, Reportes, Configuración ×4, AbonoModal) se reemplazan por `SelectField` | Etapa 3, al migrar cada página |
| `PageShell` cubre solo las páginas con barra lateral. `CajasPage` y las cuatro de autenticación no usan `AppLayout` y centran con su propio `max-w-*` (`max-w-2xl`, `max-w-sm`). Decidir al migrarlas si tienen su propio contenedor o un tercer ancho | Etapa 3 |
| Las líneas que cita §4.1 (`ConfiguracionPage.tsx:235`, etc.) se corrieron con el formato de T1; hoy son `ConfiguracionPage.tsx:241`, `AhorrosPage.tsx:185`, `CreditosPage.tsx:260`, `ProfilePage.tsx:152` y `:202` | Etapa 3 (referencia) |
| 7 overlays escritos a mano con `fixed inset-0` (`AbonoModal`, `ConfirmarPagoModal`, `TablaAmortizacion`, `DonacionModal`, dos en `AhorrosPage` y el de confirmación de `NotifContext`) se pasan a `Modal`. Hoy no cierran con Escape ni atrapan el foco | Etapa 3 (`DonacionModal` ya se borró en la Etapa 2; quedan 6, y `ConfirmDialog`) |
| 10 textos "Cargando…" sueltos (`App.tsx`, 7 páginas, `AbonoModal`, `TablaAmortizacion`) y 7 "Aún no hay…" (Ahorros ×2, Dashboard, Socios, Cajas, Créditos ×2) se reemplazan por `LoadingState` y `EmptyState` | Etapa 3, al migrar cada página |
| Etiquetas de estado escritas a mano con `rgba` fijo (`ESTADO_CONFIG` en `CreditosPage`, roles en `SociosPage`, más `CajasPage`, `ConfiguracionPage` y `PagosPage`) se pasan a `Badge`. Los bloques con fondo teñido de Créditos (líneas 389, 416, 430) no cumplen AA y se rediseñan | Etapa 3 |
| Botones con variante equivocada según §2.2: los 12 Cancelar/Cerrar usan `secondary` y deben ser `ghost`; "Cerrar sesión" y "Retiro" usan `destructive` pero no borran ni desactivan; hay más de un `primary` por pantalla en Pagos ("Pago completo" en cada fila) y en Créditos ("Nueva solicitud" y "Crear solicitud" a la vez con el formulario abierto) | Etapa 3, al migrar cada página |
| Lint del frontend: 9 errores que ya existían (eran 11; los de `ChatbotFlotante` y `DonacionModal` se fueron con T1 y T2). 4 contextos (`Auth`, `Caja`, `Notif`, `Theme`) exportan el hook junto al componente; `setState` dentro de un efecto en `AuthContext.tsx:34`; 3 `any` en `TablaAmortizacion` y `ReportesPage`; un `let` que debería ser `const` en `ReportesPage` | Etapa 3 |
| `SociosPage.tsx:30` propone como fecha de ingreso `new Date().toISOString().split("T")[0]`, que después de las 19:00 da mañana | Etapa 3 (Socios) |
| El vencimiento del crédito (`creditos.fecha_vencimiento`, desembolso + plazo, mismo día del mes) no coincide con el de su última cuota (último día del mes). Con un desembolso el 31, `setMonth` además salta al mes siguiente. Es la lógica de antes; no se cambió | Sin asignar (decisión de negocio) |
| Para la decisión pendiente de aislamiento (§6.3, §13.2): RLS ya está activado en las 9 tablas de `public` y hay 11 políticas, pero el backend usa la clave de servicio, que las ignora. Antes de decidir, revisar qué dicen esas 11 políticas | Decisión pendiente |
| Pagos registrados antes del 12 nov después de las 19:00 de Ecuador pueden tener `fecha_pago` del día siguiente. El código nuevo ya no lo hace; los datos viejos no se corrigieron | Sin asignar |
| El documento de TIC debe declarar donaciones y chatbot como trabajo futuro en su sección 1.3 (§7). Ese documento no está en el repositorio | Fuera del código |

---

## Hecho fuera de las etapas

| Fecha | Qué | Archivos |
| --- | --- | --- |
| 11 nov 2026 | Grafo de conocimiento del código (graphify) | `graphify-out/` |
| 11 nov 2026 | Registro del producto: usuarios, propósito, compromisos de marca | `PRODUCT.md` |
| 11 nov 2026 | Configuración del modo de revisión visual en vivo | `.impeccable/live/config.json` |
| 11 nov 2026 | Plan de la Etapa 1 en 15 tareas | Este documento |
| 11 nov 2026 | Componentes pendientes de la §3 agregados a la Etapa 3 | `docs/ESPECIFICACIONES.md` §12 |
| 11 nov 2026 | Especificaciones movidas a `docs/ESPECIFICACIONES.md`, la ruta que cita CLAUDE.md | `docs/ESPECIFICACIONES.md` |

---

## Bitácora

Una línea por cambio, la más reciente arriba.

- **12 nov 2026:** Plan de la Etapa 3 en 15 tareas; rama `etapa-3` abierta.
- **12 nov 2026:** `etapa-2` fusionada en `main` con `--no-ff` (`e34de4f`). Build OK en `main`. Sin subir a GitHub; la migración `001` sigue sin ejecutar.
- **12 nov 2026:** T10 hecha en el código; SQL de la migración escrito y sin ejecutar. Esquema revisado en Supabase (solo lectura). Prueba de permisos con los nombres nuevos: 175 de 175, y `admin` ya no pasa en ninguna ruta. 11 casos de `lib/roles.ts`; uno destapó que `"toString" in NIVEL` era verdadero, y se pasó a `Object.hasOwn`. Build OK; lint del frontend con los 9 errores previos, backend en cero.
- **11 nov 2026:** T10 en espera: la migración de rol necesita ver el esquema de Supabase (tipo de la columna `rol`, restricciones, políticas y funciones que mencionen `'admin'`). Inventario del código hecho: 6 archivos del frontend y 6 del backend.
- **11 nov 2026:** T9 hecha. `caja_id` en las ocho escrituras que no lo tenían. Prueba de permisos repetida: 175 de 175. Lint del backend en cero.
- **11 nov 2026:** T8 hecha. Middleware `requierePermiso` con tabla única; borradas siete copias de `verificarRol`. Probado con las rutas reales y un Supabase simulado: 35 rutas × 5 roles, sin diferencias con antes. Los roles desconocidos ya no pasan. `API.md` actualizado.
- **11 nov 2026:** T7 hecha. Fechas del backend en la zona de Ecuador. 12 casos probados con el proceso en UTC (registro a las 20:00, ciclos en su último día, depósito del 31 a las 21:00). La prueba destapó que los ciclos se cerraban un día antes; corregido. Lint del backend en cero.
- **11 nov 2026:** T6 hecha. Borrada la segunda ruta `/resumen` y el código muerto de reportes; `montoCapital` revisado y no era un error. **Lint del backend en cero.**
- **11 nov 2026:** T5 hecha. Borrado el endpoint de pago comentado y otros restos; los comentarios explicativos se quedan. Build OK.
- **11 nov 2026:** T4 hecha. Sin logs de claves ni de depuración; `config/supabase.js` reemplazado y borrado (sí se usaba, ver Decisiones); fuera `test-email`. El servidor arranca. Build OK; lint del backend con los mismos 6 errores previos.
- **11 nov 2026:** T3 hecha. Borrados los recursos y el README de la plantilla de Vite; el favicon declara `image/png`. Build OK.
- **11 nov 2026:** T2 hecha. Chatbot quitado del backend y del frontend. Lint del frontend baja de 11 a 9 errores. Build OK.
- **11 nov 2026:** T1 hecha. Donaciones y PayPal quitados, incluido el script con el client-id en `index.html`. Build OK; lint sin errores nuevos.
- **11 nov 2026:** Plan de la Etapa 2 en 10 tareas; rama `etapa-2` abierta.
- **11 nov 2026:** `etapa-1` fusionada en `main` con `--no-ff` (`9a22d71`). Build OK en `main`. Sin subir a GitHub todavía.
- **11 nov 2026:** Naranja de modo claro aclarado a `#b26000` y nuevo token `--color-accion-texto` para su uso como texto. Contraste medido de nuevo: todo AA, mínimo 4,60:1. Revisado en `/dev/componentes` y en login. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** **Etapa 1 terminada.** T15 hecha: página de muestra en `/dev/componentes` (solo desarrollo) con todos los primitivos. Revisada en claro y oscuro, y su formulario probado con teclado real. Al revisarla apareció un error de T6: el `Button` `secondary` no mostraba el contorno y se veía como `ghost`, también en las páginas reales. Corregido en `69d389d`. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T14 hecha. `Badge` con cuatro tonos y ícono opcional. Se midió el patrón de fondo teñido y no cumple AA con la paleta de T3, así que el badge es de contorno; la regla se anota para la migración. Revisado sobre las tres superficies en claro y oscuro. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T13 hecha. `LoadingState` y `EmptyState`, revisados en claro y oscuro dentro de una tarjeta, sobre una página temporal ya borrada. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T12 hecha. `Modal` sobre `<dialog>`: Escape, clic afuera (sin cerrar por arrastre), foco atrapado, foco inicial y de regreso, `aria-modal`. 11 casos probados en Chromium con teclado y mouse reales, en claro y oscuro, sobre una página temporal ya borrada. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T11 hecha. `PageShell` con `ancho="formulario"` (640 px) y `"completo"` (1200 px), siempre centrado. Revisado con los providers reales a 1600 y 900 px de ancho, sobre una página temporal ya borrada. Las páginas todavía no lo usan (Etapa 3). Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T10 hecha. `Form` con `preventDefault`, envío con Enter, protección contra doble envío y error general accesible. Probado en Chromium con pulsaciones reales de teclado sobre una página temporal (ya borrada): Enter envía, dos Enter dan un envío, no recarga, Cancelar no envía. Las páginas todavía no lo usan (Etapa 3). Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T9 hecha. `SelectField` (opciones, placeholder atenuado, chevron propio) y `TextareaField` (filas, contador). Revisados en claro y oscuro con el CSS compilado. No hay `<textarea>` en el código pese a lo que dice §3; queda en Hallazgos. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T8 hecha. `TextField` con `name`, `autoComplete`, `onBlur`, `maxLength`, `inputMode` y `min`/`max`/`step`; `Field` pasa a ser su alias. Se agregó `color-scheme` para los controles nativos. Fecha, número, error y deshabilitado revisados en claro y oscuro con el CSS compilado. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T7 hecha. `FieldBase` con etiqueta asociada por `useId`, ayuda y error enlazados con `aria-describedby`, `aria-invalid` y colores por token. `Field` se apoya en él y pierde `variant`. Se resuelve el hallazgo del borde de los campos con `--border-control`. Revisado en el navegador (registro, claro y oscuro) y en el DOM. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T6 hecha. `Button` con las cuatro variantes por prioridad sobre tokens, `type` y `fullWidth`, sin `onEnter` ni `m-1`. Se revisó en el navegador la pantalla de login en claro y oscuro. En las páginas solo se cambiaron 3 `danger`, el `onEnter` de Login y un `gap`. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T5 hecha. `src/lib/format.ts` con `moneda`, `fecha`, `fechaHora` y `porcentaje`. Al escribirlo apareció que las fechas sin hora se ven un día atrasadas en el frontend, y que el backend registra con fecha del día siguiente a partir de las 19:00; los dos quedan en Hallazgos. 18 casos probados. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T4 hecha. Nuevo `docs/SISTEMA_DE_DISENO.md` con las clases de color, las escalas de espaciado, texto y radios con su equivalente en Tailwind, y un inventario de lo que hoy está fuera de escala con su reemplazo. No se tocó ninguna página. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T3 hecha. Se midieron todas las combinaciones de texto y relleno en los dos modos. Además del naranja fallaban el rojo, el verde, `text-muted` y alerta. Todas quedan en AA, con mínimo 4,61:1. En oscuro el texto sobre los rellenos pasa a ser oscuro. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T2 hecha. Un solo juego de tokens semánticos en `index.css` para claro y oscuro, expuestos como clases de Tailwind. Se comprobó en el CSS compilado que las 18 clases nuevas y viejas se generan y apuntan a la variable correcta. Los colores de marca no cambian todavía (eso es T3). Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T1 hecha. Prettier común para el frontend y el backend, y ESLint nuevo en el backend. El formato se verificó comparando el AST antes y después: equivalente en los 20 archivos del backend y en los bundles del frontend. Build OK. El lint sigue fallando por 11 errores previos del frontend y 6 del backend, ahora registrados en Hallazgos.
- **11 nov 2026:** Especificaciones movidas de la raíz a `docs/ESPECIFICACIONES.md`; se resuelve el hallazgo de la ruta en CLAUDE.md.
- **11 nov 2026:** Se crea este documento. Plan de la Etapa 1 aprobado con cuatro decisiones (naranja, componentes a Etapa 3, Prettier primero, página de muestra).
