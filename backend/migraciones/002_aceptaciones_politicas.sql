-- 002: registro de la aceptación de las políticas de uso de una caja (HU022, §5.1 paso 2)
--
-- Cada fila dice que una cuenta aceptó una versión de las políticas de una caja, y cuándo.
-- Hoy se escribe al crear la caja (asistente de /cajas/nueva). La Etapa 5 la reutiliza
-- para pedir la aceptación al entrar a cada caja (HU-S04): si las políticas cambian de
-- versión, cada miembro vuelve a aceptarlas y queda una fila nueva, sin borrar la vieja.
--
-- Esquema revisado el 13 nov 2026: cajas.id y auth.users.id son uuid; miembros_caja,
-- socios e invitaciones_caja se borran en cascada con su caja, y esta tabla hace lo mismo.
--
-- Acceso: el backend usa la clave de servicio, que no pasa por RLS. Se activa RLS sin
-- políticas para que la clave pública (anon / authenticated) no pueda leer ni escribir.
--
-- CUÁNDO EJECUTARLO: antes de desplegar el backend de la rama etapa-4. Sin la tabla,
-- crear una caja falla (el backend borra la caja recién creada y responde 500).
--
-- Se ejecuta en el editor SQL de Supabase.

create table public.aceptaciones_politicas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  caja_id     uuid not null references public.cajas (id) on delete cascade,
  version     text not null,
  aceptada_en timestamptz not null default now(),
  unique (user_id, caja_id, version)
);

comment on table public.aceptaciones_politicas is
  'Aceptación de las políticas de uso de una caja (HU022) por cuenta y versión';

alter table public.aceptaciones_politicas enable row level security;

-- Comprobación: debe devolver la tabla con RLS activado (relrowsecurity = true)
select relname, relrowsecurity from pg_class where oid = 'public.aceptaciones_politicas'::regclass;

-- Para deshacerlo:
-- drop table public.aceptaciones_politicas;
