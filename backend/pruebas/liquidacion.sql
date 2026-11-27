-- Prueba de la salida de un socio con liquidación (Etapa 7, T4; migración 021).
--
-- QUÉ HACE: dentro de una transacción crea una caja con tres socios. Ana tiene $1.500 en
-- dos cuentas, un crédito de $1.200 al 12 % a 12 meses con la cuota 1 pagada y dos
-- vencidas, y una solicitud sin aprobar. Su liquidación: deuda $1.124 ($1.100 de capital
-- y $24 de interés vencido), $108 de interés condonado, $18,37 de interés del ciclo y
-- $394,37 de neto. Comprueba quién puede, que la base rechace un plan que cambió o que
-- condona capital, que la salida válida deje todo en su lugar, que Luis no salga si sus
-- ahorros no cubren su deuda y que una ficha con ahorros no se desactive sin liquidación.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "LIQUIDACIÓN: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000f5';
  tes uuid := 'd0000000-0000-4000-8000-0000000000f6';
  caja uuid; ana uuid; luis uuid; rosa uuid; a1 uuid; a2 uuid; l1 uuid; cr uuid; crl uuid; sol uuid;
  e text; t text; n int; r json; plan jsonb; malo jsonb; liq record;
  hoy date := (now() at time zone 'America/Guayaquil')::date;
  desembolso date := (date_trunc('month', (now() at time zone 'America/Guayaquil')::date) - interval '4 months')::date + 9;
  q_salida text := 'select public.registrar_salida(%L, %L, %L::jsonb)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.liq@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.liq@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de salidas', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, tes, 'tesorero', true);
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01') returning id into ana;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '1710034065', 'Luis', 'Mora', '2024-01-01') returning id into luis;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '0926687856', 'Rosa', 'Vera', '2024-01-01') returning id into rosa;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, ana, 'LIQ-001') returning id into a1;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, ana, 'LIQ-002') returning id into a2;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, luis, 'LIQ-003') returning id into l1;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses, monto_total,
                               cuota_mensual, saldo_pendiente, estado, fecha_desembolso, fecha_vencimiento)
  values (caja, ana, 1200, 12, 12, 1344, 112, 1344, 'activo', desembolso, desembolso + 365) returning id into cr;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses, monto_total,
                               cuota_mensual, saldo_pendiente, estado, fecha_desembolso, fecha_vencimiento)
  values (caja, luis, 600, 12, 6, 636, 106, 636, 'activo', desembolso, desembolso + 180) returning id into crl;

  perform pg_temp.como(coord);
  perform public.registrar_movimiento(caja, a1, 'deposito', 1000, 'prueba');
  perform public.registrar_movimiento(caja, a2, 'deposito', 500, 'prueba');
  perform public.registrar_movimiento(caja, l1, 'deposito', 100, 'prueba');
  perform public.registrar_pago_credito(caja, cr, 1344, 1, 100, 12, 'cuota');
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
  values (caja, ana, 300, 12, 3) returning id into sol;

  -- El plan de Ana, como lo arma el backend: cuotas 2 y 3 vencidas con su interés; 4 a 12
  -- solo capital, con el interés condonado
  plan := jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', a1, 'saldo', 1000), jsonb_build_object('id', a2, 'saldo', 500)),
    'creditos', jsonb_build_array(jsonb_build_object('id', cr, 'saldo_pendiente', 1232, 'partes',
       (select jsonb_agg(jsonb_build_object('numero_cuota', k, 'capital', 100,
                'interes', case when k <= 3 then 12 else 0 end,
                'interes_condonado', case when k <= 3 then 0 else 12 end) order by k)
          from generate_series(2, 12) k))),
    'solicitudes', jsonb_build_array(sol),
    'interes', jsonb_build_object('monto', 18.37, 'ciclo_numero', 3, 'ciclo_inicio', date_trunc('year', hoy)::date,
                                  'ciclo_fin', (date_trunc('year', hoy) + interval '1 year - 1 day')::date, 'tipo', 'diferenciada'),
    'detalle', jsonb_build_object('nota', 'prueba'),
    'ahorros_entregados', true, 'interes_entregado', true);

  -- Quién
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(q_salida, caja, ana, plan));
  perform pg_temp.anotar('El tesorero no registra salidas', e like 'DM404%', e);

  -- Qué rechaza
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(q_salida, caja, ana, plan || '{"interes_entregado": false}'));
  perform pg_temp.anotar('Sin la lista marcada: rechazada', e like 'DM400%', e);
  malo := jsonb_set(plan, '{cuentas,0,saldo}', '900');
  e := pg_temp.error_de(format(q_salida, caja, ana, malo));
  perform pg_temp.anotar('Un saldo distinto al de la vista previa: rechazada', e like 'DM409%cambió%', e);
  malo := jsonb_set(jsonb_set(plan, '{creditos,0,partes,10,capital}', '0'), '{creditos,0,partes,10,interes_condonado}', '112');
  e := pg_temp.error_de(format(q_salida, caja, ana, malo));
  perform pg_temp.anotar('Un plan que condona capital: rechazado', e like 'DM409%capital pendiente%', e);
  malo := jsonb_set(plan, '{solicitudes}', '[]');
  e := pg_temp.error_de(format(q_salida, caja, ana, malo));
  perform pg_temp.anotar('Una solicitud que no estaba en la vista previa: rechazada', e like 'DM409%solicitudes%', e);
  n := (select count(*) from public.pagos_credito where credito_id = cr);
  perform pg_temp.anotar('Un rechazo no deja ningún pago a medias', n = 1, n::text);

  -- La salida válida
  e := pg_temp.error_de(format(q_salida, caja, ana, plan));
  perform pg_temp.anotar('Salida válida registrada', e = 'sin error', e);
  select estado || ' ' || saldo_pendiente || ' ' || interes_condonado into t from public.creditos where id = cr;
  perform pg_temp.anotar('Crédito pagado, saldo 0, $108 condonados', t = 'pagado 0.00 108.00', t);
  n := (select count(*) from public.pagos_credito where credito_id = cr and fecha_pago = hoy and numero_cuota > 1);
  perform pg_temp.anotar('Once pagos de hoy, uno por cada cuota que faltaba', n = 11, n::text);
  select string_agg(c.numero_cuenta || ' ' || x.monto || ' ' || x.descripcion, ' | ' order by c.numero_cuenta, x.descripcion desc)
    into t from public.transacciones x join public.cuentas_ahorro c on c.id = x.cuenta_id
   where c.socio_id = ana and x.tipo = 'retiro';
  perform pg_temp.anotar('Retiros: $1.124 para los créditos y $376 entregados',
    t = 'LIQ-001 1000.00 Liquidación de salida: pago de sus créditos | LIQ-002 124.00 Liquidación de salida: pago de sus créditos | LIQ-002 376.00 Liquidación de salida: entrega de sus ahorros', t);
  select string_agg(estado || ' ' || saldo || ' ' || coalesce(fecha_cierre = hoy, false), ', ') into t from public.cuentas_ahorro where socio_id = ana;
  perform pg_temp.anotar('Cuentas cerradas hoy, en 0', t = 'cerrada 0.00 true, cerrada 0.00 true', t);
  n := (select count(*) from public.creditos where id = sol);
  perform pg_temp.anotar('La solicitud sin aprobar se anuló', n = 0, n::text);
  select (not activo and fecha_salida = hoy)::text into t from public.socios where id = ana;
  perform pg_temp.anotar('Ficha inactiva con la salida de hoy', t = 'true', t);
  select string_agg(coalesce(salida::text, 'abierto'), ', ') into t from public.periodos_socio where socio_id = ana;
  perform pg_temp.anotar('Su periodo se cerró hoy', t = hoy::text, t);
  select * into liq from public.liquidaciones where socio_id = ana;
  perform pg_temp.anotar('Liquidación guardada: 1500 + 18,37 − 1124 = 394,37; 108 condonados',
    liq.ahorros = 1500 and liq.interes = 18.37 and liq.deuda = 1124 and liq.neto = 394.37 and liq.interes_condonado = 108
    and liq.ciclo_numero = 3 and liq.tipo_reparto = 'diferenciada' and liq.registrado_por = coord,
    format('%s %s %s %s %s', liq.ahorros, liq.interes, liq.deuda, liq.neto, liq.interes_condonado));
  e := pg_temp.error_de(format(q_salida, caja, ana, plan));
  perform pg_temp.anotar('No sale dos veces', e like 'DM409%inactiva%', e);

  -- Luis: $100 de ahorro y $600 de deuda
  plan := jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', l1, 'saldo', 100)),
    'creditos', jsonb_build_array(jsonb_build_object('id', crl, 'saldo_pendiente', 636, 'partes',
       (select jsonb_agg(jsonb_build_object('numero_cuota', k, 'capital', 100,
                'interes', case when k <= 3 then 6 else 0 end,
                'interes_condonado', case when k <= 3 then 0 else 6 end) order by k)
          from generate_series(1, 6) k))),
    'solicitudes', '[]'::jsonb, 'interes', null,
    'ahorros_entregados', true, 'interes_entregado', true);
  e := pg_temp.error_de(format(q_salida, caja, luis, plan));
  perform pg_temp.anotar('Ahorros que no cubren la deuda: no sale', e like 'DM409%no cubren%', e);
  n := (select count(*) from public.pagos_credito where credito_id = crl);
  perform pg_temp.anotar('Y no queda ningún pago suyo', n = 0, n::text);

  -- Desactivar sin liquidación
  e := pg_temp.error_de(format('update public.socios set activo = false, updated_at = now() where id = %L', luis));
  perform pg_temp.anotar('Con ahorros o créditos no se desactiva sin liquidación', e like 'DM409%liquidación%', e);
  e := pg_temp.error_de(format('update public.socios set activo = false, updated_at = now() where id = %L', rosa));
  perform pg_temp.anotar('Sin ahorros ni créditos sí se desactiva', e = 'sin error', e);

  -- Quién ve la liquidación
  perform pg_temp.como(tes);
  n := (select count(*) from public.liquidaciones where caja_id = caja);
  perform pg_temp.anotar('El tesorero ve la liquidación', n = 1, n::text);
  e := pg_temp.error_de(format('update public.liquidaciones set neto = 0 where caja_id = %L', caja));
  perform pg_temp.anotar('Nadie la cambia a mano', e like '42501%', e);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'LIQUIDACIÓN: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
