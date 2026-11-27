-- 018: Fecha de salida del socio (Etapa 6, T24)
--
-- Reportes de un ciclo muestra a los socios que estuvieron en él, aunque hoy estén
-- inactivos (ESTADO.md, "Agregado el 25 nov"). Hasta ahora desactivar una ficha solo
-- ponía activo = false y no quedaba cuándo. Desde aquí:
-- - La base pone fecha_salida (hoy, hora de Ecuador) cuando la ficha pasa a inactiva y
--   la quita si vuelve a activarse. Nadie la escribe a mano: no está en el UPDATE por
--   columnas que tiene authenticated (migración 004).
-- - Un socio estuvo en un ciclo si ingresó hasta el fin del ciclo y no había salido
--   antes de su inicio. En la equitativa recibe la parte de los meses en que estuvo,
--   contando entero el mes en que entró y el mes en que salió.
-- - Las fichas que ya estaban inactivas toman la fecha de su última modificación (la
--   mejor aproximación que hay), nunca antes de su ingreso.

alter table public.socios add column if not exists fecha_salida date;

update public.socios
   set fecha_salida = greatest(fecha_ingreso, (updated_at at time zone 'America/Guayaquil')::date)
 where not activo and fecha_salida is null;

alter table public.socios drop constraint if exists salida_despues_del_ingreso;
alter table public.socios add constraint salida_despues_del_ingreso
  check (fecha_salida is null or fecha_ingreso is null or fecha_salida >= fecha_ingreso);

create or replace function private.anotar_salida_socio()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    new.fecha_salida := case when new.activo then null
      else coalesce(new.fecha_salida, (now() at time zone 'America/Guayaquil')::date) end;
  elsif new.activo is distinct from old.activo then
    new.fecha_salida := case when new.activo then null
      else greatest(new.fecha_ingreso, (now() at time zone 'America/Guayaquil')::date) end;
  else
    new.fecha_salida := old.fecha_salida;
  end if;
  return new;
end;
$$;

drop trigger if exists anotar_salida on public.socios;
create trigger anotar_salida before insert or update on public.socios
  for each row execute function private.anotar_salida_socio();
