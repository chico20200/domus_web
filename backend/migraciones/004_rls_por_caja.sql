-- 004: aislamiento entre cajas con RLS real (Etapa 6, T5; especificaciones §6.3 y §13.2)
--
-- Hasta aquí el backend usaba la clave de servicio, que ignora RLS, y las políticas que
-- había ("backend …", service_role, true) no aislaban nada. Desde la 004 cada consulta de
-- una caja se hace con el token del usuario, y estas políticas deciden qué ve y qué
-- escribe cada cuenta:
--
--   socio        ve su ficha, sus cuentas, sus movimientos, sus créditos y sus pagos
--   tesorero     ve y registra todo lo de la caja (fichas, cuentas, créditos, pagos)
--   coordinador  además configura la caja y gestiona miembros e invitaciones
--
-- Una caja que no está 'activa' (bloqueada por el administrador o eliminada) se puede
-- leer, pero no admite registros nuevos (HU020). Eso se cumple en las políticas de
-- escritura, con private.caja_operable().
--
-- Escrituras compuestas: supabase-js no tiene transacciones. Las que tocan dos tablas
-- pasan a funciones que son todo o nada:
--   registrar_movimiento    depósito o retiro: el movimiento y el saldo de la cuenta
--   registrar_pago_credito  pago, prepago o abono: el pago y el saldo del crédito
--   crear_caja              caja, coordinador y aceptación de políticas (límite de 3)
--   unirse_con_codigo       membresía, invitación usada y vínculo de la ficha
--   vincular_mi_ficha       la ficha con el mismo correo queda vinculada a la cuenta
--   correos_miembros        correos de los miembros (están en auth.users)
-- Las dos primeras corren con los permisos de quien llama (RLS aplica). Las otras cuatro
-- son security definer porque la persona todavía no puede hacer esa acción por su cuenta
-- (no es miembro, o no puede editar fichas), y cada una comprueba sus condiciones.
--
-- Errores: las funciones lanzan SQLSTATE 'DM' + código HTTP (DM400, DM403, DM404, DM409).
-- El backend traduce el código a la respuesta HTTP.
--
-- Es seguro aplicarla con el backend anterior: la clave de servicio ignora RLS y los
-- permisos por columna de authenticated. El comportamiento cambia con el backend de T6.

-- ─── Esquema privado: funciones auxiliares que PostgREST no expone ──────────────────

create schema if not exists private;
grant usage on schema private to authenticated;

-- ─── Estado de la caja ───────────────────────────────────────────────────────────────

alter table public.cajas
  add column if not exists estado text not null default 'activa'
    check (estado in ('activa', 'bloqueada', 'eliminada')),
  add column if not exists estado_motivo text,
  add column if not exists estado_cambiado_en timestamptz;

comment on column public.cajas.estado is
  'activa: opera. bloqueada: el administrador del sistema la bloqueó (HU020), solo lectura. eliminada: liquidada y cerrada (Etapa 7), solo lectura';

-- ─── Funciones auxiliares ────────────────────────────────────────────────────────────
-- security definer: leen miembros_caja y cajas sin pasar por sus propias políticas
-- (si no, la política de miembros_caja se llamaría a sí misma).

create or replace function private.nivel_rol(r public.rol_caja)
returns int language sql immutable set search_path = '' as $$
  select case r when 'socio' then 1 when 'tesorero' then 2 when 'coordinador' then 3 end
$$;

create or replace function private.rol_en_caja(p_caja uuid)
returns public.rol_caja language sql stable security definer set search_path = '' as $$
  select m.rol from public.miembros_caja m
  where m.caja_id = p_caja and m.user_id = auth.uid() and m.activo
  limit 1
$$;

-- Si quien llama es miembro activo de la caja con al menos ese rol
create or replace function private.tiene_rol(p_caja uuid, p_minimo public.rol_caja)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.nivel_rol(private.rol_en_caja(p_caja)) >= private.nivel_rol(p_minimo), false)
$$;

-- Si la caja admite registros nuevos
create or replace function private.caja_operable(p_caja uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cajas c where c.id = p_caja and c.estado = 'activa')
$$;

-- Si la ficha de socio está vinculada a quien llama
create or replace function private.es_mi_ficha(p_socio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.socios s where s.id = p_socio and s.user_id = auth.uid())
$$;

-- Si quien llama comparte alguna caja activa con esa cuenta (para leer su perfil)
create or replace function private.comparte_caja(p_usuario uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros_caja a
    join public.miembros_caja b on b.caja_id = a.caja_id
    where a.user_id = auth.uid() and a.activo and b.user_id = p_usuario and b.activo
  )
$$;

grant execute on all functions in schema private to authenticated;

-- ─── Permisos de tabla ───────────────────────────────────────────────────────────────
-- TRUNCATE no pasa por RLS: nadie con la clave pública lo necesita.
revoke truncate on all tables in schema public from anon, authenticated;

-- Columnas que un usuario no cambia nunca a mano: el estado y el creador de la caja (los
-- cambia el administrador del sistema o la liquidación), y el vínculo de una ficha con
-- una cuenta (lo hace vincular_mi_ficha).
revoke update on public.cajas from anon, authenticated;
grant update (nombre, descripcion, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo, updated_at)
  on public.cajas to authenticated;

revoke update on public.socios from anon, authenticated;
grant update (cedula, nombre, apellido, telefono, email, direccion, fecha_ingreso, activo, updated_at)
  on public.socios to authenticated;

revoke update on public.miembros_caja from anon, authenticated;
grant update (rol, activo) on public.miembros_caja to authenticated;

-- ─── Políticas ───────────────────────────────────────────────────────────────────────
-- Las de service_role sobran: esa clave ignora RLS.
drop policy if exists "backend cajas" on public.cajas;
drop policy if exists "backend creditos" on public.creditos;
drop policy if exists "backend cuentas" on public.cuentas_ahorro;
drop policy if exists "backend invitaciones" on public.invitaciones_caja;
drop policy if exists "backend miembros" on public.miembros_caja;
drop policy if exists "backend pagos" on public.pagos_credito;
drop policy if exists "backend socios" on public.socios;
drop policy if exists "backend transacciones" on public.transacciones;
-- El perfil lo crea handle_new_user, que es security definer: esta política dejaba a
-- cualquiera insertar perfiles.
drop policy if exists "trigger inserta perfil" on public.profiles;

-- cajas: la ve quien es miembro; la configura el coordinador mientras opere.
-- Crear una caja va por crear_caja; nadie la borra.
create policy "miembro ve la caja" on public.cajas for select to authenticated
  using (private.tiene_rol(id, 'socio'));
create policy "coordinador configura la caja" on public.cajas for update to authenticated
  using (private.tiene_rol(id, 'coordinador') and private.caja_operable(id))
  with check (private.tiene_rol(id, 'coordinador'));

-- miembros_caja: cada uno ve sus membresías; el tesorero ve las de su caja.
-- El coordinador cambia roles y quita miembros. Entrar va por crear_caja o unirse_con_codigo.
create policy "ve sus membresias y las de su caja" on public.miembros_caja for select to authenticated
  using (user_id = auth.uid() or private.tiene_rol(caja_id, 'tesorero'));
create policy "coordinador gestiona miembros" on public.miembros_caja for update to authenticated
  using (private.tiene_rol(caja_id, 'coordinador') and private.caja_operable(caja_id))
  with check (private.tiene_rol(caja_id, 'coordinador'));

-- invitaciones_caja: solo el coordinador. Usar un código va por unirse_con_codigo.
create policy "coordinador ve invitaciones" on public.invitaciones_caja for select to authenticated
  using (private.tiene_rol(caja_id, 'coordinador'));
create policy "coordinador crea invitaciones" on public.invitaciones_caja for insert to authenticated
  with check (private.tiene_rol(caja_id, 'coordinador') and private.caja_operable(caja_id)
              and creado_por = auth.uid());
create policy "coordinador desactiva invitaciones" on public.invitaciones_caja for update to authenticated
  using (private.tiene_rol(caja_id, 'coordinador') and private.caja_operable(caja_id))
  with check (private.tiene_rol(caja_id, 'coordinador'));

-- socios: el tesorero ve y registra las fichas; el socio ve la suya
create policy "tesorero o el propio socio ven la ficha" on public.socios for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') or user_id = auth.uid());
create policy "tesorero registra fichas" on public.socios for insert to authenticated
  with check (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id)
              and user_id is null);
create policy "tesorero edita fichas" on public.socios for update to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id))
  with check (private.tiene_rol(caja_id, 'tesorero'));

-- cuentas_ahorro: el tesorero abre y cambia cuentas de fichas de su misma caja
create policy "tesorero o el titular ven la cuenta" on public.cuentas_ahorro for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') or private.es_mi_ficha(socio_id));
create policy "tesorero abre cuentas" on public.cuentas_ahorro for insert to authenticated
  with check (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id)
              and exists (select 1 from public.socios s where s.id = socio_id and s.caja_id = cuentas_ahorro.caja_id));
create policy "tesorero cambia cuentas" on public.cuentas_ahorro for update to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id))
  with check (private.tiene_rol(caja_id, 'tesorero')
              and exists (select 1 from public.socios s where s.id = socio_id and s.caja_id = cuentas_ahorro.caja_id));

-- transacciones: se registran con registrar_movimiento; no se editan ni se borran
create policy "tesorero o el titular ven movimientos" on public.transacciones for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero')
         or exists (select 1 from public.cuentas_ahorro c where c.id = cuenta_id and private.es_mi_ficha(c.socio_id)));
create policy "tesorero registra movimientos" on public.transacciones for insert to authenticated
  with check (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id)
              and registrado_por = auth.uid()
              and exists (select 1 from public.cuentas_ahorro c where c.id = cuenta_id and c.caja_id = transacciones.caja_id));

-- creditos: el tesorero solicita, aprueba y cambia; el socio ve los suyos
create policy "tesorero o el titular ven el credito" on public.creditos for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') or private.es_mi_ficha(socio_id));
create policy "tesorero registra creditos" on public.creditos for insert to authenticated
  with check (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id)
              and exists (select 1 from public.socios s where s.id = socio_id and s.caja_id = creditos.caja_id));
create policy "tesorero cambia creditos" on public.creditos for update to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id))
  with check (private.tiene_rol(caja_id, 'tesorero')
              and exists (select 1 from public.socios s where s.id = socio_id and s.caja_id = creditos.caja_id));

-- pagos_credito: se registran con registrar_pago_credito; no se editan ni se borran
create policy "tesorero o el titular ven pagos" on public.pagos_credito for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero')
         or exists (select 1 from public.creditos k where k.id = credito_id and private.es_mi_ficha(k.socio_id)));
create policy "tesorero registra pagos" on public.pagos_credito for insert to authenticated
  with check (private.tiene_rol(caja_id, 'tesorero') and private.caja_operable(caja_id)
              and registrado_por = auth.uid()
              and exists (select 1 from public.creditos k where k.id = credito_id and k.caja_id = pagos_credito.caja_id));

-- aceptaciones_politicas: cada miembro ve y registra la suya
create policy "ve sus aceptaciones" on public.aceptaciones_politicas for select to authenticated
  using (user_id = auth.uid());
create policy "miembro acepta politicas" on public.aceptaciones_politicas for insert to authenticated
  with check (user_id = auth.uid() and private.tiene_rol(caja_id, 'socio'));

-- profiles: además del propio, el de quienes comparten una caja (lista de miembros)
create policy "ve perfiles de su caja" on public.profiles for select to authenticated
  using (private.comparte_caja(id));

-- Las tablas de administración (administradores_sistema, bloqueos_cuenta,
-- bitacora_administracion, aceptaciones_confidencialidad) siguen sin políticas: solo
-- las usa el backend con la clave de servicio, en el panel del administrador.

-- ─── Funciones de escritura ──────────────────────────────────────────────────────────

-- Depósito o retiro: bloquea la cuenta, comprueba, registra el movimiento y el saldo.
create or replace function public.registrar_movimiento(
  p_caja uuid, p_cuenta uuid, p_tipo public.tipo_transaccion, p_monto numeric, p_descripcion text default ''
) returns json language plpgsql security invoker set search_path = '' as $$
declare
  v_cuenta public.cuentas_ahorro;
  v_saldo_nuevo numeric(12,2);
  v_tx public.transacciones;
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0' using errcode = 'DM400';
  end if;
  if round(p_monto, 2) <> p_monto then
    raise exception 'El monto admite hasta dos decimales' using errcode = 'DM400';
  end if;

  -- Antes del FOR UPDATE: en una caja bloqueada el RLS esconde la fila
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;

  select * into v_cuenta from public.cuentas_ahorro
  where id = p_cuenta and caja_id = p_caja for update;
  if not found then
    raise exception 'Cuenta no encontrada' using errcode = 'DM404';
  end if;
  if v_cuenta.estado <> 'activa' then
    raise exception 'La cuenta no está activa' using errcode = 'DM400';
  end if;

  if p_tipo = 'retiro' then
    if p_monto > v_cuenta.saldo then
      raise exception 'Saldo insuficiente. Saldo disponible: $%', to_char(v_cuenta.saldo, 'FM999999990.00')
        using errcode = 'DM400';
    end if;
    v_saldo_nuevo := v_cuenta.saldo - p_monto;
  else
    v_saldo_nuevo := v_cuenta.saldo + p_monto;
  end if;

  insert into public.transacciones
    (caja_id, cuenta_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, registrado_por)
  values
    (p_caja, p_cuenta, p_tipo, p_monto, v_cuenta.saldo, v_saldo_nuevo, coalesce(p_descripcion, ''), auth.uid())
  returning * into v_tx;

  update public.cuentas_ahorro set saldo = v_saldo_nuevo, updated_at = now()
  where id = p_cuenta and caja_id = p_caja;

  return json_build_object(
    'transaccion', row_to_json(v_tx),
    'saldo_anterior', v_cuenta.saldo,
    'saldo_posterior', v_saldo_nuevo
  );
end;
$$;

-- Pago de cuota, prepago o abono. El backend calcula la cuota y los montos con la tabla
-- de amortización (utils/amortizacion.js) y los manda junto con el saldo que vio. Aquí se
-- bloquea el crédito y, si el saldo cambió entre el cálculo y la escritura (otro pago al
-- mismo tiempo), se rechaza para que se calcule de nuevo.
create or replace function public.registrar_pago_credito(
  p_caja uuid,
  p_credito uuid,
  p_saldo_esperado numeric,
  p_numero_cuota int,
  p_capital numeric,
  p_interes numeric,
  p_tipo text,                       -- 'cuota' | 'prepago' | 'abono'
  p_motivo text default null,
  p_interes_condonado numeric default 0,
  p_fecha date default null
) returns json language plpgsql security invoker set search_path = '' as $$
declare
  v_credito public.creditos;
  v_total numeric(12,2);
  v_saldo_nuevo numeric(12,2);
  v_pago public.pagos_credito;
begin
  if p_tipo not in ('cuota', 'prepago', 'abono') then
    raise exception 'Tipo de pago inválido' using errcode = 'DM400';
  end if;
  if coalesce(p_capital, -1) < 0 or coalesce(p_interes, -1) < 0 or coalesce(p_interes_condonado, -1) < 0 then
    raise exception 'Los montos no pueden ser negativos' using errcode = 'DM400';
  end if;
  v_total := p_capital + p_interes;
  if v_total <= 0 then
    raise exception 'No hay nada pendiente por pagar en esta cuota' using errcode = 'DM400';
  end if;
  if p_tipo = 'abono' and coalesce(btrim(p_motivo), '') = '' then
    raise exception 'El motivo del abono es requerido' using errcode = 'DM400';
  end if;

  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;

  select * into v_credito from public.creditos
  where id = p_credito and caja_id = p_caja for update;
  if not found then
    raise exception 'Crédito no encontrado' using errcode = 'DM404';
  end if;
  -- Solo créditos desembolsados y sin terminar: un crédito pendiente todavía no se
  -- entregó, y cobrarle interés inflaría el reparto de todos (decisión del 25 nov)
  if v_credito.estado not in ('activo', 'vencido') then
    raise exception 'Solo se registran pagos de créditos activos' using errcode = 'DM400';
  end if;
  if v_credito.saldo_pendiente <> p_saldo_esperado then
    raise exception 'El crédito cambió mientras se registraba el pago. Vuelve a intentarlo.'
      using errcode = 'DM409';
  end if;
  if p_numero_cuota is null or p_numero_cuota < 1 or p_numero_cuota > v_credito.plazo_meses then
    raise exception 'Número de cuota inválido' using errcode = 'DM400';
  end if;
  -- Nadie paga más de lo que debe (un centavo de holgura por redondeo de las cuotas).
  -- Agregado después como 004c, al ver créditos activos con saldo 0 en los datos.
  if v_total + p_interes_condonado > v_credito.saldo_pendiente + 0.01 then
    raise exception 'El pago supera el saldo pendiente del crédito ($%)',
      to_char(v_credito.saldo_pendiente, 'FM999999990.00') using errcode = 'DM400';
  end if;

  v_saldo_nuevo := greatest(v_credito.saldo_pendiente - v_total - p_interes_condonado, 0);

  insert into public.pagos_credito
    (caja_id, credito_id, fecha_pago, numero_cuota, monto_pagado, monto_capital, monto_interes,
     es_prepago, es_abono, motivo, saldo_antes, saldo_despues, registrado_por)
  values
    (p_caja, p_credito, coalesce(p_fecha, (now() at time zone 'America/Guayaquil')::date), p_numero_cuota,
     v_total, p_capital, p_interes, p_tipo = 'prepago', p_tipo = 'abono',
     case when p_tipo = 'abono' then btrim(p_motivo) end,
     v_credito.saldo_pendiente, v_saldo_nuevo, auth.uid())
  returning * into v_pago;

  update public.creditos set
    saldo_pendiente = v_saldo_nuevo,
    estado = case when v_saldo_nuevo <= 0.001 then 'pagado'::public.estado_credito else estado end,
    interes_condonado = coalesce(interes_condonado, 0) + p_interes_condonado,
    updated_at = now()
  where id = p_credito and caja_id = p_caja;

  return json_build_object(
    'pago', row_to_json(v_pago),
    'saldo_pendiente', v_saldo_nuevo,
    'credito_pagado', v_saldo_nuevo <= 0.001
  );
end;
$$;

-- Crea la caja con su periodo, deja a quien la crea como coordinador y guarda su
-- aceptación de las políticas. Una cuenta crea hasta tres cajas (decisión del 25 nov);
-- las eliminadas no cuentan. Los textos ya llegan validados por el backend.
create or replace function public.crear_caja(
  p_nombre text, p_descripcion text, p_fecha_fundacion date, p_mes_inicio int, p_duracion int,
  p_politicas_version text
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := auth.uid();
  v_caja public.cajas;
begin
  if v_usuario is null then
    raise exception 'Sin sesión' using errcode = 'DM403';
  end if;
  -- Dos pedidos a la vez de la misma cuenta no pasan juntos el límite
  perform pg_advisory_xact_lock(hashtext('crear_caja:' || v_usuario::text));
  if (select count(*) from public.cajas where creado_por = v_usuario and estado <> 'eliminada') >= 3 then
    raise exception 'Ya creaste tres cajas, que es el máximo por cuenta' using errcode = 'DM409';
  end if;

  insert into public.cajas (nombre, descripcion, creado_por, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo)
  values (p_nombre, p_descripcion, v_usuario, p_fecha_fundacion, p_mes_inicio, p_duracion)
  returning * into v_caja;

  insert into public.miembros_caja (caja_id, user_id, rol) values (v_caja.id, v_usuario, 'coordinador');
  insert into public.aceptaciones_politicas (caja_id, user_id, version)
  values (v_caja.id, v_usuario, p_politicas_version);

  return json_build_object(
    'id', v_caja.id, 'nombre', v_caja.nombre, 'descripcion', v_caja.descripcion,
    'fecha_fundacion', v_caja.fecha_fundacion, 'mes_inicio_ciclo', v_caja.mes_inicio_ciclo,
    'duracion_ciclo', v_caja.duracion_ciclo
  );
end;
$$;

-- Vincula a quien llama la ficha de la caja que tiene su mismo correo y todavía no tiene
-- cuenta. Compara el correo completo sin mayúsculas (sin comodines de LIKE). Devuelve la
-- ficha vinculada, la que ya estaba vinculada, o null.
create or replace function public.vincular_mi_ficha(p_caja uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := auth.uid();
  v_correo text;
  v_ficha public.socios;
begin
  if private.rol_en_caja(p_caja) is null then
    raise exception 'Sin acceso a esta caja' using errcode = 'DM403';
  end if;

  select * into v_ficha from public.socios where caja_id = p_caja and user_id = v_usuario limit 1;
  if found then
    return json_build_object('id', v_ficha.id, 'nombre', v_ficha.nombre, 'apellido', v_ficha.apellido,
                             'activo', v_ficha.activo, 'nueva', false);
  end if;

  select lower(btrim(u.email)) into v_correo from auth.users u where u.id = v_usuario;
  if coalesce(v_correo, '') = '' then return null; end if;

  update public.socios set user_id = v_usuario, updated_at = now()
  where id = (
    select s.id from public.socios s
    where s.caja_id = p_caja and s.user_id is null and lower(btrim(s.email)) = v_correo
    order by s.activo desc, s.created_at
    limit 1
  )
  returning * into v_ficha;

  if not found then return null; end if;
  return json_build_object('id', v_ficha.id, 'nombre', v_ficha.nombre, 'apellido', v_ficha.apellido,
                           'activo', v_ficha.activo, 'nueva', true);
end;
$$;

-- Usa un código de invitación: entra a la caja con el rol del código (o vuelve, si lo
-- habían quitado), marca el código como usado y vincula su ficha.
create or replace function public.unirse_con_codigo(p_codigo text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_usuario uuid := auth.uid();
  v_inv public.invitaciones_caja;
  v_caja public.cajas;
  v_previo public.miembros_caja;
  v_ficha json;
begin
  if v_usuario is null then
    raise exception 'Sin sesión' using errcode = 'DM403';
  end if;

  select * into v_inv from public.invitaciones_caja
  where codigo = upper(btrim(p_codigo)) and activo and usado_por is null and expira_at > now()
  for update;
  if not found then
    raise exception 'Código inválido o expirado' using errcode = 'DM404';
  end if;

  select * into v_caja from public.cajas where id = v_inv.caja_id;
  if v_caja.estado <> 'activa' then
    raise exception 'Esta caja no admite miembros nuevos' using errcode = 'DM409';
  end if;

  select * into v_previo from public.miembros_caja
  where caja_id = v_inv.caja_id and user_id = v_usuario for update;
  if found and v_previo.activo then
    raise exception 'Ya perteneces a esta caja' using errcode = 'DM400';
  elsif found then
    update public.miembros_caja set activo = true, rol = v_inv.rol where id = v_previo.id;
  else
    insert into public.miembros_caja (caja_id, user_id, rol) values (v_inv.caja_id, v_usuario, v_inv.rol);
  end if;

  update public.invitaciones_caja set usado_por = v_usuario, usado_at = now(), activo = false
  where id = v_inv.id;

  v_ficha := public.vincular_mi_ficha(v_inv.caja_id);

  return json_build_object(
    'caja', json_build_object('id', v_caja.id, 'nombre', v_caja.nombre, 'rol', v_inv.rol),
    'socio_vinculado', v_ficha is not null
  );
end;
$$;

-- Correos de los miembros de una caja, para la lista de Configuración. Los correos están
-- en auth.users, que la clave pública no lee. Solo para el tesorero o el coordinador.
create or replace function public.correos_miembros(p_caja uuid)
returns table (user_id uuid, email text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Tu rol no permite esta acción' using errcode = 'DM403';
  end if;
  return query
    select m.user_id, u.email::text from public.miembros_caja m
    join auth.users u on u.id = m.user_id
    where m.caja_id = p_caja;
end;
$$;

-- Solo usuarios con sesión llaman a estas funciones
revoke execute on function public.registrar_movimiento(uuid, uuid, public.tipo_transaccion, numeric, text) from public, anon;
revoke execute on function public.registrar_pago_credito(uuid, uuid, numeric, int, numeric, numeric, text, text, numeric, date) from public, anon;
revoke execute on function public.crear_caja(text, text, date, int, int, text) from public, anon;
revoke execute on function public.vincular_mi_ficha(uuid) from public, anon;
revoke execute on function public.unirse_con_codigo(text) from public, anon;
revoke execute on function public.correos_miembros(uuid) from public, anon;
grant execute on function public.registrar_movimiento(uuid, uuid, public.tipo_transaccion, numeric, text) to authenticated;
grant execute on function public.registrar_pago_credito(uuid, uuid, numeric, int, numeric, numeric, text, text, numeric, date) to authenticated;
grant execute on function public.crear_caja(text, text, date, int, int, text) to authenticated;
grant execute on function public.vincular_mi_ficha(uuid) to authenticated;
grant execute on function public.unirse_con_codigo(text) to authenticated;
grant execute on function public.correos_miembros(uuid) to authenticated;

-- ─── Ajuste del trigger de perfiles (aplicado aparte como 004b) ──────────────────────
-- handle_new_user solo la llama el trigger on_auth_user_created: nadie la necesita por
-- la API. Sin search_path fijo, una función security definer es atacable.
alter function public.handle_new_user() set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;
