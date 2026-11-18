-- 003: administración del sistema (HU019 a HU021, Etapa 5)
--
-- Cuatro tablas:
--   administradores_sistema        quién administra DOMUS (HU-S01)
--   bloqueos_cuenta                cuentas bloqueadas, con su motivo (HU-S02, estado de la cuenta)
--   bitacora_administracion        cada bloqueo y cada restablecimiento, con su motivo (HU-S02)
--   aceptaciones_confidencialidad  aceptación del acuerdo de confidencialidad (HU-S03)
--
-- Por qué tablas aparte y no columnas en profiles: profiles es la fila que cada usuario
-- edita de sí mismo. Si alguna política de RLS de profiles permite la actualización
-- propia, una columna es_admin_sistema o bloqueada ahí se podría cambiar con la clave
-- pública. Estas tablas tienen RLS activado y ninguna política: solo las lee y escribe el
-- backend, con la clave de servicio.
--
-- El estado de la cuenta (Pendiente, Activa, Inactiva, Bloqueada) no se guarda: solo el
-- bloqueo. Los otros tres se calculan (correo sin confirmar, miembro de alguna caja o no).
--
-- CUÁNDO EJECUTARLO: antes de desplegar el backend de la rama etapa-5. Sin
-- bloqueos_cuenta, toda petición autenticada falla. Requiere la 002 ejecutada antes.
--
-- Se ejecuta en el editor SQL de Supabase.

create table public.administradores_sistema (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

comment on table public.administradores_sistema is
  'Cuentas que administran DOMUS (HU019). Se agregan a mano con SQL; no hay pantalla para hacerse administrador';

create table public.bloqueos_cuenta (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  motivo        text not null check (char_length(btrim(motivo)) >= 10),
  bloqueada_en  timestamptz not null default now(),
  bloqueada_por uuid references auth.users (id) on delete set null
);

comment on table public.bloqueos_cuenta is
  'Cuentas bloqueadas por la administración (HU020). Restablecer borra la fila; la historia queda en bitacora_administracion';

create table public.bitacora_administracion (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid references auth.users (id) on delete set null,
  accion         text not null check (accion in ('bloquear', 'restablecer')),
  usuario_id     uuid references auth.users (id) on delete set null,
  -- El correo se copia para que la bitácora siga diciendo de quién era si la cuenta se borra
  usuario_correo text not null,
  motivo         text not null check (char_length(btrim(motivo)) >= 10),
  creado_en      timestamptz not null default now()
);

create index bitacora_administracion_creado_en on public.bitacora_administracion (creado_en desc);

comment on table public.bitacora_administracion is
  'Bitácora de bloqueos y restablecimientos de cuentas (HU-S02). Solo se agregan filas';

create table public.aceptaciones_confidencialidad (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  version     text not null,
  aceptada_en timestamptz not null default now(),
  unique (user_id, version)
);

comment on table public.aceptaciones_confidencialidad is
  'Aceptación del acuerdo de confidencialidad del panel de administración (HU021) por cuenta y versión';

alter table public.administradores_sistema       enable row level security;
alter table public.bloqueos_cuenta               enable row level security;
alter table public.bitacora_administracion       enable row level security;
alter table public.aceptaciones_confidencialidad enable row level security;

-- Comprobación: las cuatro tablas con RLS activado (relrowsecurity = true)
select relname, relrowsecurity
from pg_class
where oid in (
  'public.administradores_sistema'::regclass,
  'public.bloqueos_cuenta'::regclass,
  'public.bitacora_administracion'::regclass,
  'public.aceptaciones_confidencialidad'::regclass
);

-- Para nombrar a un administrador del sistema (cambiar el correo):
-- insert into public.administradores_sistema (user_id)
-- select id from auth.users where email = 'correo@ejemplo.com';
--
-- Para quitarlo:
-- delete from public.administradores_sistema
-- where user_id = (select id from auth.users where email = 'correo@ejemplo.com');

-- Para deshacer la migración:
-- drop table public.aceptaciones_confidencialidad;
-- drop table public.bitacora_administracion;
-- drop table public.bloqueos_cuenta;
-- drop table public.administradores_sistema;
