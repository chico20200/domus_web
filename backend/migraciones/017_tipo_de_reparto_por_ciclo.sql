-- 017: Tipo de reparto de intereses por ciclo y sobrante a Fondos (Etapa 6, T23)
--
-- Decidido con el usuario (ESTADO.md, "Etapa 6: lo que ya entra"):
-- - Dos tipos: "diferenciada" (la de siempre: proporcional al saldo de cada socio, mes a
--   mes) y "equitativa" (el interés de cada mes en partes iguales entre las fichas
--   activas que ya habían ingresado ese mes).
-- - Cambiar el tipo solo afecta al ciclo actual. Cada cambio se guarda con la fecha de
--   inicio de ese ciclo; el tipo de un ciclo es el de la fila más reciente con inicio
--   igual o anterior al suyo. Sin filas, "diferenciada": los ciclos de antes quedan como
--   se calcularon, y un ciclo nuevo sigue con el último tipo elegido.
-- - Cada socio recibe su parte redondeada hacia abajo al centavo; los centavos que
--   sobran van a Fondos de caja. Con el ciclo ya cerrado, el tesorero los pasa a un fondo
--   con un botón en Reportes, una sola vez por ciclo (decidido el 26 nov). El backend
--   calcula el monto con el mismo reparto que muestra Reportes.

create table if not exists public.repartos_ciclo (
  caja_id uuid not null references public.cajas (id) on delete cascade,
  inicio date not null,
  tipo text not null check (tipo in ('diferenciada', 'equitativa')),
  cambiado_por uuid,
  updated_at timestamptz not null default now(),
  primary key (caja_id, inicio)
);
alter table public.repartos_ciclo enable row level security;
drop policy if exists "miembros ven el tipo de reparto" on public.repartos_ciclo;
create policy "miembros ven el tipo de reparto" on public.repartos_ciclo
  for select to authenticated using (private.tiene_rol(caja_id, 'socio'));
revoke all on public.repartos_ciclo from anon, authenticated;
grant select on public.repartos_ciclo to authenticated;

create table if not exists public.sobrantes_ciclo (
  caja_id uuid not null references public.cajas (id) on delete cascade,
  inicio date not null,
  fin date not null,
  monto numeric(12,2) not null check (monto > 0),
  fondo_id uuid not null references public.fondos_caja (id),
  movimiento_id uuid not null references public.movimientos_fondo (id),
  registrado_por uuid,
  created_at timestamptz not null default now(),
  primary key (caja_id, inicio)
);
alter table public.sobrantes_ciclo enable row level security;
drop policy if exists "tesorero ve los sobrantes" on public.sobrantes_ciclo;
create policy "tesorero ve los sobrantes" on public.sobrantes_ciclo
  for select to authenticated using (private.tiene_rol(caja_id, 'tesorero'));
revoke all on public.sobrantes_ciclo from anon, authenticated;
grant select on public.sobrantes_ciclo to authenticated;

-- El coordinador elige el tipo del ciclo actual
create or replace function public.cambiar_tipo_reparto(p_caja uuid, p_tipo text)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_inicio date;
begin
  if not private.tiene_rol(p_caja, 'coordinador') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  if p_tipo is null or p_tipo not in ('diferenciada', 'equitativa') then
    raise exception 'Elige la distribución equitativa o la diferenciada' using errcode = 'DM400';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite cambios' using errcode = 'DM409';
  end if;
  v_inicio := private.inicio_ciclo_vigente(p_caja, (now() at time zone 'America/Guayaquil')::date);
  if v_inicio is null then
    raise exception 'Configura el periodo de la caja antes de elegir el reparto' using errcode = 'DM400';
  end if;

  insert into public.repartos_ciclo (caja_id, inicio, tipo, cambiado_por)
  values (p_caja, v_inicio, p_tipo, auth.uid())
  on conflict (caja_id, inicio) do update
    set tipo = excluded.tipo, cambiado_por = excluded.cambiado_por, updated_at = now();

  return json_build_object('tipo', p_tipo, 'inicio', v_inicio);
end;
$$;

-- El tesorero pasa el sobrante de un ciclo cerrado a un fondo, una sola vez
create or replace function public.pasar_sobrante_a_fondo(
  p_caja uuid, p_inicio date, p_fin date, p_monto numeric, p_fondo uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_previo public.sobrantes_ciclo;
  v_socios int;
  v_mov json;
  v_fila public.sobrantes_ciclo;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  if p_inicio is null or p_fin is null or p_fin < p_inicio then
    raise exception 'Ciclo inválido' using errcode = 'DM400';
  end if;
  if p_fin >= v_hoy or p_inicio >= private.inicio_ciclo_vigente(p_caja, v_hoy) then
    raise exception 'El sobrante se pasa cuando el ciclo ya cerró' using errcode = 'DM400';
  end if;
  if p_monto is null or p_monto <= 0 or round(p_monto, 2) <> p_monto then
    raise exception 'No hay centavos que pasar' using errcode = 'DM400';
  end if;
  -- Cada socio deja menos de un centavo: el sobrante no puede ser mayor
  select count(*) into v_socios from public.socios where caja_id = p_caja;
  if p_monto > greatest(v_socios, 1) * 0.01 then
    raise exception 'El sobrante no puede ser mayor que un centavo por socio' using errcode = 'DM400';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sobrante:' || p_caja::text || p_inicio::text, 0));
  select * into v_previo from public.sobrantes_ciclo where caja_id = p_caja and inicio = p_inicio;
  if found then
    raise exception 'El sobrante de este ciclo ya se pasó a Fondos' using errcode = 'DM409';
  end if;

  -- El depósito lo hace la función de siempre: revisa el fondo, la caja y el rol
  v_mov := public.registrar_movimiento_fondo(p_caja, p_fondo, 'deposito', p_monto,
    'Centavos que sobraron del reparto de intereses del ciclo '
      || to_char(p_inicio, 'DD/MM/YYYY') || ' – ' || to_char(p_fin, 'DD/MM/YYYY'));

  insert into public.sobrantes_ciclo (caja_id, inicio, fin, monto, fondo_id, movimiento_id, registrado_por)
  values (p_caja, p_inicio, p_fin, p_monto, p_fondo, (v_mov->'movimiento'->>'id')::uuid, auth.uid())
  returning * into v_fila;

  return row_to_json(v_fila);
end;
$$;

revoke all on function public.cambiar_tipo_reparto(uuid, text) from public, anon;
grant execute on function public.cambiar_tipo_reparto(uuid, text) to authenticated;
revoke all on function public.pasar_sobrante_a_fondo(uuid, date, date, numeric, uuid) from public, anon;
grant execute on function public.pasar_sobrante_a_fondo(uuid, date, date, numeric, uuid) to authenticated;
