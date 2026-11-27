-- 020: Periodos de membresía (Etapa 7, T2)
--
-- Hasta aquí cada ficha tenía una sola fecha de ingreso y una de salida (migración 018),
-- y Reportes las usaba para saber en qué ciclos estuvo un socio. Con la salida y el
-- reingreso (T4, T8) eso no alcanza: reactivar a alguien borraba su salida y lo contaba
-- también en los meses en que estuvo fuera. Desde aquí:
-- - Cada ficha tiene uno o más periodos (ingreso, salida); el último puede estar abierto.
-- - Los lleva la base, con un trigger sobre socios; nadie los escribe a mano:
--   · ficha nueva: su primer periodo (el de la importación puede llegar ya cerrado);
--   · desactivar la ficha: cierra el periodo abierto con su fecha de salida;
--   · reactivarla: abre un periodo nuevo desde hoy (hora de Ecuador);
--   · corregir la fecha de ingreso (T14, migración 009): cambia el inicio del primero.
-- - socios.fecha_ingreso sigue siendo el primer ingreso y socios.fecha_salida la última
--   salida (null mientras está activo), como antes.
-- - Las fichas de hoy pasan con un periodo: sus dos fechas.

create table if not exists public.periodos_socio (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas (id) on delete cascade,
  socio_id uuid not null references public.socios (id) on delete cascade,
  ingreso date not null,
  salida date,
  created_at timestamptz not null default now(),
  constraint periodo_salida_despues_del_ingreso check (salida is null or salida >= ingreso)
);
create index if not exists periodos_socio_socio_idx on public.periodos_socio (socio_id, ingreso);
-- A lo más un periodo abierto por ficha
create unique index if not exists periodos_socio_abierto_idx
  on public.periodos_socio (socio_id) where salida is null;

comment on table public.periodos_socio is
  'Periodos en que una ficha estuvo activa en su caja (ingreso, salida). Los lleva el trigger llevar_periodos de socios (migración 020).';

alter table public.periodos_socio enable row level security;
drop policy if exists "tesorero o el titular ven los periodos" on public.periodos_socio;
create policy "tesorero o el titular ven los periodos" on public.periodos_socio
  for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') or private.es_mi_ficha(socio_id));
revoke all on public.periodos_socio from anon, authenticated;
grant select on public.periodos_socio to authenticated;

-- Después del trigger anotar_salida (018), que ya dejó fecha_salida al día
create or replace function private.llevar_periodos()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_primero uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.periodos_socio (caja_id, socio_id, ingreso, salida)
    values (new.caja_id, new.id, coalesce(new.fecha_ingreso, v_hoy),
            case when new.activo then null else new.fecha_salida end);
    return null;
  end if;

  -- Corrección de la fecha de ingreso: el inicio del primer periodo
  if new.fecha_ingreso is distinct from old.fecha_ingreso and new.fecha_ingreso is not null then
    select id into v_primero from public.periodos_socio
     where socio_id = new.id order by ingreso limit 1;
    if exists (select 1 from public.periodos_socio
                where id = v_primero and salida is not null and salida < new.fecha_ingreso) then
      raise exception 'La fecha de ingreso no puede ser posterior a su primera salida'
        using errcode = 'DM409';
    end if;
    update public.periodos_socio set ingreso = new.fecha_ingreso where id = v_primero;
  end if;

  if new.activo is distinct from old.activo then
    if new.activo then
      -- Reingreso: un periodo nuevo desde hoy
      insert into public.periodos_socio (caja_id, socio_id, ingreso)
      values (new.caja_id, new.id, v_hoy)
      on conflict do nothing;
    else
      update public.periodos_socio
         set salida = greatest(ingreso, coalesce(new.fecha_salida, v_hoy))
       where socio_id = new.id and salida is null;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists llevar_periodos on public.socios;
create trigger llevar_periodos after insert or update on public.socios
  for each row execute function private.llevar_periodos();

-- Las fichas de hoy: un periodo con sus dos fechas
insert into public.periodos_socio (caja_id, socio_id, ingreso, salida)
select s.caja_id, s.id,
       coalesce(s.fecha_ingreso, (s.created_at at time zone 'America/Guayaquil')::date),
       case when s.activo then null
            else coalesce(s.fecha_salida, s.fecha_ingreso, (s.created_at at time zone 'America/Guayaquil')::date) end
  from public.socios s
 where not exists (select 1 from public.periodos_socio p where p.socio_id = s.id);
