-- Prueba de las reglas de los datos en la base (Etapa 6, T8; migración 005).
--
-- QUÉ HACE: crea dentro de una transacción una caja con su tesorero, y se hace pasar por
-- él para escribir directo en las tablas, como podría hacerlo alguien con su token y la
-- clave pública sin pasar por el backend. Comprueba que la base rechaza los datos mal
-- formados y las escrituras que solo deben pasar por las funciones de la 004.
--
-- NO DEJA RASTRO y no depende de los datos de la base, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "VALIDACION: 45 de 45 casos pasan" y la lista de casos.

begin;

-- ─── Ayudas (solo existen durante esta transacción) ──────────────────────────────────

create temp table resultados (n serial, caso text, ok boolean, detalle text) on commit drop;
grant insert, select on resultados to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

-- Actúa como una cuenta (rol authenticated con ese sub) o, con null, como visitante sin sesión
create function pg_temp.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  if p_usuario is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

-- Cuenta filas visibles con la sesión actual
create function pg_temp.contar(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n;
end $$;

-- Ejecuta y devuelve el SQLSTATE del error, o 'sin error'
create function pg_temp.error_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'sin error';
exception when others then
  return sqlstate;
end $$;

create function pg_temp.anotar(p_caso text, p_ok boolean, p_detalle text) returns void
language sql as $$ insert into resultados (caso, ok, detalle) values (p_caso, p_ok, p_detalle) $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

create temp table ids (tes uuid, caja uuid, ficha uuid, cuenta uuid, credito uuid) on commit drop;
grant select on ids to authenticated, anon;

-- ─── Datos de prueba ─────────────────────────────────────────────────────────────────

do $datos$
declare
  tes uuid := 'd0000000-0000-4000-8000-00000000000a';
  v json;
  caja uuid; ficha uuid; cuenta uuid; credito uuid;
begin
  insert into auth.users (id, email, aud, role)
  values (tes, 'tes.validacion@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(tes);
  v := public.crear_caja('Caja de validación', 'Prueba de reglas', '2025-01-01', 1, 12, 'prueba');
  caja := (v->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido)
  values (caja, '1710034065', 'Sofía', 'Andrade') returning id into ficha;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta)
  values (caja, ficha, 'CA-VAL-1') returning id into cuenta;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses,
                               monto_total, cuota_mensual, saldo_pendiente)
  values (caja, ficha, 300, 12, 3, 0, 0, 0) returning id into credito;
  perform pg_temp.como(null);
  perform set_config('role', 'postgres', true);
  insert into ids values (tes, caja, ficha, cuenta, credito);
end
$datos$;

-- ─── Casos ───────────────────────────────────────────────────────────────────────────

do $casos$
declare
  i ids;
  n bigint;
  e text;
  t text;
  ins_ficha text := 'insert into public.socios (caja_id, cedula, nombre, apellido, telefono, email) values (%L, %L, %L, ''Prueba'', %L, %L)';
  ins_credito text := 'insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses, monto_total, cuota_mensual, saldo_pendiente) values (%L, %L, %s, %s, %s, 1, 1, 1)';
begin
  select * into i from ids;
  perform pg_temp.como(i.tes);

  -- Fichas
  e := pg_temp.error_de(format(ins_ficha, i.caja, '1710034066', 'Uno', '', ''));
  perform pg_temp.anotar('Ficha con dígito verificador mal: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_ficha, i.caja, '5010034065', 'Dos', '', ''));
  perform pg_temp.anotar('Ficha con provincia inexistente: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_ficha, i.caja, '0912345675', 'Tres', '12345', ''));
  perform pg_temp.anotar('Ficha con teléfono de 5 dígitos: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_ficha, i.caja, '0912345675', 'Cuatro', '', 'sin-arroba.com'));
  perform pg_temp.anotar('Ficha con correo sin @: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_ficha, i.caja, '0912345675', '   ', '', ''));
  perform pg_temp.anotar('Ficha sin nombre: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_ficha, i.caja, '091 234-5675', 'Cinco', '+593 99 123 4567', ''));
  t := (select cedula || ' ' || telefono from public.socios where caja_id = i.caja and nombre = 'Cinco');
  perform pg_temp.anotar('Ficha con espacios y guiones: se guarda solo con dígitos',
    e = 'sin error' and t = '0912345675 +593991234567', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format(ins_ficha, i.caja, '1104680135', 'Seis', '022345678', 'Seis@Correo.ec'));
  perform pg_temp.anotar('Ficha con fijo de Quito y correo: aceptada', e = 'sin error', e);
  e := pg_temp.error_de(format(ins_ficha, i.caja, '1104680135', 'Siete', '', ''));
  perform pg_temp.anotar('Cédula repetida en la caja: rechazada', e = '23505', e);

  -- Una ficha antigua con cédula que no cumple se sigue editando si no se toca la cédula
  perform set_config('role', 'postgres', true);
  alter table public.socios disable trigger validar_ficha;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (i.caja, '1234567890', 'Antigua', 'Ficha');
  alter table public.socios enable trigger validar_ficha;
  perform pg_temp.como(i.tes);
  e := pg_temp.error_de(format('update public.socios set telefono = ''0991234567'' where caja_id = %L and nombre = ''Antigua''', i.caja));
  perform pg_temp.anotar('Ficha antigua: se edita sin tocar la cédula', e = 'sin error', e);
  e := pg_temp.error_de(format('update public.socios set cedula = ''1234567891'' where caja_id = %L and nombre = ''Antigua''', i.caja));
  perform pg_temp.anotar('Ficha antigua: una cédula nueva inválida se rechaza', e = 'DM400', e);
  e := pg_temp.error_de(format('delete from public.socios where caja_id = %L', i.caja));
  perform pg_temp.anotar('Nadie borra fichas', e = '42501', e);

  -- Créditos: solicitud
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '-50', '12', '6'));
  perform pg_temp.anotar('Crédito con monto negativo: rechazado', e in ('DM400', '23514'), e);
  -- La columna es numeric(12,2): la base redondea antes del trigger. El rechazo de los
  -- tres decimales lo hace el backend (POST /creditos), como en los depósitos.
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '100.555', '12', '6'));
  t := (select string_agg(monto_solicitado::text, ',') from public.creditos where caja_id = i.caja and plazo_meses = 6);
  perform pg_temp.anotar('Crédito con tres decimales: la columna lo deja en dos', e = 'sin error' and t = '100.56', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '100', '150', '6'));
  perform pg_temp.anotar('Crédito con tasa de 150 %: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '100', '12', '121'));
  perform pg_temp.anotar('Crédito a 121 meses: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '100', '12', '0'));
  perform pg_temp.anotar('Crédito a 0 meses: rechazado', e in ('DM400', '23514'), e);
  t := (select monto_total || ' ' || cuota_mensual || ' ' || saldo_pendiente || ' ' || estado
        from public.creditos where id = i.credito);
  perform pg_temp.anotar('Solicitud con totales falsos: la base calcula total, cuota y saldo',
    t = '309.00 103.00 309.00 pendiente', t);

  -- Créditos: cambios
  e := pg_temp.error_de(format('update public.creditos set saldo_pendiente = 0 where id = %L', i.credito));
  perform pg_temp.anotar('Nadie edita a mano el saldo de un crédito', e = '42501', e);
  e := pg_temp.error_de(format('update public.creditos set estado = ''pagado'' where id = %L', i.credito));
  perform pg_temp.anotar('Un crédito pendiente no pasa a pagado', e = 'DM400', e);
  e := pg_temp.error_de(format('update public.creditos set estado = ''activo'' where id = %L', i.credito));
  perform pg_temp.anotar('Aprobar sin fechas: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format('update public.creditos set estado = ''activo'', fecha_desembolso = ''2025-02-01'', fecha_vencimiento = ''2025-05-01'' where id = %L', i.credito));
  t := (select estado || ' ' || (aprobado_por = i.tes) from public.creditos where id = i.credito);
  perform pg_temp.anotar('Aprobar con fechas: activo y queda quién aprobó', e = 'sin error' and t = 'activo true', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format('update public.creditos set fecha_desembolso = ''2024-01-01'' where id = %L', i.credito));
  perform pg_temp.anotar('Cambiar la fecha de un crédito ya aprobado: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format('update public.creditos set estado = ''pendiente'' where id = %L', i.credito));
  perform pg_temp.anotar('Un crédito activo no vuelve a pendiente', e = 'DM400', e);
  e := pg_temp.error_de(format('select public.registrar_pago_credito(%L, %L, 309, 1, 100, 3, ''cuota'')', i.caja, i.credito));
  t := (select saldo_pendiente::text from public.creditos where id = i.credito);
  perform pg_temp.anotar('El pago por la función sigue funcionando', e = 'sin error' and t = '206.00', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format('insert into public.pagos_credito (caja_id, credito_id, numero_cuota, monto_pagado, monto_capital, monto_interes, registrado_por) values (%L, %L, 2, 1, 1, 0, %L)', i.caja, i.credito, i.tes));
  perform pg_temp.anotar('Nadie inserta pagos a mano', e = '42501', e);

  -- Cuentas de ahorro
  e := pg_temp.error_de(format('insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta, saldo) values (%L, %L, ''CA-VAL-2'', 1000)', i.caja, i.ficha));
  t := (select saldo::text from public.cuentas_ahorro where numero_cuenta = 'CA-VAL-2' and caja_id = i.caja);
  perform pg_temp.anotar('Cuenta abierta con saldo inventado: empieza en 0', e = 'sin error' and t = '0.00', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format('update public.cuentas_ahorro set saldo = 5000 where id = %L', i.cuenta));
  perform pg_temp.anotar('Nadie edita a mano el saldo de una cuenta', e = '42501', e);
  e := pg_temp.error_de(format('insert into public.transacciones (caja_id, cuenta_id, tipo, monto, saldo_anterior, saldo_posterior, registrado_por) values (%L, %L, ''deposito'', 10, 0, 10, %L)', i.caja, i.cuenta, i.tes));
  perform pg_temp.anotar('Nadie inserta movimientos a mano', e = '42501', e);
  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, ''deposito'', 40)', i.caja, i.cuenta));
  t := (select saldo::text from public.cuentas_ahorro where id = i.cuenta);
  perform pg_temp.anotar('El depósito por la función sigue funcionando', e = 'sin error' and t = '40.00', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = ''cerrada'' where id = %L', i.cuenta));
  perform pg_temp.anotar('Cerrar una cuenta con saldo: rechazado', e = 'DM400', e);
  perform public.registrar_movimiento(i.caja, i.cuenta, 'retiro', 40);
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = ''cerrada'' where id = %L', i.cuenta));
  t := (select estado || ' ' || (fecha_cierre is not null) from public.cuentas_ahorro where id = i.cuenta);
  perform pg_temp.anotar('Cerrar una cuenta en 0: cerrada y con fecha de cierre', e = 'sin error' and t = 'cerrada true', e || ' → ' || coalesce(t, 'nada'));

  -- Perfil
  e := pg_temp.error_de(format('update public.profiles set nombre = ''Ana'' where id = %L', i.tes));
  perform pg_temp.anotar('Perfil con nombre de 3 letras: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format('update public.profiles set nombre = ''Ana María 2'' where id = %L', i.tes));
  perform pg_temp.anotar('Perfil con números en el nombre: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format('update public.profiles set telefono = ''099123456'' where id = %L', i.tes));
  perform pg_temp.anotar('Perfil con teléfono de 9 dígitos: rechazado', e = 'DM400', e);
  -- Desde 012 (T17) la foto es una ruta en Storage que pone poner_foto_perfil (ver fotos.sql)
  e := pg_temp.error_de(format('update public.profiles set foto = ''otra/a.png'' where id = %L', i.tes));
  perform pg_temp.anotar('Perfil: la ruta de la foto no se escribe a mano', e = '42501', e);
  e := pg_temp.error_de(format('update public.profiles set nombre = ''  María   José O''''Neil '', telefono = ''099 123 4567'' where id = %L', i.tes));
  t := (select nombre || ' ' || telefono from public.profiles where id = i.tes);
  perform pg_temp.anotar('Perfil válido: se guarda limpio', e = 'sin error' and t = 'María José O''Neil 0991234567', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format('update public.profiles set created_at = now() where id = %L', i.tes));
  perform pg_temp.anotar('Perfil: otras columnas no se editan', e = '42501', e);

  -- Número de crédito por caja (007)
  n := (select numero from public.creditos where id = i.credito);
  perform pg_temp.anotar('Número: el primer crédito de la caja es el 1', n = 1, coalesce(n::text, 'nada'));
  t := (select max(numero) + 1 from public.creditos where caja_id = i.caja)::text;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses, numero)
  values (i.caja, i.ficha, 200, 12, 2, 99) returning numero into n;
  perform pg_temp.anotar('Número: el siguiente de la caja aunque se pida otro', n::text = t, n || ' (esperado ' || t || ')');
  e := pg_temp.error_de(format('update public.creditos set numero = 7 where id = %L', i.credito));
  perform pg_temp.anotar('Número: no se cambia después', e = '42501', e);
  t := public.crear_caja('Otra caja de validación', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id';
  insert into public.socios (caja_id, cedula, nombre, apellido)
  values (t::uuid, '1104680135', 'Pedro', 'Loja') returning id into e;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
  values (t::uuid, e::uuid, 100, 12, 1) returning numero into n;
  perform pg_temp.anotar('Número: cada caja empieza en 1', n = 1, n::text);

  -- Monto máximo de crédito (008). Quien creó la caja es su coordinador.
  e := pg_temp.error_de(format('update public.cajas set monto_maximo_credito = 0 where id = %L', i.caja));
  perform pg_temp.anotar('Máximo: 0 no es un máximo válido', e = '23514', e);
  update public.cajas set monto_maximo_credito = 1500 where id = i.caja;
  begin
    insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
    values (i.caja, i.ficha, 1500.01, 12, 6);
    e := 'sin error'; t := '';
  exception when others then
    e := sqlstate; t := sqlerrm;
  end;
  perform pg_temp.anotar('Máximo: una solicitud por encima se rechaza con el máximo en el mensaje',
    e = 'DM400' and t = 'El monto máximo de crédito de esta caja es $1.500,00', e || ' → ' || t);
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '1500', '12', '6'));
  perform pg_temp.anotar('Máximo: una solicitud igual al máximo pasa', e = 'sin error', e);
  update public.cajas set monto_maximo_credito = null where id = i.caja;
  e := pg_temp.error_de(format(ins_credito, i.caja, i.ficha, '90000', '12', '6'));
  perform pg_temp.anotar('Máximo: vacío es sin límite', e = 'sin error', e);

  perform pg_temp.como(null);
  perform set_config('role', 'postgres', true);
end
$casos$;

-- ─── Resumen ─────────────────────────────────────────────────────────────────────────
do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'VALIDACION: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
