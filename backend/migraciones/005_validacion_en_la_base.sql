-- 005: las reglas de los datos pasan a la base (Etapa 6, T8)
--
-- Por qué en la base y no solo en el backend: desde la 004 cada consulta de una caja usa
-- el token de la persona. Con ese token y la clave pública (que no es secreta) cualquiera
-- puede hablar directo con Supabase y saltarse las validaciones del backend. Las políticas
-- de fila ya deciden QUIÉN escribe; esta migración decide QUÉ se puede escribir:
--
--   1. Saldos y movimientos solo cambian por las funciones de la 004. Nadie escribe a
--      mano un saldo, un movimiento ni un pago.
--   2. Reglas de cada ficha, crédito, cuenta y perfil en triggers, con los mismos
--      mensajes que el frontend (frontend/src/lib/validacion.ts).
--
-- Los triggers distinguen quién escribe con current_user: 'authenticated' es una cuenta
-- desde la API; las funciones de escritura corren como su dueño y la clave de servicio
-- como service_role. Las reglas de forma (cédula, montos) se aplican a todos; las de
-- permiso (saldo inicial, cambios de estado) solo a las cuentas.
--
-- Errores: SQLSTATE DM400 con el mensaje para la persona (backend/utils/errores.js).

-- ─── 1. Permisos de escritura por columna ────────────────────────────────────────────

-- Nadie borra filas con la clave pública (tampoco había políticas de borrado)
revoke delete on all tables in schema public from anon, authenticated;

-- Movimientos y pagos: solo por registrar_movimiento y registrar_pago_credito
revoke insert, update on public.transacciones from anon, authenticated;
revoke insert, update on public.pagos_credito from anon, authenticated;
drop policy if exists "tesorero registra movimientos" on public.transacciones;
drop policy if exists "tesorero registra pagos" on public.pagos_credito;

-- Cuentas: el saldo no se edita; el estado sí (abrir va con saldo 0, ver el trigger)
revoke update on public.cuentas_ahorro from anon, authenticated;
grant update (estado, fecha_cierre, updated_at) on public.cuentas_ahorro to authenticated;

-- Créditos: montos y saldo no se editan; el estado y las fechas al aprobar, sí
revoke update on public.creditos from anon, authenticated;
grant update (estado, fecha_desembolso, fecha_vencimiento, aprobado_por, updated_at)
  on public.creditos to authenticated;

-- Perfil: lo crea handle_new_user; cada cuenta edita su nombre, teléfono y foto
revoke insert on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (nombre, telefono, foto_url, updated_at) on public.profiles to authenticated;

-- ─── 2. Las funciones de escritura corren como dueño ─────────────────────────────────
-- Al quitar el permiso de escribir movimientos y pagos, registrar_movimiento y
-- registrar_pago_credito ya no pueden correr con los permisos de quien llama. Pasan a
-- security definer y comprueban el rol al empezar (antes lo hacía el RLS). El resto del
-- cuerpo es el de la 004.

create or replace function public.registrar_movimiento(
  p_caja uuid, p_cuenta uuid, p_tipo public.tipo_transaccion, p_monto numeric, p_descripcion text default ''
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_cuenta public.cuentas_ahorro;
  v_saldo_nuevo numeric(12,2);
  v_tx public.transacciones;
begin
  -- Corre como dueño (005): el rol se comprueba aquí. Sin rol, la cuenta "no existe".
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Cuenta no encontrada' using errcode = 'DM404';
  end if;
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
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_credito public.creditos;
  v_total numeric(12,2);
  v_saldo_nuevo numeric(12,2);
  v_pago public.pagos_credito;
begin
  -- Corre como dueño (005): el rol se comprueba aquí. Sin rol, el crédito "no existe".
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Crédito no encontrado' using errcode = 'DM404';
  end if;
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

-- ─── 3. Reglas de forma ──────────────────────────────────────────────────────────────

-- "170 111-2223" → "1701112223" (el + del código de país se conserva)
create or replace function private.solo_digitos(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p, ''), '[[:space:]-]', '', 'g')
$$;

-- Cédula ecuatoriana: 10 dígitos, provincia 01–24 o 30, tercer dígito menor que 6 y
-- dígito verificador del módulo 10. La misma regla que validarCedula del frontend.
create or replace function private.cedula_valida(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  c text := private.solo_digitos(p);
  provincia int;
  suma int := 0;
  d int;
begin
  if c !~ '^[0-9]{10}$' then return false; end if;
  provincia := substr(c, 1, 2)::int;
  if not ((provincia between 1 and 24) or provincia = 30) then return false; end if;
  if substr(c, 3, 1)::int >= 6 then return false; end if;
  for i in 1..9 loop
    d := substr(c, i, 1)::int * case when i % 2 = 1 then 2 else 1 end;
    if d > 9 then d := d - 9; end if;
    suma := suma + d;
  end loop;
  return (10 - suma % 10) % 10 = substr(c, 10, 1)::int;
end;
$$;

-- Teléfono opcional: celular 09 de 10 dígitos, fijo 02–07 de 9, o con +593 sin el 0
create or replace function private.telefono_valido(p text) returns boolean
language sql immutable set search_path = '' as $$
  select private.solo_digitos(p) ~ '^(|09[0-9]{8}|0[2-7][0-9]{7}|\+5939[0-9]{8}|\+593[2-7][0-9]{7})$'
$$;

-- Correo opcional con la forma nombre@dominio.algo
create or replace function private.correo_valido(p text) returns boolean
language sql immutable set search_path = '' as $$
  select btrim(coalesce(p, '')) ~ '^(|[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+)$'
$$;

grant execute on all functions in schema private to authenticated;

-- ─── 4. Triggers ─────────────────────────────────────────────────────────────────────

-- Fichas de socio. La cédula, el teléfono y el correo se revisan al registrar y cuando
-- cambian: así una ficha antigua con una cédula que no cumple se puede seguir editando
-- (decisión del 12 nov, la misma del formulario).
create or replace function private.validar_ficha() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.nombre := btrim(coalesce(new.nombre, ''));
  new.apellido := btrim(coalesce(new.apellido, ''));
  if new.nombre = '' or new.apellido = '' then
    raise exception 'Nombre y apellido son requeridos' using errcode = 'DM400';
  end if;
  if length(new.nombre) > 80 or length(new.apellido) > 80 then
    raise exception 'El nombre y el apellido admiten hasta 80 caracteres' using errcode = 'DM400';
  end if;
  if tg_op = 'INSERT' or new.cedula is distinct from old.cedula then
    new.cedula := private.solo_digitos(new.cedula);
    if not private.cedula_valida(new.cedula) then
      raise exception 'La cédula no es válida: revisa los dígitos' using errcode = 'DM400';
    end if;
  end if;
  if tg_op = 'INSERT' or new.telefono is distinct from old.telefono then
    new.telefono := private.solo_digitos(new.telefono);
    if not private.telefono_valido(new.telefono) then
      raise exception 'Usa un celular de 10 dígitos (09…) o un fijo de 9 con el código de provincia'
        using errcode = 'DM400';
    end if;
  end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := btrim(coalesce(new.email, ''));
    if not private.correo_valido(new.email) then
      raise exception 'Revisa el correo: falta la @ o el dominio' using errcode = 'DM400';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_ficha on public.socios;
create trigger validar_ficha before insert or update on public.socios
  for each row execute function private.validar_ficha();

-- Créditos. Al solicitar: monto, tasa y plazo con sus límites, y la base calcula el
-- total, la cuota y el saldo (interés simple, como utils/amortizacion.js); una solicitud
-- nace pendiente. Después, una cuenta solo cambia el estado por los caminos permitidos;
-- "pagado" lo pone registrar_pago_credito al cubrir el saldo.
create or replace function private.validar_credito() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.monto_solicitado is null or new.monto_solicitado <= 0
       or round(new.monto_solicitado, 2) <> new.monto_solicitado then
      raise exception 'El monto debe ser mayor a 0, con hasta dos decimales' using errcode = 'DM400';
    end if;
    if new.tasa_interes is null or new.tasa_interes <= 0 or new.tasa_interes > 100
       or round(new.tasa_interes, 2) <> new.tasa_interes then
      raise exception 'La tasa anual va de 0,01 %% a 100 %%, con hasta dos decimales' using errcode = 'DM400';
    end if;
    if new.plazo_meses is null or new.plazo_meses < 1 or new.plazo_meses > 120 then
      raise exception 'El plazo va de 1 a 120 meses' using errcode = 'DM400';
    end if;
    if current_user = 'authenticated' then
      new.monto_total := round(new.monto_solicitado * (1 + new.tasa_interes / 100 * new.plazo_meses / 12.0), 2);
      new.cuota_mensual := round(new.monto_total / new.plazo_meses, 2);
      new.saldo_pendiente := new.monto_total;
      new.estado := 'pendiente';
      new.interes_condonado := 0;
      new.fecha_desembolso := null;
      new.fecha_vencimiento := null;
      new.aprobado_por := null;
    end if;
    return new;
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.estado is distinct from old.estado then
    if old.estado = 'pendiente' and new.estado = 'activo' then
      if new.fecha_desembolso is null or new.fecha_vencimiento is null then
        raise exception 'Falta la fecha de desembolso' using errcode = 'DM400';
      end if;
      new.aprobado_por := auth.uid();
    elsif (old.estado = 'activo' and new.estado = 'vencido')
       or (old.estado = 'vencido' and new.estado = 'activo') then
      null;
    else
      raise exception 'Un crédito % no puede pasar a %', old.estado, new.estado using errcode = 'DM400';
    end if;
  elsif new.fecha_desembolso is distinct from old.fecha_desembolso
     or new.fecha_vencimiento is distinct from old.fecha_vencimiento
     or new.aprobado_por is distinct from old.aprobado_por then
    raise exception 'Las fechas del crédito se fijan al aprobarlo' using errcode = 'DM400';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_credito on public.creditos;
create trigger validar_credito before insert or update on public.creditos
  for each row execute function private.validar_credito();

-- Cuentas de ahorro. Una cuenta nueva empieza activa y en 0 (el dinero entra con un
-- depósito, que deja su movimiento). Solo se cierra con saldo 0.
create or replace function private.validar_cuenta() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.saldo := 0;
    new.estado := 'activa';
    new.fecha_cierre := null;
    return new;
  end if;
  if new.estado = 'cerrada' and old.estado <> 'cerrada' then
    if old.saldo > 0 then
      raise exception 'Para cerrar la cuenta, el saldo tiene que estar en 0 ($% disponibles)',
        to_char(old.saldo, 'FM999999990.00') using errcode = 'DM400';
    end if;
    new.fecha_cierre := (now() at time zone 'America/Guayaquil')::date;
  elsif new.estado <> 'cerrada' then
    new.fecha_cierre := null;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_cuenta on public.cuentas_ahorro;
create trigger validar_cuenta before insert or update on public.cuentas_ahorro
  for each row execute function private.validar_cuenta();

-- Perfil (HU016): nombre de al menos 6 caracteres, solo letras, espacios, apóstrofo y
-- guion; teléfono opcional de 10 dígitos; la foto, una dirección https. Se revisa lo
-- que cambia, para no bloquear perfiles antiguos.
create or replace function private.validar_perfil() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.nombre is distinct from old.nombre then
    new.nombre := regexp_replace(btrim(coalesce(new.nombre, '')), '[[:space:]]+', ' ', 'g');
    if new.nombre = '' then
      raise exception 'Escribe tu nombre' using errcode = 'DM400';
    end if;
    if new.nombre !~ '^[[:alpha:]][[:alpha:]'' -]*$' then
      raise exception 'Usa solo letras y espacios' using errcode = 'DM400';
    end if;
    if length(new.nombre) < 6 then
      raise exception 'Escribe al menos 6 caracteres' using errcode = 'DM400';
    end if;
  end if;
  if new.telefono is distinct from old.telefono then
    new.telefono := private.solo_digitos(new.telefono);
    if new.telefono !~ '^([0-9]{10})?$' then
      raise exception 'El teléfono tiene exactamente 10 dígitos' using errcode = 'DM400';
    end if;
  end if;
  if new.foto_url is distinct from old.foto_url
     and coalesce(new.foto_url, '') <> '' and new.foto_url !~ '^https://' then
    raise exception 'La foto tiene que ser una dirección https' using errcode = 'DM400';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_perfil on public.profiles;
create trigger validar_perfil before update on public.profiles
  for each row execute function private.validar_perfil();
