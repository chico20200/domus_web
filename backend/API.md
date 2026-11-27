# API DOMUS — Documentación de Endpoints

Backend Express + Supabase. Base URL local: `http://localhost:3000` (puerto configurable vía `PORT`).

## Autenticación

La mayoría de los endpoints requieren el header:

```
Authorization: Bearer <access_token>
```

El token es el `access_token` de sesión devuelto por Supabase en `/api/auth/login`. El middleware `verifyToken` (`middlewares/auth.middleware.js`) valida el token contra Supabase Auth y expone el usuario en `req.user`.

Respuestas de error de autenticación:

- `401 { error: 'Token no proporcionado' }` — falta el header `Authorization`.
- `403 { error: 'Token inválido o expirado' }` — el token no es válido.
- `403 { error, codigo: 'cuenta_bloqueada', motivo, bloqueada_en }` — la administración de DOMUS bloqueó la cuenta (tabla `bloqueos_cuenta`, migración 003). Vale también para una sesión abierta antes del bloqueo.

Las rutas de administración del sistema usan además `requiereAdminSistema` (`middlewares/adminSistema.middleware.js`), que solo deja pasar a las cuentas de la tabla `administradores_sistema` y responde `403 { error }` a las demás.

## Roles y permisos por caja

Las rutas anidadas bajo `/api/cajas/:cajaId/...` validan el rol del usuario dentro de esa caja específica (tabla `miembros_caja`), con jerarquía:

```
socio (1) < tesorero (2) < coordinador (3)
```

La verificación la hace un solo middleware, `requierePermiso("<permiso>")` en `middlewares/permisos.middleware.js`. Ahí está la tabla única que asigna a cada permiso su rol mínimo (`caja.ver` → socio, `movimientos.registrar` → tesorero, `caja.configurar` → coordinador, etc.). Cada endpoint indica el **rol mínimo** requerido.

- `403 { error: 'Sin acceso a esta caja' }` — el usuario no es miembro activo de la caja.
- `403 { error: 'Tu rol no permite esta acción' }` — no alcanza el rol mínimo. Un rol que no está en la escalera tampoco pasa.

### Aislamiento en la base (RLS, Etapa 6)

Desde la migración `004`, las rutas de una caja consultan Supabase con el token de quien hace la petición (`req.db`, creado en `verifyToken` con la clave pública). Las políticas de fila repiten la escalera de roles dentro de la base: aunque una ruta olvidara un filtro, nadie lee ni escribe datos de una caja de la que no es miembro. Una caja que no está `activa` (bloqueada o eliminada) se puede leer, pero no admite registros nuevos.

La clave de servicio (`supabaseAdmin`) queda solo para el panel del administrador (`/api/admin`) y para leer el estado de la cuenta (bloqueos).

Las escrituras que tocan dos tablas son funciones de Postgres, todo o nada:

| Ruta                                             | Función                                             |
| ------------------------------------------------ | --------------------------------------------------- |
| `POST /cuentas/:id/deposito`, `/retiro`          | `registrar_movimiento`                              |
| `POST /creditos/:id/pagos`, `/abono`            | `registrar_pago_credito`                            |
| `POST /creditos/:id/pagos/prepago`               | `registrar_pago_adelantado` (varios pagos juntos)   |
| `POST /api/cajas`                                | `crear_caja` (límite de 3 cajas creadas por cuenta) |
| `POST /api/cajas/unirse`                         | `unirse_con_codigo`                                 |
| `GET /cuentas/mias`, `GET /creditos/mios`        | `vincular_mi_ficha`                                 |
| `GET /miembros` (correos)                        | `correos_miembros`                                  |
| `GET /api/cajas/mis-cajas` (cupo)                | `cajas_creadas`                                     |
| `POST …/comprobante` (foto de un registro)        | `adjuntar_comprobante`                              |
| `PUT`/`DELETE /api/profiles/me/foto`             | `poner_foto_perfil`                                 |
| `PUT`/`DELETE /api/cajas/:id/foto`               | `poner_foto_caja`                                   |
| `POST /api/cajas/:id/fondos`, `PUT …/:fondoId`  | `crear_fondo`, `editar_fondo`                       |
| `PUT …/fondos/:fondoId/estado`                   | `cambiar_estado_fondo`                              |
| `POST …/fondos/:fondoId/deposito`, `/retiro`     | `registrar_movimiento_fondo`                        |

Errores que pueden devolver además de los de cada ruta:

- `400`, `404`: el mensaje viene de la base (por ejemplo, "Saldo insuficiente…").
- `409 { error: 'La caja no admite registros nuevos' }` — la caja está bloqueada o eliminada.
- `409 { error: 'Ya creaste tres cajas, que es el máximo por cuenta' }`.
- `409 { error: 'El crédito cambió mientras se registraba el pago. Vuelve a intentarlo.' }` — otro pago cambió el saldo entre el cálculo de la cuota y la escritura.
- `403 { error: 'Tu rol no permite esta acción en esta caja' }` — una escritura que el RLS rechazó.
- `409 { error: 'Ya existe un registro con esos datos en esta caja' }` — un dato que no se puede repetir, como la cédula.

### Reglas de los datos en la base (migración 005)

Con el token de la persona y la clave pública se puede hablar directo con Supabase, sin pasar por este backend. Por eso las reglas de los datos también están en la base y no se pueden saltar:

- Saldos, movimientos y pagos solo cambian con `registrar_movimiento` y `registrar_pago_credito`. Nadie escribe a mano un saldo, un movimiento ni un pago, y nadie borra filas.
- Fichas: cédula ecuatoriana válida, teléfono y correo con forma correcta. Se guardan solo los dígitos. Una ficha antigua se puede editar sin tocar su cédula.
- Créditos: monto mayor a 0, tasa anual de 0,01 % a 100 %, plazo de 1 a 120 meses. La base calcula el total, la cuota y el saldo, y la solicitud nace `pendiente`. Cambios de estado permitidos: `pendiente → activo` (al aprobar, con fechas) y `activo ↔ vencido`. `pagado` lo pone el último pago.
- Cuentas: nacen activas y en 0. Solo se cierran con saldo 0.
- Perfil: nombre de al menos 6 letras, teléfono de 10 dígitos, foto con dirección `https`.

Una regla incumplida responde `400` con el mismo mensaje del formulario. El backend revisa antes lo que la base no ve, como los tres decimales (una columna `numeric(12,2)` los redondea sin avisar) o un plazo con decimales.

El prepago (en pantalla, "pago adelantado") solo se acepta con el crédito al día; ver "Pago adelantado por monto". El abono sí se acepta en un crédito `vencido`.

### Fondos de caja (T18, migración 014)

Dinero de la organización para sus actividades, aparte del que se presta. Cada caja crea sus fondos con nombre; cada uno tiene su saldo, sus depósitos y sus retiros. Los movimientos no se relacionan con socios. Los fondos no cuentan en el "disponible en caja" de Reportes (`en_caja`), que es el dinero para prestar. Los ve y los maneja el tesorero o el coordinador.

| Ruta                                              | Permiso                 | Cuerpo y respuesta                                                                                          |
| ------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /api/cajas/:cajaId/fondos`                   | `datos.ver`             | `{ fondos: [{ id, nombre, descripcion, saldo, activo, created_at }], total }`, abiertos primero              |
| `POST /api/cajas/:cajaId/fondos`                  | `fondos.gestionar`      | `{ nombre, descripcion? }` → `201 { fondo }`                                                                |
| `PUT /api/cajas/:cajaId/fondos/:fondoId`          | `fondos.gestionar`      | `{ nombre, descripcion? }` → `{ fondo }`                                                                    |
| `PUT /api/cajas/:cajaId/fondos/:fondoId/estado`   | `fondos.gestionar`      | `{ activo: boolean }` → `{ fondo }`. Cerrar pide saldo 0; un fondo cerrado se puede abrir de nuevo         |
| `GET /api/cajas/:cajaId/fondos/:fondoId/movimientos` | `datos.ver`          | `{ fondo, movimientos: [{ id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, fecha, created_at }] }`, el más reciente primero |
| `POST /api/cajas/:cajaId/fondos/:fondoId/deposito`, `/retiro` | `movimientos.registrar` | `{ monto, descripcion }` → `201 { movimiento, saldo_anterior, saldo_posterior }`                |

Reglas (en la base): nombre de 3 a 60 caracteres, único en la caja sin importar mayúsculas (`409`); descripción del fondo de hasta 200; monto mayor que 0 con hasta dos decimales; descripción del movimiento obligatoria, de 3 a 200 caracteres; un retiro no supera el saldo (`400`); un fondo cerrado no recibe movimientos (`409`). Nadie escribe un saldo ni un movimiento a mano, y los movimientos no se editan ni se borran. Prueba: `backend/pruebas/fondos.sql`.

### Reparto de intereses por ciclo (T23, migración 017)

El coordinador elige cómo se reparte el interés del ciclo actual: **diferenciada** (según el saldo de cada socio, mes a mes; la de siempre) o **equitativa** (el interés de cada mes en partes iguales entre los socios activos que ya habían ingresado ese mes). El tipo de un ciclo es el de la fila más reciente de `repartos_ciclo` con inicio igual o anterior al suyo; sin filas, diferenciada. Cambiarlo no toca los ciclos anteriores.

Cada socio recibe su total del ciclo redondeado hacia abajo al centavo. Los centavos que sobran se pasan a un fondo una sola vez por ciclo, cuando ya cerró.

| Ruta                                                     | Permiso            | Cuerpo y respuesta                                                                                                                         |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/cajas/:cajaId/reparto`                         | `caja.ver`         | `{ configurado, tipo, ciclo: { numero, label, inicio, fin } \| null }`, el tipo del ciclo actual                                           |
| `PUT /api/cajas/:cajaId/reparto`                         | `caja.configurar`  | `{ tipo: 'equitativa' \| 'diferenciada' }` → `{ message, tipo }`. Caja bloqueada: `409`                                                     |
| `GET /api/cajas/:cajaId/reportes/distribucion-interes?ciclo=` | `reportes.generar` | Agrega `tipo`; cada mes, `participantes` y `parte` (equitativa, si no `null`); `validacion.sobrante` (centavos que sobran) y `validacion.diferencia` (interés que nadie pudo recibir: meses sin socios o sin ahorro; `cuadra` es `diferencia = 0`); `sobrante_registrado: { monto, fondo, fecha } \| null` |
| `POST /api/cajas/:cajaId/reportes/sobrante`              | `fondos.gestionar` | `{ ciclo, fondo_id }` → `201 { message, sobrante: { monto, fecha } }`. El monto lo calcula el backend con el mismo reparto                   |

Reglas del sobrante (en la base, `pasar_sobrante_a_fondo`): el ciclo tiene que haber cerrado (`400`); el monto es mayor que 0 y no pasa de un centavo por socio (`400`); una segunda vez en el mismo ciclo, `409`; el depósito lo hace `registrar_movimiento_fondo`, así que un fondo cerrado responde `409`. El movimiento lleva la descripción «Centavos que sobraron del reparto de intereses del ciclo dd/mm/aaaa – dd/mm/aaaa». Prueba: `backend/pruebas/reparto.sql`.

### Reportes por las fechas del ciclo (T24, migración 018)

- **Socios del ciclo:** `distribucion-interes` incluye a los socios que estuvieron en el ciclo: ingresaron hasta su fin y no habían salido antes de su inicio, aunque hoy estén inactivos. Cada socio trae `activo` y `fecha_salida`. En la equitativa recibe los meses en que estuvo; el mes en que entró y el mes en que salió cuentan enteros.
- **Fecha de salida:** `socios.fecha_salida` la pone la base al desactivar la ficha (hoy) y la quita si vuelve a activarse. Nadie la escribe a mano. Prueba: `backend/pruebas/salida.sql`.
- **Saldos al corte:** `estado-caja` mide todo a `corte`: el fin del ciclo si ya cerró, hoy si está en curso. Devuelve `corte` y `ciclo.cerrado`. Al corte se calculan:
  - ahorros = suma de los movimientos hasta esa fecha;
  - por cobrar = saldo de cada crédito desembolsado hasta el corte, tomado de su último pago hasta esa fecha (`saldo_despues`), o `monto_total` si no había pagado;
  - interés cobrado hasta el corte;
  - disponible = ahorros + interés − por cobrar.
- **Mora:** solo se calcula en el ciclo en curso; en uno cerrado, `creditos.en_mora` es 0.
- **Lo que faltó por cobrar (T25):** `estado-caja` devuelve `falta_por_cobrar: { total, interes, cuotas, creditos }`. Es lo que no se había pagado al corte de las cuotas que vencieron dentro del ciclo; en uno en curso, solo las que vencieron antes de hoy. Usa el mismo análisis de cuotas que la mora, con los pagos hasta el corte.

### Pago adelantado por monto (T30, migración 013)

`GET …/pagos/proxima-cuota` trae `adelanto`:

- `{ disponible: true, maximo, cuotas: [{ numero_cuota, falta_capital, interes }] }`: las cuotas que se pueden adelantar, de la última a la primera, y el capital que suman.
- `{ disponible: false, motivo }`: por qué no. Pasa con el crédito no `activo`, con cuotas vencidas, con la cuota de este mes sin pagar, o cuando solo queda la próxima cuota.

`POST …/pagos/prepago { monto }` adelanta ese capital. El backend lo reparte desde la última cuota hacia atrás. Una cuota cubierta entera queda pagada y se condona su interés (`es_prepago`). La cuota que queda a medias recibe un pago de solo capital y conserva su interés completo: el interés es fijo cada mes. La próxima cuota por pagar no se adelanta; se paga en su mes.

Respuesta `201`: `{ pagos, capital_pagado, interes_condonado, cuotas_adelantadas: [6, 5], cuota_a_medias: { numero_cuota, capital } | null, saldo_pendiente, credito_pagado }`.

Errores `400`: el monto no es mayor que 0 o tiene más de dos decimales; el monto supera el máximo ("Se pueden adelantar hasta $X de capital."); o el `motivo` de `proxima-cuota`.

`registrar_pago_adelantado` registra todas las partes juntas, o ninguna. Además revisa que quien lo pide sea tesorero, que la caja sea operable y el crédito `activo`, que ninguna cuota venza este mes o antes, que no se repita una cuota y que el saldo no haya cambiado.

Las pruebas `backend/pruebas/aislamiento.sql` y `backend/pruebas/validacion.sql` se corren en el SQL Editor de Supabase y no dejan rastro.

---

## 1. Auth — `/api/auth`

### POST /api/auth/register

Crea un usuario nuevo en Supabase Auth. Con "Confirm email" activado en Supabase, la cuenta no entra hasta abrir el enlace del correo, que vuelve a `${FRONTEND_URL}/login`. Si el correo ya tenía cuenta, la respuesta es la misma (no se revela qué correos están registrados).

- Auth: No
- Body: `{ email, password }`. La contraseña: al menos 8 caracteres, con letras y números (`utils/contrasena.js`)
- 201: `{ message, confirmacion_pendiente, user: { id, email } }`; `confirmacion_pendiente` es `true` cuando no se abrió sesión y hay que confirmar el correo
- 429: `{ error }` si Supabase limita el envío de correos
- 400: `{ error, campo? }` si faltan campos, la contraseña no cumple la política (`campo: "password"`) o Supabase rechaza el registro

### POST /api/auth/login

Inicia sesión y devuelve el JWT de sesión.

- Auth: No
- Body: `{ email, password }`
- 200: `{ message, token, user: { id, email } }`
- 400: `{ error }` si faltan campos
- 401: `{ error: 'Credenciales incorrectas' }`
- 403: `{ error, codigo: 'correo_sin_confirmar' }` si la contraseña es correcta pero el correo no se confirmó
- 403: `{ error, codigo: 'cuenta_bloqueada', motivo, bloqueada_en }` si la contraseña es correcta pero la cuenta está bloqueada; no se entrega el token

### POST /api/auth/resend-confirmation

Reenvía el correo de confirmación de registro (el enlace vuelve a `${FRONTEND_URL}/login`).

- Auth: No
- Body: `{ email }`
- 200: `{ message }`
- 400: `{ error }`
- 429: `{ error }` si se pidieron demasiados correos seguidos

### POST /api/auth/forgot-password

Envía correo de recuperación de contraseña (redirige a `${FRONTEND_URL}/reset-password`).

- Auth: No
- Body: `{ email }`
- 200: `{ message }`
- 400: `{ error }`

### POST /api/auth/update-password

Actualiza la contraseña del usuario autenticado (requiere token, incluyendo el token de recuperación recibido por correo).

- Auth: Sí (Bearer token)
- Body: `{ password }` (al menos 8 caracteres, con letras y números)
- 200: `{ message }`
- 400: `{ error, campo? }` si la contraseña no cumple la política (`campo: "password"`) o Supabase rechaza el cambio
- 401: `{ error }` si la sesión no pudo establecerse

---

## 2. Perfiles — `/api/profiles`

Todas requieren Auth (Bearer token).

### GET /api/profiles/me

Devuelve el perfil del usuario autenticado, el estado de su cuenta y si administra DOMUS.

- 200: `{ profile, estado_cuenta: { estado, motivo, desde, cajas_activas }, es_admin_sistema }`
- `estado`: `'activa'` (miembro de al menos una caja) o `'inactiva'` (de ninguna). Los otros dos estados, `'pendiente'` (correo sin confirmar) y `'bloqueada'` (con `motivo` y `desde`), no llegan aquí porque esas cuentas no pasan la autenticación; se ven en el login y en el panel de administración.

- `profile`: `{ id, nombre, telefono, foto_url }`. `foto_url` es un enlace firmado a la foto de perfil, válido por una hora, o `null` si no hay foto (T17).
- 404: `{ error: 'Perfil no encontrado' }`

### PUT /api/profiles/me

Actualiza el perfil propio.

- Body (todos opcionales): `{ nombre, telefono }`. La foto va por `PUT /me/foto`; un `foto_url` en el cuerpo se ignora.
- 200: `{ message, profile }`
- 400: `{ error }` si no se envía ningún campo, o si el nombre o el teléfono no son válidos (lo dice la base)

### PUT /api/profiles/me/foto · DELETE /api/profiles/me/foto

Pone, cambia o quita la foto de perfil (T17). La ven la cuenta y quienes comparten una caja con ella.

- Body del PUT: la imagen tal cual, con `Content-Type: image/jpeg`, `image/png` o `image/webp`, hasta 2 MB. El frontend la reduce antes a 512 px.
- 200: `{ message, foto_url }`. Después del DELETE, `foto_url` es `null`.
- 400: `{ error }` si no es una imagen válida; 413 si pesa más de 2 MB

Se guarda en el bucket privado `perfiles`, en `{cuenta}/{uuid}.jpg`. `poner_foto_perfil` (migración 012) comprueba que la ruta sea de la cuenta y que el archivo exista, y devuelve la ruta anterior. El backend borra la foto anterior: cada cuenta tiene una sola.

---

## 3. Cajas — `/api/cajas`

Todas requieren Auth (Bearer token).

### GET /api/cajas/mis-cajas

Lista las cajas activas a las que pertenece el usuario, junto con su rol en cada una.

- 200: `{ cajas: [{ id, nombre, descripcion, rol, politicas_aceptadas, estado, estado_motivo, foto_url }], creacion }`.
- `politicas_aceptadas`: si aceptó la versión vigente de las políticas de esa caja (HU-S04).
- `foto_url`: enlace firmado de la foto de la caja, válido por una hora, o `null` (T17). Todos los enlaces se firman en una sola llamada.

### GET /api/cajas/:cajaId/foto · PUT · DELETE

La foto de la caja (T17).

- GET: permiso `caja.ver` (todo miembro). 200: `{ foto_url }`, firmado por una hora, o `null`.
- PUT y DELETE: permiso `caja.configurar` (coordinador), con la caja activa. El cuerpo del PUT es la imagen, igual que en `PUT /api/profiles/me/foto` (hasta 2 MB).
- 200: `{ message, foto_url }`
- 403: `{ error: 'Solo el coordinador cambia la foto de la caja' }`, cuando Storage la rechaza
- 409: `{ error: 'La caja no admite registros nuevos' }`

Se guarda en el bucket privado `cajas`, en `{caja}/{uuid}.jpg`. `poner_foto_caja` (migración 012) la revisa igual que la de perfil, y el backend borra la anterior.

### POST /api/cajas

Crea una caja con su periodo (asistente `/cajas/nueva`). El creador queda registrado como `coordinador` y se guarda su aceptación de las políticas de uso en `aceptaciones_politicas` (migración `002`).

- Body: `{ nombre, descripcion, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo?, politicas_version }`
  - `nombre`: obligatorio, hasta 80 caracteres (se quitan espacios de más). `descripcion`: obligatoria, hasta 300.
  - `fecha_fundacion`: `AAAA-MM-DD`, no posterior a hoy. `mes_inicio_ciclo`: entero 1–12. `duracion_ciclo`: entero 1–24, 12 si no se envía. Misma validación que `PUT /configuracion-ciclo`.
  - `politicas_version`: la versión de las políticas que se aceptó; tiene que ser la vigente (`utils/politicas.js`).
- 201: `{ message, caja: { id, nombre, descripcion, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo, rol }, ciclo_actual }`
- 400: `{ error, campo? }`; `campo` es `nombre` o `descripcion` cuando el fallo es de ese campo. Con una versión de políticas que no es la vigente, también `politicas_version` con la vigente
- 500: `{ error }` (si falla el registro del miembro o de la aceptación, la caja creada se borra)

### POST /api/cajas/:cajaId/politicas

Registra la aceptación de las políticas de uso de la caja (HU-S04). Aceptar dos veces no duplica la fila.

- Rol mínimo: `socio`
- Body: `{ version }`, que tiene que ser la vigente (`utils/politicas.js`)
- 201: `{ version, aceptada_en }` (200 si ya estaba aceptada)
- 400: `{ error, version }` si la versión no es la vigente

### GET /api/cajas/:cajaId/resumen

Devuelve el detalle de la caja, el rol del usuario y un resumen de indicadores (miembros, socios, saldo total en ahorros, créditos activos, saldo pendiente, últimas 5 transacciones). Rol mínimo: `tesorero` (permiso `datos.ver`).

- 200: `{ caja, rol, resumen: { totalMiembros, totalSocios, saldoTotal, creditosActivos, creditosEnMora, saldoPendiente }, transaccionesRecientes }`. `creditosActivos` y `saldoPendiente` cuentan los créditos `activo` y `vencido` (desembolsados y sin terminar de pagar); `creditosEnMora`, los que de esos tienen una cuota vencida sin pagar. Las `transaccionesRecientes` son las cinco de fecha más reciente (`fecha`, el día del movimiento; migración 015).
- 403: `{ error: 'Sin acceso a esta caja' }`

### PUT /api/cajas/:cajaId

Edita nombre/descripción de la caja.

- Rol mínimo: `coordinador`
- Body (al menos uno): `{ nombre?, descripcion? }`
- 200: `{ message, caja }`
- 400: `{ error }` si no se envían campos
- 403: `{ error: 'Tu rol no permite esta acción' }`

### GET /api/cajas/:cajaId/configuracion-credito

Reglas de crédito de la caja (Etapa 6, T12; migración `008`).

- Rol mínimo: `socio` (permiso `caja.ver`): todos los miembros saben cuánto se puede pedir
- 200: `{ monto_maximo_credito }`: número, o `null` si la caja no tiene límite

### PUT /api/cajas/:cajaId/configuracion-credito

Fija o quita el monto máximo de un crédito.

- Rol mínimo: `coordinador` (permiso `caja.configurar`)
- Body: `{ monto_maximo_credito: number | null }`. `null` quita el límite; un número tiene que ser mayor que 0 y con hasta dos decimales.
- 200: `{ message, monto_maximo_credito }`
- 400: falta el campo, o el monto no es válido
- La base lo aplica en cada solicitud nueva (`POST /creditos`): por encima responde 400 con "El monto máximo de crédito de esta caja es $1.500,00". Los créditos ya solicitados no cambian.

### POST /api/cajas/unirse

El usuario se une a una caja mediante un código de invitación. Quien fue removido de la caja vuelve a entrar con el rol del código nuevo. Si existe un socio en la caja con el mismo email (sin distinguir mayúsculas) y sin `user_id` vinculado, se vincula automáticamente.

- Body: `{ codigo }`
- 200: `{ message, socioVinculado, caja: { id, nombre, rol } }`
- 400: `{ error }` si falta el código o ya es miembro activo
- 404: `{ error: 'Código inválido o expirado' }`

---

## 4. Socios — `/api/cajas/:cajaId/socios`

Todas requieren Auth. Roles mínimos indicados por endpoint.

### GET /api/cajas/:cajaId/socios

Lista los socios de la caja, ordenados por apellido.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ socios }`
- 403: `{ error: 'Sin acceso a esta caja' }`

### GET /api/cajas/:cajaId/socios/:socioId

Detalle de un socio.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ socio }`
- 404: `{ error: 'Socio no encontrado' }`

### POST /api/cajas/:cajaId/socios

Registra un nuevo socio.

- Rol mínimo: `tesorero`
- Body: `{ nombre, apellido, cedula, telefono?, email?, direccion?, fecha_ingreso? }`
- 201: `{ message, socio }`
- 400: `{ error }` si faltan campos requeridos o la cédula ya existe en la caja

### PUT /api/cajas/:cajaId/socios/:socioId

Actualiza datos del socio.

- Rol mínimo: `tesorero`
- Body (al menos uno): `{ nombre?, apellido?, cedula?, telefono?, email?, direccion? }`
- 200: `{ message, socio }`
- 400: `{ error }` si no se envían campos

### DELETE /api/cajas/:cajaId/socios/:socioId

Desactiva (soft delete) un socio.

- Rol mínimo: `coordinador`
- 200: `{ message: 'Socio desactivado correctamente' }`

### GET /api/cajas/:cajaId/socios/:socioId/correcciones-ingreso

Correcciones de la fecha de ingreso del socio, la más reciente primero (Etapa 6, T14; migración `009`).

- Rol mínimo: `tesorero` (permiso `datos.ver`)
- 200: `{ correcciones: [{ id, fecha_anterior, fecha_nueva, motivo, corregido_por_nombre, creado_en }] }`

### POST /api/cajas/:cajaId/socios/:socioId/correcciones-ingreso

Corrige la fecha de ingreso. Es la única forma de cambiarla: `PUT /socios/:id` no la toca y la base no deja editar la columna.

- Rol mínimo: `coordinador` (permiso `socios.corregir_ingreso`)
- Body: `{ fecha_ingreso: 'AAAA-MM-DD', motivo }`
- 201: `{ message, id, fecha_anterior, fecha_ingreso }`
- 400: fecha mal escrita, motivo de menos de 10 caracteres, fecha futura, la misma fecha, o fecha nueva anterior al inicio del ciclo en curso ("La fecha nueva cae en un ciclo cerrado. Usa una fecha desde el 01/01/2026")
- 404: la ficha no es de esta caja
- 409: la fecha actual ya está en un ciclo cerrado (se usó para repartir intereses), o la caja está bloqueada
- La base (`corregir_fecha_ingreso`) cambia la fecha y registra la corrección en `correcciones_fecha_ingreso` en una sola transacción. Sin periodo configurado no hay ciclos cerrados.

---

## 5. Cuentas de ahorro — `/api/cajas/:cajaId/cuentas`

Todas requieren Auth.

### GET /api/cajas/:cajaId/cuentas

Lista todas las cuentas de ahorro de la caja, con datos del socio.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ cuentas }`

### GET /api/cajas/:cajaId/cuentas/mias

Las cuentas del usuario en esta caja ("Mis ahorros"). El servidor busca su ficha de socio: la vinculada a su cuenta o, si no hay, la que tiene su mismo correo sin distinguir mayúsculas, que queda vinculada.

- Rol mínimo: `socio`
- 200: `{ vinculado: true, socio: { id, nombre, apellido }, cuentas }` o `{ vinculado: false, cuentas: [] }`

### GET /api/cajas/:cajaId/cuentas/:cuentaId

Detalle de una cuenta y sus transacciones.

- Rol mínimo: `socio`, solo para sus propias cuentas (una ajena responde 404); `tesorero` y `coordinador`, cualquiera
- 200: `{ cuenta, transacciones }`. Cada transacción trae `fecha`, el día del movimiento (migración 015: hoy al registrarlo, el del Excel al importarlo), y `created_at`, cuándo se registró. Ordenadas por `fecha` y luego `created_at`, la más reciente primero.
- 404: `{ error: 'Cuenta no encontrada' }`

### GET /api/cajas/:cajaId/cuentas/socio/:socioId

Cuentas de un socio específico.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ cuentas }`

### POST /api/cajas/:cajaId/cuentas

Abre una nueva cuenta de ahorro (saldo inicial 0, número de cuenta autogenerado `CA-####`).

- Rol mínimo: `tesorero`
- Body: `{ socio_id }`
- 201: `{ message, cuenta }`
- 400: `{ error: 'El socio_id es requerido' }`
- 404: `{ error: 'Socio no encontrado en esta caja' }`

### POST /api/cajas/:cajaId/cuentas/:cuentaId/deposito

Registra un depósito y actualiza el saldo.

- Rol mínimo: `tesorero`
- Body: `{ monto, descripcion? }`
- 200: `{ message, transaccion, saldo_anterior, saldo_posterior }`
- 400: `{ error }` si el monto es inválido o la cuenta no está activa
- 404: `{ error: 'Cuenta no encontrada' }`

### POST /api/cajas/:cajaId/cuentas/:cuentaId/retiro

Registra un retiro, validando saldo suficiente.

- Rol mínimo: `tesorero`
- Body: `{ monto, descripcion? }`
- 200: `{ message, transaccion, saldo_anterior, saldo_posterior }`
- 400: `{ error }` si el monto es inválido, la cuenta no está activa, o el saldo es insuficiente
- 404: `{ error: 'Cuenta no encontrada' }`

### PUT /api/cajas/:cajaId/cuentas/:cuentaId/estado

Cambia el estado de la cuenta.

- Rol mínimo: `coordinador`
- Body: `{ estado }` — uno de `activa | cerrada | suspendida`
- 200: `{ message, cuenta }`
- 400: `{ error: 'Estado inválido' }`, o la cuenta tiene saldo y se pidió cerrarla (`DM400`: "Para cerrar la cuenta, el saldo tiene que estar en 0…"). Al cerrarla, la base pone `fecha_cierre` en hoy.
- 409: se pidió reabrir una cuenta cerrada y la ficha del titular está inactiva (`DM409`, migración `019`).

El detalle (`GET /:cuentaId`) trae `socios.activo`, para que la pantalla sepa si se puede reabrir.

---

## 6. Miembros de la caja — `/api/cajas/:cajaId/miembros`

Todas requieren Auth.

### GET /api/cajas/:cajaId/miembros

Lista los miembros de la caja con perfil y email.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ miembros: [{ id, rol, activo, created_at, profiles, email }] }`

### PUT /api/cajas/:cajaId/miembros/:userId

Cambia el rol de un miembro.

- Rol mínimo: `coordinador`
- Body: `{ nuevoRol }` — uno de `coordinador | tesorero | socio`
- 200: `{ message, miembro }`
- 400: `{ error: 'Rol inválido' }` o `{ error: 'No puedes cambiar tu propio rol' }`

### DELETE /api/cajas/:cajaId/miembros/:userId

Remueve (desactiva) a un miembro.

- Rol mínimo: `coordinador`
- 200: `{ message: 'Miembro removido correctamente' }`
- 400: `{ error: 'No puedes removerte a ti mismo' }`

### POST /api/cajas/:cajaId/miembros/invitaciones

Genera un código de invitación (8 caracteres, expira en 7 días). Desactiva cualquier código anterior sin usar.

- Rol mínimo: `coordinador`
- Body: `{ rolInvitado? }` (default `'socio'`)
- 201: `{ message, codigo, expira, rol }`

### GET /api/cajas/:cajaId/miembros/invitaciones

Devuelve el código de invitación activo (no usado, no expirado) más reciente de la caja.

- Rol mínimo: `coordinador`
- 200: `{ invitacion }` (o `null` si no hay ninguno activo)

---

## 7. Créditos — `/api/cajas/:cajaId/creditos`

Todas requieren Auth.

### GET /api/cajas/:cajaId/creditos

Lista los créditos de la caja con datos del socio.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ creditos }`. Cada crédito trae `mora`, calculada al leer (no se guarda): `{ cuotas_vencidas, monto_vencido, desde }` si tiene al menos una cuota vencida sin pagar, o `null` si está al día o no está en curso. Una cuota vence el último día de su mes y está vencida desde el mes siguiente; `desde` es el vencimiento de la más antigua. Solo los créditos `activo` o `vencido` pueden estar en mora.
- `estado` es el de la base: `pendiente`, `activo`, `pagado` o `vencido`. La mora no es un estado: un crédito `activo` puede estar en mora.
- `numero`: 1, 2, 3… dentro de la caja, en el orden de solicitud (migración `007`). Lo asigna la base al registrar la solicitud; lo que se envíe se ignora y después no se cambia. La tabla de amortización (`GET /creditos/:id/amortizacion`) también lo devuelve en `credito.numero`.

### GET /api/cajas/:cajaId/creditos/mios

Los créditos y solicitudes del usuario en esta caja ("Mis créditos", T27). La ficha se busca como en `GET /cuentas/mias`.

- Rol mínimo: `socio`
- 200: `{ vinculado: true, creditos }` (con `mora` como en el listado, sin datos del socio) o `{ vinculado: false, creditos: [] }`

### GET /api/cajas/:cajaId/creditos/:creditoId

Detalle de un crédito y sus pagos asociados.

- Rol mínimo: `socio`, solo para sus propios créditos (uno ajeno responde 404, igual que uno que no existe); `tesorero` y `coordinador`, cualquiera (T27). El RLS ya esconde lo ajeno; la ruta lo comprueba también
- 200: `{ credito, pagos }`; `credito.mora` como en el listado
- 404: `{ error: 'Crédito no encontrado' }`

`GET /creditos/:creditoId/amortizacion` y `GET /creditos/:creditoId/pagos/proxima-cuota` siguen la misma regla: el socio, solo en sus propios créditos. Registrar pagos, solicitar y aprobar sigue siendo del tesorero.

### GET /api/cajas/:cajaId/creditos/socio/:socioId

Créditos de un socio específico.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ creditos }`, con `mora` como en el listado

### POST /api/cajas/:cajaId/creditos

Crea una solicitud de crédito (estado `pendiente`). Calcula `monto_total` con interés simple anual proporcional al plazo, y `cuota_mensual`.

- Rol mínimo: `tesorero`
- Body: `{ socio_id, monto_solicitado, tasa_interes, plazo_meses }`
- 201: `{ message, credito }`
- 400: `{ error: 'Faltan campos requeridos' }`
- 404: `{ error: 'Socio no encontrado en esta caja' }`

### PUT /api/cajas/:cajaId/creditos/:creditoId/aprobar

Aprueba una solicitud pendiente: fija fecha de desembolso/vencimiento y pasa a estado `activo`.

- Rol mínimo: `tesorero`
- Body: `{ fecha_desembolso? }` (default: hoy)
- 200: `{ message, credito }`
- 400: `{ error: 'Sólo se pueden aprobar solicitudes pendientes' }`
- 404: `{ error: 'Crédito no encontrado' }`

### POST /api/cajas/:cajaId/creditos/:creditoId/pago

Registra un pago contra el crédito y actualiza `saldo_pendiente` (pasa a `pagado` si llega a 0).

- Rol mínimo: `tesorero`
- Body: `{ monto, descripcion? }`
- 200: `{ message, pago, credito }`
- 400: `{ error: 'Monto inválido' }` o `{ error: 'El crédito no está activo' }`
- 404: `{ error: 'Crédito no encontrado' }`

### PUT /api/cajas/:cajaId/creditos/:creditoId/estado

Cambia manualmente el estado del crédito.

- Rol mínimo: `coordinador`
- Body: `{ estado }` — uno de `pendiente | activo | pagado | mora | castigado`
- 200: `{ message, credito }`
- 400: `{ error: 'Estado inválido' }`

---

## 8. Pagos — `/api/cajas/:cajaId/pagos`

Todas requieren Auth. Estos endpoints manejan pagos por cuota (tabla `pagos_credito`), de forma similar pero independiente al endpoint `POST /creditos/:creditoId/pago`.

### GET /api/cajas/:cajaId/pagos

Lista todos los pagos registrados en la caja.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ pagos }`

### GET /api/cajas/:cajaId/pagos/:pagoId

Detalle de un pago.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ pago }`
- 404: `{ error: 'Pago no encontrado' }`

### GET /api/cajas/:cajaId/pagos/credito/:creditoId

Lista los pagos de un crédito, ordenados por número de cuota.

- Rol mínimo: `tesorero` (permiso `datos.ver`: el socio no ve los datos de los demás)
- 200: `{ pagos }`

### POST /api/cajas/:cajaId/pagos

Registra el pago de una cuota y actualiza el saldo pendiente del crédito (pasa a `pagado` si llega a 0).

- Rol mínimo: `tesorero`
- Body: `{ credito_id, numero_cuota, monto_pagado, saldo_antes, saldo_despues, fecha_pago? }`
- 200: `{ message, pago, credito }`
- 400: `{ error: 'Faltan campos requeridos' }`
- 404: `{ error: 'Crédito no encontrado' }`

---

## 8.1 Comprobantes (foto de un depósito, retiro o pago)

La foto es opcional y se agrega después de registrar el movimiento: el frontend registra primero y luego sube la foto; si la subida falla, el movimiento queda igual y la foto se puede agregar desde el historial. Un registro tiene a lo sumo una foto y no se cambia ni se quita.

La foto se guarda en el bucket privado `comprobantes`, en `{caja}/{socio}/{uuid}.jpg` (migración 010). Se sube con el token de la persona, así que las políticas del bucket deciden quién puede. Luego `adjuntar_comprobante` (migración 011) la une al registro: comprueba que la ruta sea de esa caja y ese socio, que el archivo exista y que el registro aún no tenga foto. La columna `comprobante` de `transacciones` y `pagos_credito` guarda la ruta.

### POST /api/cajas/:cajaId/cuentas/:cuentaId/movimientos/:movimientoId/comprobante

### POST /api/cajas/:cajaId/creditos/:creditoId/pagos/:pagoId/comprobante

Guardan la foto de un depósito o retiro, o de un pago (cuota, pago adelantado o abono).

- Rol mínimo: `tesorero` (permiso `movimientos.registrar`). La caja tiene que estar activa.
- Body: la imagen tal cual, no en JSON. Lleva `Content-Type: image/jpeg`, `image/png` o `image/webp`, y pesa hasta 5 MB. El frontend la reduce antes a JPEG de 1600 px por el lado mayor.
- 201: `{ message: 'Comprobante guardado', comprobante: true }`
- 400: `{ error }` si el tipo no es de imagen, el cuerpo está vacío o los primeros bytes no corresponden al tipo
- 403: `{ error: 'No tienes permiso para subir comprobantes en esta caja' }`, cuando Storage lo rechaza
- 404: `{ error: 'Movimiento no encontrado' }` o `{ error: 'Pago no encontrado' }`
- 409: `{ error: 'Este movimiento ya tiene su comprobante' }`; también `La caja no admite registros nuevos`
- 413: `{ error: 'La foto pesa más de 5 MB. Toma otra o redúcela.' }`

Si la base rechaza la unión después de subir, el backend borra esa foto recién subida con la clave de servicio, para que no queden archivos sueltos.

### GET …/movimientos/:movimientoId/comprobante · GET …/pagos/:pagoId/comprobante

Devuelven un enlace firmado para ver la foto.

- Permiso `caja.ver`. El tesorero ve los comprobantes de toda la caja; el socio, solo los de sus propias cuentas y créditos (lo deciden el RLS y la política del bucket).
- 200: `{ url, vence_en: 300 }`. El enlace vale 5 minutos.
- 404: `{ error: 'Este registro no tiene comprobante' }`, o el registro no se encuentra

---

## 8.2 Importación desde Excel — `/api/cajas/:cajaId/importar`

El frontend lee la plantilla y revisa el archivo (T21); aquí llegan las filas ya convertidas. La base (`importar_excel`, migración 016) vuelve a revisar todo y guarda todo o nada. Las reglas están en el encabezado de la migración.

### POST /api/cajas/:cajaId/importar/:modulo

`:modulo` es `socios`, `ahorros`, `creditos` o `fondos`.

- Permiso: el mismo que registrar a mano (`socios.gestionar`, `movimientos.registrar` o `fondos.gestionar`). La caja tiene que estar activa y tener fecha de fundación.
- Body (hasta 4 MB, más que el límite general): `{ filas: [...], simular?: boolean }`. Con `simular: true` la base hace la importación entera y la deshace: es la vista previa, con los saldos y números que quedarían de verdad.
- Filas, todas con `fila` (la de Excel, para los mensajes) y fechas `aaaa-mm-dd`:
  - socios: `{ cedula, nombre, apellido, fecha_ingreso, telefono, email, direccion }`
  - ahorros: `{ cedula, fecha, tipo: 'deposito' | 'retiro', monto, descripcion }`
  - fondos: `{ fondo, fecha, tipo, monto, descripcion }` (el nombre del fondo; si no existe, se crea)
  - creditos: `{ referencia, cedula, monto, tasa_interes, plazo_meses, fecha_desembolso, pagos: [{ fila, fecha, capital, interes }] }`
- 200 (simulacro) o 201: `{ simulado, ... }` con, según el módulo:
  - `socios: n`
  - `cuentas: [{ socio, numero_cuenta, nueva, movimientos, saldo_antes, saldo_despues }]`
  - `fondos: [{ fondo, nuevo, movimientos, saldo_antes, saldo_despues }]`
  - `creditos: [{ referencia, numero, socio, monto, estado, pagos, capital_pagado, interes_pagado, interes_condonado, saldo_pendiente }]`
- 400: `{ error }` con la hoja, la fila y la columna del primer problema, por ejemplo `Movimientos, fila 3 (Monto): El 01/06/2024 la cuenta de Ana Pérez tiene $100,50: no alcanza para retirar $200,00`. No se guarda nada.
- 404: módulo desconocido, o la caja no es de la persona. 409: `La caja no admite registros nuevos`.
- 413: `{ error: 'El archivo tiene demasiados datos (más de 4 MB). Divídelo en partes.' }`

Los pagos importados quedan con `es_importado = true` en `pagos_credito`.

---

## 9. Administración del sistema — `/api/admin`

Solo para las cuentas de la tabla `administradores_sistema` (`verifyToken` + `requiereAdminSistema`). No depende de ninguna caja.

### GET /api/admin/acuerdo

Versión vigente del acuerdo de confidencialidad (HU021) y si esta cuenta la aceptó.

- 200: `{ version, aceptado, aceptado_en }`

### POST /api/admin/acuerdo

Registra la aceptación del acuerdo (HU-S03). Aceptar dos veces no duplica la fila.

- Body: `{ version }`, que tiene que ser la vigente (`utils/confidencialidad.js`)
- 201: `{ version, aceptado_en }` (200 si ya estaba aceptada)
- 400: `{ error, version }` si la versión no es la vigente

Todas las demás rutas de `/api/admin` exigen la versión vigente aceptada; sin ella responden `403 { error, codigo: 'acuerdo_pendiente', version }`.

### GET /api/admin/cajas

Cada caja con su estado, fundación, ciclo vigente y conteos, sin montos (HU019, HU-S01). Las eliminadas no se listan.

- 200: `{ cajas: [{ id, nombre, creada_en, fecha_fundacion, ciclo_vigente, estado, estado_motivo, estado_cambiado_en, miembros, socios, creditos_vigentes }] }`. `estado`: `activa` o `bloqueada`; `estado_motivo` solo con `bloqueada`. `ciclo_vigente`: el ciclo en curso, como `"abr 2026 – mar 2027"`, o `null` sin fecha de fundación. `miembros`: cuentas con acceso activo; `socios`: fichas activas; `creditos_vigentes`: en estado `pendiente`, `activo` o `vencido`.

### POST /api/admin/cajas/:id/bloqueo · POST /api/admin/cajas/:id/restablecimiento

Bloquea o restablece una caja (HU020) y lo anota en la bitácora, en la misma transacción (`admin_estado_caja`, migración 006). Una caja bloqueada se sigue leyendo, pero nadie registra nada en ella, ni su coordinador puede desbloquearla (migración 004). Sus miembros ven el motivo en Mis cajas y dentro de la caja.

- Body: `{ motivo }`, de 10 a 500 caracteres
- 201 (bloqueo) / 200 (restablecimiento): `{ caja: { id, estado, estado_motivo, estado_cambiado_en } }`
- 400: motivo inválido (`campo: 'motivo'`) · 404: la caja no existe · 409: ya estaba bloqueada, no estaba bloqueada o fue eliminada

### GET /api/admin/cuentas

Cada cuenta de Supabase Auth con su estado, sus cajas y su rol en cada una.

- 200: `{ cuentas: [{ id, correo, nombre, creada_en, ultimo_ingreso, es_admin_sistema, cajas: [{ caja_id, nombre, rol }], estado, motivo, desde }] }`. `estado`: `pendiente`, `activa`, `inactiva` o `bloqueada`; `motivo` y `desde` solo con `bloqueada`.

### POST /api/admin/cuentas/:id/bloqueo

Bloquea una cuenta (HU-S02) y lo anota en la bitácora. Si la bitácora falla, el bloqueo se deshace.

- Body: `{ motivo }`, de 10 a 500 caracteres
- 201: `{ bloqueo: { motivo, bloqueada_en } }`
- 400: motivo inválido (`campo: 'motivo'`), la propia cuenta o la de otro administrador
- 404: la cuenta no existe · 409: ya estaba bloqueada

### POST /api/admin/cuentas/:id/restablecimiento

Quita el bloqueo y lo anota en la bitácora. Si la bitácora falla, el bloqueo vuelve.

- Body: `{ motivo }`, de 10 a 500 caracteres
- 200: `{ message }` · 400: motivo inválido · 404: la cuenta no existe · 409: no estaba bloqueada

### GET /api/admin/bitacora

Las últimas 200 acciones, la más reciente primero: bloqueos y restablecimientos, y aceptaciones del acuerdo de confidencialidad (HU021, T28).

- 200: `{ registros: [{ id, accion, cuenta_id, cuenta_correo, caja_id, caja_nombre, motivo, version, fecha, admin_correo }] }`. `accion`: `bloquear` o `restablecer` (sobre una cuenta: `cuenta_correo`) o `bloquear_caja` o `restablecer_caja` (sobre una caja: `caja_nombre`, el nombre al momento de la acción), o `aceptar_acuerdo` (`version` aceptada, `motivo` null, `admin_correo` es quien aceptó).
- Las aceptaciones se leen de `aceptaciones_confidencialidad` al consultar, no se copian a `bitacora_administracion`: salen también las de antes de T28.

---

## Pendientes — `/api/cajas/:cajaId/pendientes`

### GET /api/cajas/:cajaId/pendientes

Lo que muestra la campana de la barra superior (T29). Se calcula al leer, con el token de la persona; no se guarda ni se marca como leído.

- Rol mínimo: `socio`
- 200: `{ solicitudes, mora, ciclo_por_cerrar, nuevos_miembros, mis_cuotas }`
  - Solo `tesorero` y `coordinador` (para el socio, `null`): `solicitudes` (créditos `pendiente`), `mora` (`{ creditos, cuotas, monto }` de los créditos en mora, o `null`), `ciclo_por_cerrar` (`{ numero, label, fin, dias }` si el ciclo actual cierra en 30 días o menos, o `null`) y `nuevos_miembros` (`{ total, sin_ficha, dias: 14 }`: miembros activos que entraron en los últimos 14 días y cuántos no tienen ficha vinculada, o `null`).
  - Para todos: `mis_cuotas`, la próxima cuota de cada crédito en curso de la ficha de quien consulta (`{ credito_id, numero, numero_cuota, fecha_vencimiento, falta_total, dias, vencidas, monto_vencido }`), la que vence antes primero. Sin ficha, `[]`.

---

## Resumen de montaje de rutas (`server.js`)

```
/api/auth                      → auth.routes.js
/api/profiles                  → profile.routes.js
/api/cajas                     → cajas.routes.js
/api/cajas/:cajaId/socios      → socios.routes.js
/api/cajas/:cajaId/cuentas     → ahorros.routes.js
/api/cajas/:cajaId/miembros    → miembros.routes.js
/api/cajas/:cajaId/creditos    → creditos.routes.js
/api/cajas/:cajaId/pagos       → pagos.routes.js
/api/cajas/:cajaId/importar    → importacion.routes.js (con su propio límite de 4 MB)
/api/cajas/:cajaId/reportes    → reportes.routes.js
/api/admin                     → admin.routes.js
```
