# Estado del proyecto — DOMUS Web

Documento vivo. Se actualiza cada vez que se termina una tarea, se toma una decisión o se encuentra algo nuevo.

- **Última actualización:** 11 de noviembre de 2026
- **Etapa actual:** Etapa 1, Fundaciones. 1 de 15 tareas hechas (T1).
- **Rama de trabajo:** `etapa-1` (sale de `main` en `c844dfb`)
- **Fuente de verdad:** `docs/ESPECIFICACIONES.md` (sección 12 para el orden de trabajo)
- **Último commit de referencia:** `3699443`

---

## Etapas (sección 12)

| Etapa | Nombre | Estado |
| --- | --- | --- |
| 1 | Fundaciones | En curso: 1/15 |
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
| T2 | Tokens semánticos únicos en `:root` y `.dark`, expuestos en `@theme`, con alias de los nombres viejos | T1 | ⬜ | |
| T3 | Verificar contraste AA y oscurecer el naranja de marca para usar texto blanco | T2 | ⬜ | |
| T4 | Documentar la escala de espaciado, texto y radios (equivalencias con Tailwind) | T2 | ⬜ | |
| T5 | `src/lib/format.ts`: `moneda`, `fecha`, `fechaHora`, `porcentaje` | T1 | ⬜ | |
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

- **11 nov 2026:** T1 hecha. Prettier común para el frontend y el backend, y ESLint nuevo en el backend. El formato se verificó comparando el AST antes y después: equivalente en los 20 archivos del backend y en los bundles del frontend. Build OK. El lint sigue fallando por 11 errores previos del frontend y 6 del backend, ahora registrados en Hallazgos.
- **11 nov 2026:** Especificaciones movidas de la raíz a `docs/ESPECIFICACIONES.md`; se resuelve el hallazgo de la ruta en CLAUDE.md.
- **11 nov 2026:** Se crea este documento. Plan de la Etapa 1 aprobado con cuatro decisiones (naranja, componentes a Etapa 3, Prettier primero, página de muestra).
