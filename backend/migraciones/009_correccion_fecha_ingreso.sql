-- 009: el coordinador corrige la fecha de ingreso de un socio (Etapa 6, T14)
--
-- La fecha de ingreso decide en qué ciclos estuvo el socio y, con eso, el reparto de
-- intereses. Por eso no se edita como un dato más de la ficha:
--   - solo el coordinador, con un motivo, y en una caja que admite registros;
--   - ni la fecha de antes ni la nueva pueden caer en un ciclo cerrado: lo repartido en
--     un ciclo cerrado no se recalcula;
--   - no puede ser futura;
--   - cada corrección queda registrada con la fecha anterior, la nueva, el motivo y quién.
-- La única forma es la función corregir_fecha_ingreso: nadie cambia la columna a mano.

-- ─── Registro de correcciones ─────────────────────────────────────────────────────────
create table if not exists public.correcciones_fecha_ingreso (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas(id) on delete cascade,
  socio_id uuid not null references public.socios(id) on delete cascade,
  fecha_anterior date not null,
  fecha_nueva date not null,
  motivo text not null check (char_length(btrim(motivo)) >= 10),
  corregido_por uuid not null references auth.users(id),
  creado_en timestamptz not null default now()
);

create index if not exists correcciones_fecha_ingreso_socio_idx
  on public.correcciones_fecha_ingreso (socio_id, creado_en desc);

alter table public.correcciones_fecha_ingreso enable row level security;

-- La ve quien ve las fichas; solo la función escribe
revoke all on public.correcciones_fecha_ingreso from anon, authenticated;
grant select on public.correcciones_fecha_ingreso to authenticated;
drop policy if exists "tesorero ve las correcciones" on public.correcciones_fecha_ingreso;
create policy "tesorero ve las correcciones" on public.correcciones_fecha_ingreso
  for select to authenticated using (private.tiene_rol(caja_id, 'tesorero'));

-- La fecha de ingreso ya no se edita con un UPDATE directo
revoke update (fecha_ingreso) on public.socios from authenticated;

-- ─── Inicio del ciclo vigente ─────────────────────────────────────────────────────────
-- La misma cuenta que utils/ciclos.js: el primer ciclo empieza el día 1 del mes de inicio
-- en el año de fundación (o el anterior si la caja nació antes de ese mes), y cada ciclo
-- dura duracion_ciclo meses. Todo lo anterior a esta fecha está en ciclos cerrados.
-- null si la caja no tiene periodo configurado (entonces no hay ciclos cerrados).
create or replace function private.inicio_ciclo_vigente(p_caja uuid, p_hoy date)
returns date language sql stable set search_path = '' as $$
  with c as (
    select fecha_fundacion f, mes_inicio_ciclo m, duracion_ciclo d
    from public.cajas where id = p_caja and fecha_fundacion is not null
  ), primero as (
    select make_date(
      extract(year from f)::int - case when extract(month from f)::int < m then 1 else 0 end,
      m, 1) as p, d from c
  )
  select (p + make_interval(months =>
    greatest(0, ((extract(year from p_hoy)::int * 12 + extract(month from p_hoy)::int)
               - (extract(year from p)::int * 12 + extract(month from p)::int)) / d) * d))::date
  from primero
$$;

-- ─── Corregir ─────────────────────────────────────────────────────────────────────────
create or replace function public.corregir_fecha_ingreso(p_socio uuid, p_fecha date, p_motivo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_socio public.socios;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_inicio date;
begin
  select * into v_socio from public.socios where id = p_socio for update;
  -- Sin ficha visible o sin rol de coordinador, la misma respuesta: no revela fichas ajenas
  if not found or not private.tiene_rol(v_socio.caja_id, 'coordinador') then
    raise exception 'Ficha no encontrada' using errcode = 'DM404';
  end if;
  if not private.caja_operable(v_socio.caja_id) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  if char_length(v_motivo) < 10 then
    raise exception 'Escribe el motivo, con al menos 10 caracteres' using errcode = 'DM400';
  end if;
  if p_fecha is null then
    raise exception 'Indica la fecha de ingreso' using errcode = 'DM400';
  end if;
  if p_fecha > v_hoy then
    raise exception 'La fecha de ingreso no puede ser futura' using errcode = 'DM400';
  end if;
  if p_fecha = v_socio.fecha_ingreso then
    raise exception 'Es la misma fecha de ingreso que ya tiene' using errcode = 'DM400';
  end if;

  v_inicio := private.inicio_ciclo_vigente(v_socio.caja_id, v_hoy);
  if v_inicio is not null and v_socio.fecha_ingreso < v_inicio then
    raise exception 'La fecha de ingreso actual está en un ciclo cerrado: ya se usó para repartir intereses y no se corrige'
      using errcode = 'DM409';
  end if;
  if v_inicio is not null and p_fecha < v_inicio then
    raise exception 'La fecha nueva cae en un ciclo cerrado. Usa una fecha desde el %',
      to_char(v_inicio, 'DD/MM/YYYY') using errcode = 'DM400';
  end if;

  insert into public.correcciones_fecha_ingreso
    (caja_id, socio_id, fecha_anterior, fecha_nueva, motivo, corregido_por)
  values (v_socio.caja_id, p_socio, v_socio.fecha_ingreso, p_fecha, v_motivo, auth.uid());

  update public.socios set fecha_ingreso = p_fecha, updated_at = now() where id = p_socio;

  return json_build_object('id', p_socio, 'fecha_anterior', v_socio.fecha_ingreso, 'fecha_ingreso', p_fecha);
end;
$$;

revoke execute on function public.corregir_fecha_ingreso(uuid, date, text) from public, anon;
grant execute on function public.corregir_fecha_ingreso(uuid, date, text) to authenticated;
