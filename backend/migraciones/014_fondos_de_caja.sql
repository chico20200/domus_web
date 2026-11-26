-- 014: Fondos de caja (Etapa 6, T18)
--
-- Dinero de la organización para sus actividades generales, aparte del que se presta.
-- Cada caja crea sus fondos con nombre ("Fondo social", "Fondo de actividades"…); cada
-- fondo tiene su saldo, sus depósitos y sus retiros. No toca a los socios ni a los
-- intereses, y no cuenta en el "disponible para prestar" de Reportes (ahorros + interés
-- cobrado − por cobrar), que no lee estas tablas. Decidido con el usuario el 26 nov: los
-- movimientos no se relacionan con socios.
--
-- Igual que los ahorros (004, 005): el saldo y los movimientos solo cambian con
-- funciones de la base, todo o nada, con el rol comprobado al empezar. Los ve y los
-- registra el tesorero (o el coordinador). Los movimientos no se editan ni se borran.

create table if not exists public.fondos_caja (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas (id) on delete cascade,
  nombre text not null,
  descripcion text,
  saldo numeric(12,2) not null default 0 check (saldo >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists fondos_caja_nombre_unico
  on public.fondos_caja (caja_id, lower(btrim(nombre)));

create table if not exists public.movimientos_fondo (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas (id) on delete cascade,
  fondo_id uuid not null references public.fondos_caja (id) on delete cascade,
  tipo text not null check (tipo in ('deposito', 'retiro')),
  monto numeric(12,2) not null check (monto > 0),
  saldo_anterior numeric(12,2) not null,
  saldo_posterior numeric(12,2) not null,
  descripcion text not null,
  fecha date not null default ((now() at time zone 'America/Guayaquil')::date),
  registrado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists movimientos_fondo_fondo on public.movimientos_fondo (fondo_id, created_at desc);
create index if not exists movimientos_fondo_caja on public.movimientos_fondo (caja_id);

alter table public.fondos_caja enable row level security;
alter table public.movimientos_fondo enable row level security;

revoke all on public.fondos_caja, public.movimientos_fondo from anon, authenticated;
grant select on public.fondos_caja, public.movimientos_fondo to authenticated;

drop policy if exists "tesorero ve los fondos" on public.fondos_caja;
create policy "tesorero ve los fondos" on public.fondos_caja for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero'));
drop policy if exists "tesorero ve los movimientos de fondos" on public.movimientos_fondo;
create policy "tesorero ve los movimientos de fondos" on public.movimientos_fondo for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero'));

-- Nombre de 3 a 60 caracteres y descripción de hasta 200 (los mismos mensajes que el formulario)
create or replace function private.validar_fondo(p_nombre text, p_descripcion text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if char_length(coalesce(btrim(p_nombre), '')) < 3 then
    raise exception 'El nombre del fondo debe tener al menos 3 caracteres' using errcode = 'DM400';
  end if;
  if char_length(btrim(p_nombre)) > 60 then
    raise exception 'El nombre del fondo admite hasta 60 caracteres' using errcode = 'DM400';
  end if;
  if char_length(coalesce(btrim(p_descripcion), '')) > 200 then
    raise exception 'La descripción admite hasta 200 caracteres' using errcode = 'DM400';
  end if;
end;
$$;

create or replace function public.crear_fondo(p_caja uuid, p_nombre text, p_descripcion text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_fondo public.fondos_caja;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  perform private.validar_fondo(p_nombre, p_descripcion);

  insert into public.fondos_caja (caja_id, nombre, descripcion)
  values (p_caja, btrim(p_nombre), nullif(btrim(p_descripcion), ''))
  returning * into v_fondo;
  return row_to_json(v_fondo);
exception when unique_violation then
  raise exception 'Ya hay un fondo con ese nombre en esta caja' using errcode = 'DM409';
end;
$$;

create or replace function public.editar_fondo(p_caja uuid, p_fondo uuid, p_nombre text, p_descripcion text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_fondo public.fondos_caja;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Fondo no encontrado' using errcode = 'DM404';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  perform private.validar_fondo(p_nombre, p_descripcion);

  update public.fondos_caja
  set nombre = btrim(p_nombre), descripcion = nullif(btrim(p_descripcion), ''), updated_at = now()
  where id = p_fondo and caja_id = p_caja
  returning * into v_fondo;
  if not found then
    raise exception 'Fondo no encontrado' using errcode = 'DM404';
  end if;
  return row_to_json(v_fondo);
exception when unique_violation then
  raise exception 'Ya hay un fondo con ese nombre en esta caja' using errcode = 'DM409';
end;
$$;

-- Cerrar un fondo pide saldo 0: el dinero se retira antes, con su motivo. Un fondo
-- cerrado no recibe movimientos y se puede volver a abrir.
create or replace function public.cambiar_estado_fondo(p_caja uuid, p_fondo uuid, p_activo boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_fondo public.fondos_caja;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Fondo no encontrado' using errcode = 'DM404';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  if p_activo is null then
    raise exception 'Estado inválido' using errcode = 'DM400';
  end if;

  select * into v_fondo from public.fondos_caja where id = p_fondo and caja_id = p_caja for update;
  if not found then
    raise exception 'Fondo no encontrado' using errcode = 'DM404';
  end if;
  if not p_activo and v_fondo.saldo <> 0 then
    raise exception 'Para cerrar el fondo, su saldo tiene que estar en $0. Hoy tiene $%',
      to_char(v_fondo.saldo, 'FM999999990.00') using errcode = 'DM409';
  end if;

  update public.fondos_caja set activo = p_activo, updated_at = now()
  where id = p_fondo returning * into v_fondo;
  return row_to_json(v_fondo);
end;
$$;

create or replace function public.registrar_movimiento_fondo(
  p_caja uuid, p_fondo uuid, p_tipo text, p_monto numeric, p_descripcion text
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_fondo public.fondos_caja;
  v_saldo_nuevo numeric(12,2);
  v_mov public.movimientos_fondo;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Fondo no encontrado' using errcode = 'DM404';
  end if;
  if p_tipo is null or p_tipo not in ('deposito', 'retiro') then
    raise exception 'Tipo de movimiento inválido' using errcode = 'DM400';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = 'DM400';
  end if;
  if round(p_monto, 2) <> p_monto then
    raise exception 'El monto admite hasta dos decimales' using errcode = 'DM400';
  end if;
  if char_length(coalesce(btrim(p_descripcion), '')) < 3 then
    raise exception 'Escribe para qué es el movimiento (al menos 3 caracteres)' using errcode = 'DM400';
  end if;
  if char_length(btrim(p_descripcion)) > 200 then
    raise exception 'La descripción admite hasta 200 caracteres' using errcode = 'DM400';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;

  select * into v_fondo from public.fondos_caja where id = p_fondo and caja_id = p_caja for update;
  if not found then
    raise exception 'Fondo no encontrado' using errcode = 'DM404';
  end if;
  if not v_fondo.activo then
    raise exception 'El fondo está cerrado. Ábrelo de nuevo para registrar movimientos' using errcode = 'DM409';
  end if;

  if p_tipo = 'retiro' then
    if p_monto > v_fondo.saldo then
      raise exception 'Saldo insuficiente en el fondo. Saldo disponible: $%',
        to_char(v_fondo.saldo, 'FM999999990.00') using errcode = 'DM400';
    end if;
    v_saldo_nuevo := v_fondo.saldo - p_monto;
  else
    v_saldo_nuevo := v_fondo.saldo + p_monto;
  end if;

  insert into public.movimientos_fondo
    (caja_id, fondo_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, registrado_por)
  values
    (p_caja, p_fondo, p_tipo, p_monto, v_fondo.saldo, v_saldo_nuevo, btrim(p_descripcion), auth.uid())
  returning * into v_mov;

  update public.fondos_caja set saldo = v_saldo_nuevo, updated_at = now() where id = p_fondo;

  return json_build_object(
    'movimiento', row_to_json(v_mov),
    'saldo_anterior', v_fondo.saldo,
    'saldo_posterior', v_saldo_nuevo
  );
end;
$$;

revoke execute on function public.crear_fondo(uuid, text, text) from public, anon;
revoke execute on function public.editar_fondo(uuid, uuid, text, text) from public, anon;
revoke execute on function public.cambiar_estado_fondo(uuid, uuid, boolean) from public, anon;
revoke execute on function public.registrar_movimiento_fondo(uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.crear_fondo(uuid, text, text) to authenticated;
grant execute on function public.editar_fondo(uuid, uuid, text, text) to authenticated;
grant execute on function public.cambiar_estado_fondo(uuid, uuid, boolean) to authenticated;
grant execute on function public.registrar_movimiento_fondo(uuid, uuid, text, numeric, text) to authenticated;
