# Estado del proyecto — DOMUS Web

Documento vivo. Se actualiza cada vez que se termina una tarea, se toma una decisión o se encuentra algo nuevo.

- **Última actualización:** 11 de noviembre de 2026
- **Etapa actual:** Etapa 1, Fundaciones. 5 de 15 tareas hechas (T1–T5).
- **Rama de trabajo:** `etapa-1` (sale de `main` en `c844dfb`)
- **Fuente de verdad:** `docs/ESPECIFICACIONES.md` (sección 12 para el orden de trabajo)
- **Último commit de referencia:** `d6e79eb`

---

## Etapas (sección 12)

| Etapa | Nombre | Estado |
| --- | --- | --- |
| 1 | Fundaciones | En curso: 5/15 |
| 2 | Limpieza | Pendiente |
| 3 | Migración de pantallas | Pendiente |
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
| T6 | `Button`: variantes `primary`, `secondary`, `ghost`, `destructive`; `type`, `fullWidth`; sin `onEnter` ni `m-1` | T2 | ⬜ | |
| T7 | `FieldBase`: label asociado con `useId`, colores por token, sin la prop `variant` | T2 | ⬜ | |
| T8 | `TextField` (incluye date y number); `Field` queda como alias | T7 | ⬜ | |
| T9 | `SelectField` y `TextareaField` | T7 | ⬜ | |
| T10 | `Form`: `preventDefault`, envío con Enter, error general | T6 | ⬜ | |
| T11 | `PageShell`: anchos `formulario` (640 px) y `completo` (1200 px), siempre centrado | T2 | ⬜ | |
| T12 | `Modal`: Escape, clic afuera, foco atrapado, `aria-modal` | T2 | ⬜ | |
| T13 | `LoadingState` y `EmptyState` | T2 | ⬜ | |
| T14 | `Badge`: tonos `ok`, `alerta`, `destructivo`, `neutral` | T2 | ⬜ | |
| T15 | Página de muestra solo para desarrollo (`/dev/componentes`), en modo claro y oscuro | T6–T14 | ⬜ | |

Cada tarea se cierra con `npm run build`, `npm run lint` y commit (CLAUDE.md).

---

## Decisiones tomadas

| Fecha | Decisión | Dónde quedó escrita |
| --- | --- | --- |
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
| `GET /api/cajas/:cajaId/resumen` está definido dos veces en `cajas.routes.js` (líneas 102 y 249); Express solo usa el primero | Etapa 2 |
| `frontend/index.html` tiene el client-id de PayPal escrito a mano en vez de leer `VITE_PAYPAL_CLIENT_ID` | Etapa 2 (se quita PayPal) |
| `frontend/index.html` declara `lang="en"`; la interfaz es solo en español | Etapa 3 |
| `favicon.svg`, `hero.png`, `react.svg`, `vite.svg` e `icons.svg` son archivos de la plantilla de Vite, no de DOMUS | Etapa 2 |
| `graphify-out/` no está en `.gitignore` | Sin asignar |
| Los alias `--color-primary_y` y compañía se resuelven en `:root`, así que solo siguen el modo oscuro porque `ThemeContext` pone `.dark` en `<html>`. Si algún día `.dark` se aplica a un subárbol, los alias no cambiarían. Desaparece al borrar los alias | Etapa 3 |
| `Button` (y otros 7 sitios) ponen `text-white` sobre el relleno. En modo oscuro eso da 2,4:1 sobre el naranja, igual que antes de T3. Se corrige usando `text-sobre-accion` | T6 en `Button`; Etapa 3 en el resto |
| Valores fuera de escala en las páginas: 57 usos de 20 px (`p-5`, `px-5`…), 12 de 40 px, 13 `borderRadius` y 12 `fontSize` en `style={{}}`, 6 `text-lg`. Inventario y reemplazos en `docs/SISTEMA_DE_DISENO.md` §5 | Etapa 3, página por página |
| Los PDF de `ReportesPage` pintan la cabecera con el naranja viejo `[221, 154, 76]` y texto blanco (2,4:1) | Etapa 3 (Reportes) |
| **Fechas un día atrasadas.** Las columnas `date` llegan como `"2026-11-11"` y las páginas hacen `new Date(f)`, que las toma como UTC: en Ecuador se ven como el día anterior (`fecha_apertura`, `fecha_ingreso`, `fecha_desembolso`, vencimientos). `fecha()` ya lo corrige; falta reemplazar las 6 funciones locales | Etapa 3, al migrar cada página |
| **Fechas un día adelantadas en el backend.** `new Date().toISOString().split("T")[0]` (en `ahorros.routes.js:140`, `socios.routes.js:104` y `creditos.routes.js:177`) toma la fecha UTC: lo que se registra después de las 19:00 de Ecuador queda con fecha del día siguiente | Etapa 2 |
| `DashboardPage` muestra fechas relativas ("Hoy", "Ayer") que `format.ts` no cubre. Al migrar, decidir si se agrega `fechaRelativa()` o se usa `fecha()` | Etapa 3 (Dashboard) |
| `--border-base` mide 1,1–1,5:1 contra las superficies. Sirve para separar tarjetas, pero no como único borde de un campo de formulario (WCAG 1.4.11 pide 3:1) | T7 |
| Lint del frontend: 11 errores que ya existían. 2 en `ChatbotFlotante` y `DonacionModal`; 4 contextos (`Auth`, `Caja`, `Notif`, `Theme`) exportan el hook junto al componente; `setState` dentro de un efecto en `AuthContext.tsx:34`; 3 `any` en `TablaAmortizacion` y `ReportesPage`; un `let` que debería ser `const` en `ReportesPage` | Etapa 2 (chatbot y donaciones); Etapa 3 (el resto) |
| Lint del backend: 6 errores, todos variables sin usar, en `cajas.routes.js`, `pagos.routes.js` y `reportes.routes.js` | Etapa 2 |
| **Revisar:** en `pagos.routes.js`, a `montoCapital` se le asigna un valor que nunca se usa. Puede ser un error de cálculo en los pagos, no solo código sobrante | Etapa 2, con prioridad |

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

- **11 nov 2026:** T5 hecha. `src/lib/format.ts` con `moneda`, `fecha`, `fechaHora` y `porcentaje`. Al escribirlo apareció que las fechas sin hora se ven un día atrasadas en el frontend, y que el backend registra con fecha del día siguiente a partir de las 19:00; los dos quedan en Hallazgos. 18 casos probados. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T4 hecha. Nuevo `docs/SISTEMA_DE_DISENO.md` con las clases de color, las escalas de espaciado, texto y radios con su equivalente en Tailwind, y un inventario de lo que hoy está fuera de escala con su reemplazo. No se tocó ninguna página. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T3 hecha. Se midieron todas las combinaciones de texto y relleno en los dos modos. Además del naranja fallaban el rojo, el verde, `text-muted` y alerta. Todas quedan en AA, con mínimo 4,61:1. En oscuro el texto sobre los rellenos pasa a ser oscuro. Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T2 hecha. Un solo juego de tokens semánticos en `index.css` para claro y oscuro, expuestos como clases de Tailwind. Se comprobó en el CSS compilado que las 18 clases nuevas y viejas se generan y apuntan a la variable correcta. Los colores de marca no cambian todavía (eso es T3). Build OK; lint con los mismos 11 errores previos.
- **11 nov 2026:** T1 hecha. Prettier común para el frontend y el backend, y ESLint nuevo en el backend. El formato se verificó comparando el AST antes y después: equivalente en los 20 archivos del backend y en los bundles del frontend. Build OK. El lint sigue fallando por 11 errores previos del frontend y 6 del backend, ahora registrados en Hallazgos.
- **11 nov 2026:** Especificaciones movidas de la raíz a `docs/ESPECIFICACIONES.md`; se resuelve el hallazgo de la ruta en CLAUDE.md.
- **11 nov 2026:** Se crea este documento. Plan de la Etapa 1 aprobado con cuatro decisiones (naranja, componentes a Etapa 3, Prettier primero, página de muestra).
