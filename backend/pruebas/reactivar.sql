-- Prueba de la reactivación de un socio (Etapa 7, T8; migración 023).
--
-- QUÉ HACE: dentro de una transacción crea una caja con un coordinador, un tesorero y a
-- Ana, con $200 de ahorro. Ana sale con su liquidación y después vuelve. Comprueba que
-- solo el coordinador cambie el estado de una ficha, que al reactivar se exija la
-- dirección, que la ficha vuelva sin fecha de salida y con un periodo nuevo abierto desde
-- hoy, que su cuenta siga cerrada hasta reabrirla, y que pueda salir otra vez.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "REACTIVAR: N de N casos pasan" y la lista de casos.

begin;

create temp table resultados (n serial, caso text, ok boolean, detalle text) on commit drop;
grant insert, select on resultados to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

create function pg_temp.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.error_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'sin error';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

create function pg_temp.anotar(p_caso text, p_ok boolean, p_detalle text) returns void
language sql as $$ insert into resultados (caso, ok, detalle) values (p_caso, p_ok, coalesce(p_detalle, 'null')) $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

do $casos$
declare
  coord uuid := 'd0000000-0000-4000-8000-0000000000e5';
  tes uuid := 'd0000000-0000-4000-8000-0000000000e6';
  caja uuid; ana uuid; a1 uuid;
  e text; t text; n int;
  hoy date := (now() at time zone 'America/Guayaquil')::date;
  q_salida text := 'select public.registrar_salida(%L, %L, %L::jsonb)';
  q_estado text := 'update public.socios set activo = %L, direccion = %L where id = %L';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.react@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.react@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de reingresos', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, tes, 'tesorero', true);
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, direccion) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01', 'Calle vieja 1') returning id into ana;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, ana, 'RE-001') returning id into a1;

  perform pg_temp.como(coord);
  perform public.registrar_movimiento(caja, a1, 'deposito', 200, 'prueba');
  e := pg_temp.error_de(format(q_salida, caja, ana, jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', a1, 'saldo', 200)),
    'creditos', '[]'::jsonb, 'solicitudes', '[]'::jsonb, 'interes', null,
    'ahorros_entregados', true, 'interes_entregado', true)));
  perform pg_temp.anotar('Ana sale con su liquidación', e = 'sin error', e);

  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(q_estado, true, 'Calle nueva 2', ana));
  perform pg_temp.anotar('El tesorero no reactiva', e like 'DM403%', e);

  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(q_estado, true, '  ', ana));
  perform pg_temp.anotar('Sin dirección no se reactiva', e like 'DM400%dirección%', e);
  e := pg_temp.error_de(format(q_estado, true, 'Calle nueva 2', ana));
  perform pg_temp.anotar('El coordinador la reactiva con su dirección nueva', e = 'sin error', e);
  select activo || ' ' || coalesce(fecha_salida::text, 'sin salida') || ' ' || direccion into t from public.socios where id = ana;
  perform pg_temp.anotar('Ficha activa, sin fecha de salida, con la dirección nueva', t = 'true sin salida Calle nueva 2', t);
  select string_agg(ingreso || '→' || coalesce(salida::text, 'abierto'), ', ' order by ingreso, created_at) into t
    from public.periodos_socio where socio_id = ana;
  perform pg_temp.anotar('Dos periodos: el primero cerrado hoy y uno nuevo abierto desde hoy',
    t = format('2024-01-01→%s, %s→abierto', hoy, hoy), t);
  select estado into t from public.cuentas_ahorro where id = a1;
  perform pg_temp.anotar('Su cuenta sigue cerrada hasta que se reabra', t = 'cerrada', t);
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = %L where id = %L', 'activa', a1));
  perform pg_temp.anotar('Y ya se puede reabrir (019)', e = 'sin error', e);
  e := pg_temp.error_de(format(q_estado, true, 'Otra calle', ana));
  perform pg_temp.anotar('Reactivar una ficha activa no cambia nada', e = 'sin error', e);
  n := (select count(*) from public.periodos_socio where socio_id = ana);
  perform pg_temp.anotar('Sigue con dos periodos', n = 2, n::text);

  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(q_estado, false, 'Calle nueva 2', ana));
  perform pg_temp.anotar('El tesorero tampoco desactiva', e like 'DM403%', e);

  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(q_salida, caja, ana, jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', a1, 'saldo', 0)),
    'creditos', '[]'::jsonb, 'solicitudes', '[]'::jsonb, 'interes', null,
    'ahorros_entregados', true, 'interes_entregado', true)));
  perform pg_temp.anotar('Puede salir otra vez', e = 'sin error', e);
  n := (select count(*) from public.liquidaciones where socio_id = ana);
  perform pg_temp.anotar('Con dos liquidaciones', n = 2, n::text);
  n := (select count(*) from public.periodos_socio where socio_id = ana and salida is null);
  perform pg_temp.anotar('Y ningún periodo abierto', n = 0, n::text);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'REACTIVAR: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
