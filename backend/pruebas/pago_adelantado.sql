-- Prueba del pago adelantado por monto (Etapa 6, T30; migración 013).
--
-- QUÉ HACE: dentro de una transacción crea un crédito de $600 al 12 % anual a 6 meses
-- (cuotas de $100 de capital + $6 de interés, total $636) desembolsado hace dos meses:
-- la cuota 1 venció el mes pasado, la 2 vence este mes y la 3 a la 6 son futuras. Paga la
-- 1 y la 2 y prueba registrar_pago_adelantado con el ejemplo de $230: cuotas 6 y 5
-- adelantadas (se condonan $12) y $30 a la cuota 4, que conserva su interés.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "PAGO ADELANTADO: N de N casos pasan" y la lista de casos.

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
  return sqlstate;
end $$;

create function pg_temp.anotar(p_caso text, p_ok boolean, p_detalle text) returns void
language sql as $$ insert into resultados (caso, ok, detalle) values (p_caso, p_ok, p_detalle) $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

do $casos$
declare
  coord uuid := 'd0000000-0000-4000-8000-0000000000a1';
  socio_u uuid := 'd0000000-0000-4000-8000-0000000000a2';
  caja uuid; s1 uuid; credito uuid; pendiente uuid;
  desembolso date := (date_trunc('month', (now() at time zone 'America/Guayaquil')::date) - interval '2 months')::date;
  e text; saldo numeric; n int; cond numeric; cap numeric;
  adelantar text := 'select public.registrar_pago_adelantado(%L, %L, %s, %L::jsonb)';
  ejemplo text := '[{"numero_cuota":6,"capital":100,"interes_condonado":6},{"numero_cuota":5,"capital":100,"interes_condonado":6},{"numero_cuota":4,"capital":30,"interes_condonado":0}]';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.adelanto@prueba.domus', 'authenticated', 'authenticated'),
    (socio_u, 'socio.adelanto@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de adelantos', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (caja, '1710034065', 'Ana', 'Uno') returning id into s1;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
  values (caja, s1, 600, 12, 6) returning id into credito;
  update public.creditos set estado = 'activo', fecha_desembolso = desembolso,
    fecha_vencimiento = (desembolso + interval '6 months')::date where id = credito;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
  values (caja, s1, 600, 12, 6) returning id into pendiente;
  perform public.registrar_pago_credito(caja, credito, 636, 1, 100, 6, 'cuota');
  perform public.registrar_pago_credito(caja, credito, 530, 2, 100, 6, 'cuota');

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, socio_u, 'socio', true);

  -- Quién
  perform pg_temp.como(socio_u);
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, ejemplo));
  perform pg_temp.anotar('Un socio no adelanta', e = 'DM404', e);

  -- Qué se rechaza
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, '[]'));
  perform pg_temp.anotar('Sin cuotas: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, '[{"numero_cuota":2,"capital":100,"interes_condonado":6}]'));
  perform pg_temp.anotar('La cuota de este mes no se adelanta', e = 'DM400', e);
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, '[{"numero_cuota":6,"capital":50,"interes_condonado":0},{"numero_cuota":6,"capital":50,"interes_condonado":6}]'));
  perform pg_temp.anotar('La misma cuota dos veces: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(adelantar, caja, credito, 500, ejemplo));
  perform pg_temp.anotar('El saldo cambió: rechazado', e = 'DM409', e);
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, '[{"numero_cuota":6,"capital":500,"interes_condonado":6}]'));
  perform pg_temp.anotar('Más que el saldo: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(adelantar, caja, pendiente, 636, '[{"numero_cuota":6,"capital":100,"interes_condonado":6}]'));
  perform pg_temp.anotar('Crédito sin desembolsar: rechazado', e = 'DM400', e);

  -- Todo o nada: la cuota 6 está bien, la 2 no; no queda ninguna
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, '[{"numero_cuota":6,"capital":100,"interes_condonado":6},{"numero_cuota":2,"capital":100,"interes_condonado":6}]'));
  n := (select count(*) from public.pagos_credito where credito_id = credito);
  saldo := (select saldo_pendiente from public.creditos where id = credito);
  perform pg_temp.anotar('Si una parte falla no queda ninguna', e = 'DM400' and n = 2 and saldo = 424,
    format('%s, %s pagos, saldo %s', e, n, saldo));

  -- El ejemplo de $230
  e := pg_temp.error_de(format(adelantar, caja, credito, 424, ejemplo));
  saldo := (select saldo_pendiente from public.creditos where id = credito);
  cond := (select interes_condonado from public.creditos where id = credito);
  perform pg_temp.anotar('$230: saldo 424 − 230 − 12 condonado = 182', e = 'sin error' and saldo = 182 and cond = 12,
    format('%s, saldo %s, condonado %s', e, saldo, cond));
  n := (select count(*) from public.pagos_credito where credito_id = credito and es_prepago and numero_cuota in (5, 6) and monto_capital = 100 and monto_interes = 0);
  perform pg_temp.anotar('Cuotas 6 y 5 adelantadas, solo capital', n = 2, n || ' pagos');
  select count(*), sum(monto_capital) into n, cap from public.pagos_credito
  where credito_id = credito and numero_cuota = 4 and not es_prepago and monto_interes = 0;
  perform pg_temp.anotar('Cuota 4: $30 de capital, sin marcar como adelantada', n = 1 and cap = 30, n || ' pago, ' || coalesce(cap, 0));

  -- Un segundo adelanto termina la cuota 4: ahora sí se adelanta y condona su interés
  e := pg_temp.error_de(format(adelantar, caja, credito, 182, '[{"numero_cuota":4,"capital":70,"interes_condonado":6}]'));
  saldo := (select saldo_pendiente from public.creditos where id = credito);
  perform pg_temp.anotar('Completar la cuota 4 con otro adelanto: saldo 182 − 70 − 6 = 106', e = 'sin error' and saldo = 106,
    format('%s, saldo %s', e, saldo));

  -- Caja bloqueada
  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(adelantar, caja, credito, 106, '[{"numero_cuota":3,"capital":10,"interes_condonado":0}]'));
  perform pg_temp.anotar('Caja bloqueada: no se adelanta', e = 'DM409', e);

  perform set_config('role', 'postgres', true);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'PAGO ADELANTADO: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
