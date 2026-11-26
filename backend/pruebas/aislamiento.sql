-- Prueba de aislamiento entre cajas (Etapa 6, T7; documento TIC §1.3: "se valida mediante
-- una prueba específica que confirma que un usuario de una caja no puede acceder a los
-- datos de otra").
--
-- QUÉ HACE: crea dentro de una transacción cinco cuentas de prueba, dos cajas, fichas,
-- cuentas de ahorro, movimientos, un crédito y un pago, y después se hace pasar por cada
-- cuenta (rol authenticated con su JWT simulado) y por un visitante sin sesión (anon)
-- para comprobar lo que cada uno puede leer y escribir.
--
-- NO DEJA RASTRO: termina con un error a propósito que lleva el resumen. El error
-- deshace la transacción entera; no hace falta borrar nada. No depende de los datos que
-- haya en la base: sirve igual sobre una base recién reiniciada (con las migraciones
-- 001 a 004 aplicadas).
--
-- CÓMO SE CORRE: en Supabase → SQL Editor, pegar este archivo completo y ejecutarlo. El
-- resultado sale como mensaje de error: "AISLAMIENTO: 37 de 37 casos pasan" seguido de
-- cada caso. Si alguno dice FALLA, el aislamiento tiene un hueco.

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

create temp table ids (
  coord_a uuid, tes_a uuid, socio_a uuid, coord_b uuid, ajeno uuid, caja_a uuid, caja_b uuid,
  ficha_socio uuid, ficha_otra uuid, ficha_b uuid, cuenta_socio uuid, cuenta_otra uuid,
  cuenta_b uuid, credito uuid
) on commit drop;
grant select on ids to authenticated, anon;

-- ─── Datos de prueba ─────────────────────────────────────────────────────────────────

do $datos$
declare
  coord_a uuid := 'a0000000-0000-4000-8000-00000000000a';
  tes_a   uuid := 'a0000000-0000-4000-8000-00000000000b';
  socio_a uuid := 'a0000000-0000-4000-8000-00000000000c';
  coord_b uuid := 'b0000000-0000-4000-8000-00000000000a';
  ajeno   uuid := 'c0000000-0000-4000-8000-00000000000a';
  v json;
  caja_a uuid; caja_b uuid;
  ficha_socio uuid; ficha_otra uuid; ficha_b uuid;
  cuenta_socio uuid; cuenta_otra uuid; cuenta_b uuid;
  credito uuid;
begin
  -- Cinco cuentas de usuario (el trigger crea su perfil)
  insert into auth.users (id, email, aud, role) values
    (coord_a, 'coord.a@prueba.domus', 'authenticated', 'authenticated'),
    (tes_a,   'tes.a@prueba.domus',   'authenticated', 'authenticated'),
    (socio_a, 'socio.a@prueba.domus', 'authenticated', 'authenticated'),
    (coord_b, 'coord.b@prueba.domus', 'authenticated', 'authenticated'),
    (ajeno,   'ajeno@prueba.domus',   'authenticated', 'authenticated');

  -- Caja A: la crea su coordinador e invita a un tesorero y a un socio
  perform pg_temp.como(coord_a);
  v := public.crear_caja('Caja A de prueba', 'Prueba de aislamiento', '2025-01-01', 1, 12, 'prueba');
  caja_a := (v->>'id')::uuid;
  insert into public.invitaciones_caja (caja_id, codigo, rol, creado_por, expira_at) values
    (caja_a, 'PRUEBA-TES-A', 'tesorero', coord_a, now() + interval '1 day'),
    (caja_a, 'PRUEBA-SOC-A', 'socio',    coord_a, now() + interval '1 day');
  perform pg_temp.como(tes_a);
  perform public.unirse_con_codigo('prueba-tes-a');

  -- El tesorero registra dos fichas: la del socio (con su correo) y la de otra persona
  insert into public.socios (caja_id, cedula, nombre, apellido, email)
  values (caja_a, '1710034065', 'Sofía', 'Andrade', 'SOCIO.A@prueba.domus') returning id into ficha_socio;
  insert into public.socios (caja_id, cedula, nombre, apellido)
  values (caja_a, '0912345675', 'Otra', 'Persona') returning id into ficha_otra;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta, saldo, estado)
  values (caja_a, ficha_socio, 'CA-PRUEBA-1', 0, 'activa') returning id into cuenta_socio;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta, saldo, estado)
  values (caja_a, ficha_otra, 'CA-PRUEBA-2', 0, 'activa') returning id into cuenta_otra;
  perform public.registrar_movimiento(caja_a, cuenta_socio, 'deposito', 100, 'prueba');
  perform public.registrar_movimiento(caja_a, cuenta_otra, 'deposito', 250, 'prueba');
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses,
                               monto_total, cuota_mensual, saldo_pendiente, estado)
  values (caja_a, ficha_otra, 300, 12, 3, 309, 103, 309, 'pendiente') returning id into credito;
  update public.creditos set estado = 'activo', fecha_desembolso = '2025-02-01' where id = credito;
  perform public.registrar_pago_credito(caja_a, credito, 309, 1, 100, 3, 'cuota');

  -- El socio se une después: su ficha se vincula por correo (sin distinguir mayúsculas)
  perform pg_temp.como(socio_a);
  v := public.unirse_con_codigo('PRUEBA-SOC-A');
  perform pg_temp.anotar('Unirse con código vincula la ficha con el mismo correo',
    (v->>'socio_vinculado')::boolean, v::text);

  -- Caja B: otro coordinador, con una ficha y un depósito
  perform pg_temp.como(coord_b);
  v := public.crear_caja('Caja B de prueba', 'Prueba de aislamiento', '2025-01-01', 1, 12, 'prueba');
  caja_b := (v->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido)
  values (caja_b, '1104680135', 'Socio', 'De B') returning id into ficha_b;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta, saldo, estado)
  values (caja_b, ficha_b, 'CA-PRUEBA-B', 0, 'activa') returning id into cuenta_b;
  perform public.registrar_movimiento(caja_b, cuenta_b, 'deposito', 75, 'prueba');

  perform pg_temp.como(null);
  perform set_config('role', 'postgres', true);
  -- Guarda los ids para los casos
  insert into ids values (coord_a, tes_a, socio_a, coord_b, ajeno, caja_a, caja_b,
    ficha_socio, ficha_otra, ficha_b, cuenta_socio, cuenta_otra, cuenta_b, credito);
end
$datos$;

-- ─── Casos ───────────────────────────────────────────────────────────────────────────

do $casos$
declare
  i ids;
  n bigint;
  e text;
  tablas text[] := array['socios', 'cuentas_ahorro', 'transacciones', 'creditos', 'pagos_credito', 'invitaciones_caja'];
  t text;
begin
  select * into i from ids;

  -- 1. Tesorero de A: ve todo lo de A y nada de B
  perform pg_temp.como(i.tes_a);
  n := pg_temp.contar(format('select 1 from public.socios where caja_id = %L', i.caja_a));
  perform pg_temp.anotar('Tesorero de A ve las 2 fichas de su caja', n = 2, n::text);
  foreach t in array tablas loop
    n := pg_temp.contar(format('select 1 from public.%I where caja_id = %L', t, i.caja_b));
    perform pg_temp.anotar('Tesorero de A no ve ' || t || ' de B', n = 0, n::text);
  end loop;
  n := pg_temp.contar(format('select 1 from public.cajas where id = %L', i.caja_b));
  perform pg_temp.anotar('Tesorero de A no ve la caja B', n = 0, n::text);
  e := pg_temp.error_de(format(
    'insert into public.socios (caja_id, cedula, nombre, apellido) values (%L, ''1'', ''X'', ''Y'')', i.caja_b));
  perform pg_temp.anotar('Tesorero de A no registra fichas en B', e = '42501', e);
  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, ''deposito'', 5)', i.caja_b, i.cuenta_b));
  perform pg_temp.anotar('Tesorero de A no deposita en una cuenta de B', e = 'DM404', e);
  e := pg_temp.error_de(format('select * from public.correos_miembros(%L)', i.caja_b));
  perform pg_temp.anotar('Tesorero de A no lee los correos de los miembros de B', e = 'DM403', e);
  n := pg_temp.contar(format('select 1 from public.profiles where id = %L', i.coord_b));
  perform pg_temp.anotar('Tesorero de A no ve el perfil del coordinador de B', n = 0, n::text);
  n := pg_temp.contar(format('select 1 from public.profiles where id = %L', i.coord_a));
  perform pg_temp.anotar('Tesorero de A ve el perfil de su coordinador', n = 1, n::text);
  e := pg_temp.error_de(format('update public.socios set user_id = %L where id = %L', i.tes_a, i.ficha_otra));
  perform pg_temp.anotar('Tesorero de A no se vincula a mano una ficha', e = '42501', e);
  e := pg_temp.error_de(format('update public.cajas set nombre = ''x'' where id = %L', i.caja_a));
  n := pg_temp.contar(format('select 1 from public.cajas where id = %L and nombre = ''x''', i.caja_a));
  perform pg_temp.anotar('Tesorero de A no configura la caja (solo el coordinador)', n = 0, e || ', cambiadas ' || n);

  -- 2. Socio de A: solo lo suyo
  perform pg_temp.como(i.socio_a);
  n := pg_temp.contar('select 1 from public.socios');
  perform pg_temp.anotar('Socio de A ve solo su ficha', n = 1, n::text);
  n := pg_temp.contar('select 1 from public.cuentas_ahorro');
  perform pg_temp.anotar('Socio de A ve solo su cuenta', n = 1, n::text);
  n := pg_temp.contar(format('select 1 from public.transacciones where cuenta_id = %L', i.cuenta_otra));
  perform pg_temp.anotar('Socio de A no ve los movimientos de otra ficha de su caja', n = 0, n::text);
  n := pg_temp.contar('select 1 from public.creditos');
  perform pg_temp.anotar('Socio de A no ve el crédito de otra persona', n = 0, n::text);
  n := pg_temp.contar('select 1 from public.pagos_credito');
  perform pg_temp.anotar('Socio de A no ve los pagos de otra persona', n = 0, n::text);
  n := pg_temp.contar('select 1 from public.invitaciones_caja');
  perform pg_temp.anotar('Socio de A no ve los códigos de invitación', n = 0, n::text);
  n := pg_temp.contar('select 1 from public.miembros_caja');
  perform pg_temp.anotar('Socio de A ve solo su propia membresía', n = 1, n::text);
  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, ''deposito'', 5)', i.caja_a, i.cuenta_socio));
  perform pg_temp.anotar('Socio de A no registra depósitos, ni en su cuenta', e in ('DM404', '42501'), e);
  e := pg_temp.error_de(format('select * from public.correos_miembros(%L)', i.caja_a));
  perform pg_temp.anotar('Socio de A no lee los correos de los miembros', e = 'DM403', e);

  -- 3. Coordinador de B no ve A
  perform pg_temp.como(i.coord_b);
  n := 0;
  foreach t in array tablas loop
    n := n + pg_temp.contar(format('select 1 from public.%I where caja_id = %L', t, i.caja_a));
  end loop;
  perform pg_temp.anotar('Coordinador de B no ve ninguna fila de A', n = 0, n::text);
  e := pg_temp.error_de(format('update public.miembros_caja set rol = ''socio'' where caja_id = %L', i.caja_a));
  n := pg_temp.contar(format('select 1 from public.miembros_caja where caja_id = %L and rol = ''socio''', i.caja_a));
  perform pg_temp.anotar('Coordinador de B no cambia roles en A', e = 'sin error' and n = 0, e);

  -- 4. Cuenta sin caja y visitante sin sesión: nada
  perform pg_temp.como(i.ajeno);
  n := pg_temp.contar('select 1 from public.cajas') + pg_temp.contar('select 1 from public.socios')
     + pg_temp.contar('select 1 from public.transacciones') + pg_temp.contar('select 1 from public.miembros_caja');
  perform pg_temp.anotar('Cuenta sin caja no ve nada', n = 0, n::text);
  e := pg_temp.error_de('select public.unirse_con_codigo(''PRUEBA-SOC-A'')');
  perform pg_temp.anotar('Un código ya usado no sirve a otra cuenta', e = 'DM404', e);
  perform pg_temp.como(null);
  n := pg_temp.contar('select 1 from public.cajas') + pg_temp.contar('select 1 from public.socios')
     + pg_temp.contar('select 1 from public.cuentas_ahorro') + pg_temp.contar('select 1 from public.transacciones');
  perform pg_temp.anotar('Sin sesión no se ve nada', n = 0, n::text);
  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, ''deposito'', 5)', i.caja_a, i.cuenta_otra));
  perform pg_temp.anotar('Sin sesión no se llama a las funciones de escritura', e = '42501', e);

  -- 5. Tablas del administrador del sistema: ninguna cuenta las lee con la clave pública
  perform pg_temp.como(i.coord_a);
  n := pg_temp.contar('select 1 from public.administradores_sistema')
     + pg_temp.contar('select 1 from public.bitacora_administracion')
     + pg_temp.contar('select 1 from public.bloqueos_cuenta');
  perform pg_temp.anotar('Las tablas de administración no se leen con la clave pública', n = 0, n::text);

  -- 6. Límite de tres cajas creadas por cuenta
  perform public.crear_caja('A2', 'd', '2025-01-01', 1, 12, 'prueba');
  perform public.crear_caja('A3', 'd', '2025-01-01', 1, 12, 'prueba');
  e := pg_temp.error_de('select public.crear_caja(''A4'', ''d'', ''2025-01-01'', 1, 12, ''prueba'')');
  perform pg_temp.anotar('Una cuenta no crea una cuarta caja', e = 'DM409', e);

  -- 7. Caja bloqueada por el administrador: se lee, no se escribe
  perform pg_temp.como(null);
  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada', estado_motivo = 'prueba' where id = i.caja_a;
  perform pg_temp.como(i.tes_a);
  n := pg_temp.contar(format('select 1 from public.socios where caja_id = %L', i.caja_a));
  perform pg_temp.anotar('Caja bloqueada: el tesorero sigue leyendo', n = 2, n::text);
  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, ''deposito'', 5)', i.caja_a, i.cuenta_otra));
  perform pg_temp.anotar('Caja bloqueada: no admite depósitos', e = 'DM409', e);
  e := pg_temp.error_de(format(
    'insert into public.socios (caja_id, cedula, nombre, apellido) values (%L, ''2'', ''X'', ''Y'')', i.caja_a));
  perform pg_temp.anotar('Caja bloqueada: no admite fichas nuevas', e = '42501', e);
  perform pg_temp.como(i.coord_a);
  e := pg_temp.error_de(format('update public.cajas set estado = ''activa'' where id = %L', i.caja_a));
  perform pg_temp.anotar('Caja bloqueada: su coordinador no la desbloquea', e = '42501', e);

  perform pg_temp.como(null);
  perform set_config('role', 'postgres', true);
end
$casos$;

-- ─── Resumen ─────────────────────────────────────────────────────────────────────────
-- El error deshace todo lo anterior: no queda ningún dato de prueba.
do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'AISLAMIENTO: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
