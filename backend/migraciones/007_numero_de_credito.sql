-- 007: número de crédito por caja (Etapa 6, T11)
--
-- Cada caja numera sus créditos 1, 2, 3… en el orden en que se solicitan. El número
-- identifica el crédito al hablar con el socio, en la búsqueda y en las exportaciones,
-- sin mostrar el id interno. Lo pone la base al insertar: nadie lo elige ni lo cambia
-- (la 005 ya limita el UPDATE de las cuentas a estado y fechas).

alter table public.creditos add column if not exists numero integer;

-- Créditos que ya existen: por fecha de desembolso (la solicitud, si aún no se desembolsa),
-- luego por fecha de registro. Los datos de demostración comparten created_at.
with orden as (
  select id, row_number() over (
    partition by caja_id
    order by coalesce(fecha_desembolso, created_at::date), created_at, id
  ) as n
  from public.creditos
)
update public.creditos c set numero = orden.n
from orden
where orden.id = c.id and c.numero is null;

alter table public.creditos alter column numero set not null;
alter table public.creditos drop constraint if exists creditos_caja_numero_key;
alter table public.creditos add constraint creditos_caja_numero_key unique (caja_id, numero);

-- El siguiente número de la caja. El candado por caja ordena dos solicitudes que llegan
-- a la vez; sin él las dos leerían el mismo máximo. Se suelta al terminar la transacción.
create or replace function private.numerar_credito() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('numero_credito:' || new.caja_id::text, 0));
  select coalesce(max(numero), 0) + 1 into new.numero
  from public.creditos where caja_id = new.caja_id;
  return new;
end;
$$;

-- "numerar_credito" corre antes que "validar_credito" (orden alfabético), da igual: no
-- dependen entre sí
drop trigger if exists numerar_credito on public.creditos;
create trigger numerar_credito before insert on public.creditos
  for each row execute function private.numerar_credito();
