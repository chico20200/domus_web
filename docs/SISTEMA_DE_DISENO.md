# Sistema de diseño — DOMUS Web

Referencia rápida para escribir componentes y migrar páginas. Desarrolla las secciones 2.3 y 2.4 de `docs/ESPECIFICACIONES.md`; si algo de aquí las contradice, mandan las especificaciones.

Regla general: **solo se usan los valores de esta página**. Si un diseño necesita algo que no está aquí, falta un token o un valor en la escala, y eso se decide y se anota en `ESTADO.md` antes de usarlo.

---

## 1. Colores

Los valores y su medición de contraste están en `frontend/src/index.css`. Aquí solo van las clases que se usan.

| Función | Clase | Notas |
| --- | --- | --- |
| Fondo de la página | `bg-base` | |
| Fondo de tarjetas, modales, barra lateral | `bg-surface` | |
| Fondo de zonas dentro de una tarjeta (cabecera de tabla, bloque destacado) | `bg-surface-2` | |
| Texto principal | `text-primary` | |
| Texto de apoyo: etiquetas, descripciones | `text-secondary` | |
| Texto auxiliar: fechas, notas, ayudas | `text-muted` | Cumple AA; se puede usar para información real |
| Borde separador de tarjetas y filas | `border-base` | Decorativo: no sirve como borde de un control |
| Borde de campos de formulario | `border-control` | 3:1 contra las tres superficies. Lo aplica `FieldBase` |
| Foco | `ring-focus`, `outline-focus`, `border-focus` | |
| Relleno de la acción principal | `bg-accion-primaria`, `hover:bg-accion-primaria-hover` | Un solo botón primario por pantalla |
| Naranja como texto o borde: enlaces, botón secundario | `text-accion-texto`, `border-accion-texto` | Nunca `text-accion-primaria`: el relleno es más claro y como texto no llega a 4,5:1 |
| Relleno de la acción destructiva | `bg-destructivo`, `hover:bg-destructivo-hover` | |
| Texto sobre cualquier relleno de color | `text-sobre-accion` | Nunca `text-white`: en modo oscuro el texto sobre relleno es oscuro |
| Estado correcto: al día, vigente, registrado | `text-estado-ok`, `bg-estado-ok` | |
| Estado de alerta: por vencer, pendiente | `text-estado-alerta`, `bg-estado-alerta` | |
| Error, mensaje de validación | `text-destructivo` | |

**No poner texto de color sobre un fondo teñido de ese color** (`bg-estado-ok/10` con `text-estado-ok`, o los `rgba(…, 0.12)` de hoy). Con esta paleta el texto baja de 4,5:1, sobre todo encima de `bg-surface-2`. Para marcar un estado: `Badge` (contorno), o un bloque `bg-surface-2` con texto normal y un borde del color del estado.

Los nombres viejos (`primary_y`, `secondary_g`, `danger_r`, `blk_1`, `blk_2`, `secondary_wt`) siguen funcionando como alias hasta terminar la Etapa 3. No se usan en código nuevo.

---

## 2. Espaciado

Escala: **4, 8, 12, 16, 24, 32, 48 px**. Se aplica a `p-*`, `m-*`, `gap-*` y `space-*` en todas sus variantes (`px`, `py`, `mt`, `gap-x`…).

| px | Clase Tailwind | Uso típico |
| --- | --- | --- |
| 0 | `-0` | Quitar un espacio |
| 4 | `-1` | Entre un ícono y su texto; entre una etiqueta y su ayuda |
| 8 | `-2` | Relleno vertical de controles; entre botones de un grupo |
| 12 | `-3` | Relleno horizontal de controles; entre campos muy relacionados |
| 16 | `-4` | Entre campos de un formulario; relleno de tarjetas pequeñas |
| 24 | `-6` | Relleno de tarjetas y modales; entre bloques de una tarjeta |
| 32 | `-8` | Entre secciones de una página |
| 48 | `-12` | Márgenes grandes: estados vacíos, separación de la cabecera de página |

Fuera de la escala (no usar): `-0.5`, `-1.5`, `-2.5`, `-5`, `-7`, `-10` y cualquier valor entre corchetes como `p-[9px]`.

**Excepciones:**

- Anchos y altos (`w-*`, `h-*`, `size-*`) no están limitados a la escala; se usan los que el contenido necesite (íconos `size-4` y `size-5`, avatares, etc.).
- El hueco para un ícono dentro de un campo es `pr-9` (12 px de margen + 16 px de ícono + 8 px de separación). Lo pone `FieldBase`; las páginas no lo escriben. Los buscadores de Socios y Pagos también usan `TextField` con el ícono a la derecha.
- Bordes de 1 px (`border`) y anillos de foco (`ring-2`) no son espaciado.

---

## 3. Texto

Escala: **12, 14, 16, 20, 24 px**.

| px | Clase Tailwind | Interlineado (lo pone Tailwind) | Uso |
| --- | --- | --- | --- |
| 12 | `text-xs` | 16 px | Auxiliar: fechas, notas al pie, texto de `Badge` |
| 14 | `text-sm` | 20 px | Cuerpo: formularios, tablas, botones, párrafos |
| 16 | `text-base` | 24 px | Subtítulo: título de tarjeta o de modal |
| 20 | `text-xl` | 28 px | Título de sección |
| 24 | `text-2xl` | 32 px | Título de página, uno por pantalla |

Fuera de la escala (no usar): `text-lg` (18 px), `text-3xl` en adelante y cualquier `fontSize` en `style={{}}`.

El peso no tiene escala propia en las especificaciones. Mientras no se decida otra cosa: `font-normal` para cuerpo, `font-medium` para etiquetas y botones, `font-semibold` para títulos.

**Excepción:** los PDF que genera `jsPDF` usan su propio tamaño en puntos (`doc.setFontSize(8)`, etc.). No son interfaz y no siguen esta escala.

---

## 4. Radios

| px | Clase Tailwind | Uso |
| --- | --- | --- |
| 8 | `rounded-lg` | Controles: botones, campos, selects, chips |
| 12 | `rounded-xl` | Contenedores: tarjetas, modales, paneles |
| — | `rounded-full` | Solo elementos circulares o en píldora: avatares, puntos de estado, `Badge` |

Fuera de la escala (no usar): `rounded`, `rounded-sm`, `rounded-md`, `rounded-2xl` y cualquier `borderRadius` en `style={{}}`.

---

## 5. Lo que hoy está fuera de escala

Medido el 11 de noviembre de 2026 sobre `frontend/src`. No se corrige ahora: cada página se ajusta cuando se migra en la Etapa 3. La tabla sirve para saber qué buscar y cómo reemplazarlo.

| Hoy | Veces | Reemplazo |
| --- | --- | --- |
| `px-5`, `p-5`, `gap-5`, `mb-5`, `m-5` (20 px) | 57 | `-6` en tarjetas y modales; `-4` en controles y listas |
| `py-10`, `pr-10` (40 px) | 12 | `-12` en estados vacíos; `-8` en el resto |
| `py-1.5` (6 px) | 3 | `py-2` |
| `py-0.5`, `mt-0.5` (2 px) | 4 | `-1`, o nada |
| `text-lg` (18 px) | 6 | `text-base` si es subtítulo, `text-xl` si es título de sección |
| `fontSize: "13px"` | 8 | `text-xs` o `text-sm`, según si es auxiliar o cuerpo |
| `fontSize: "15px"`, `"14px"`, `"12px"`, `"10px"` | 4 | `text-sm`, `text-sm`, `text-xs`, `text-xs` (los de 12 y 14 están en la escala, pero escritos en `style={{}}`) |
| `borderRadius` en `style={{}}` (6, 8, 10, 12, 16 px, 50 %) | 13 | `rounded-lg`, `rounded-xl` o `rounded-full` |

Para volver a medir:

```bash
cd frontend/src
grep -rhoE "\b-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-(0\.5|1\.5|2\.5|5|7|10|11|14|16|20)\b" --include=*.tsx . | sort | uniq -c
grep -rhoE "\btext-(lg|3xl|4xl|\[[0-9]+px\])\b|fontSize: ?\"[0-9]+px" --include=*.tsx . | sort | uniq -c
grep -rhoE "\brounded(-(sm|md|2xl|3xl))?[\" ]|borderRadius: ?\"[0-9]+" --include=*.tsx . | sort | uniq -c
```
