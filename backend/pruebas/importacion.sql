-- Prueba de la importación desde Excel (Etapa 6, T22; migración 016).
--
-- QUÉ HACE: dentro de una transacción crea una caja con socios, cuentas, fondos y
-- créditos importados, y comprueba quién importa, el todo o nada, el simulacro, las
-- fechas, los saldos y el reparto de los pagos de un crédito entre sus cuotas.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "IMPORTACIÓN: N de N casos pasan" y la lista de casos.

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

-- Devuelve el SQLSTATE y el mensaje, o 'sin error'
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
  coord uuid := 'd0000000-0000-4000-8000-0000000000c1';
  tes uuid := 'd0000000-0000-4000-8000-0000000000c2';
  socio_u uuid := 'd0000000-0000-4000-8000-0000000000c3';
  caja uuid;
  e text; v json; n int; t text; v_num numeric; cred public.creditos;
  imp text := 'select public.importar_excel(%L, %L, %L::jsonb, %L)';
  socios jsonb := '[
    {"fila": 2, "cedula": "0102030400", "nombre": "Ana", "apellido": "Pérez", "fecha_ingreso": "2024-01-15", "telefono": "0991234567", "email": "", "direccion": ""},
    {"fila": 3, "cedula": "1710034065", "nombre": "Luis", "apellido": "Mora", "fecha_ingreso": "2024-02-01", "telefono": "", "email": "luis@correo.com", "direccion": "Quito"}
  ]';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.importa@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.importa@prueba.domus', 'authenticated', 'authenticated'),
    (socio_u, 'socio.importa@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de importación', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values
    (caja, tes, 'tesorero', true), (caja, socio_u, 'socio', true);

  -- Quién importa
  perform pg_temp.como(socio_u);
  e := pg_temp.error_de(format(imp, caja, 'socios', socios, false));
  perform pg_temp.anotar('Un socio no importa', e like 'DM404%', e);
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(imp, caja, 'otro', socios, false));
  perform pg_temp.anotar('Módulo desconocido: rechazado', e like 'DM400%', e);
  e := pg_temp.error_de(format(imp, caja, 'socios', '[]', false));
  perform pg_temp.anotar('Sin filas: rechazado', e like 'DM400%', e);

  -- Socios: simulacro, de verdad, todo o nada
  v := public.importar_excel(caja, 'socios', socios, true);
  n := (select count(*) from public.socios where caja_id = caja);
  perform pg_temp.anotar('Simulacro de socios: responde y no guarda',
    (v->>'simulado')::boolean and (v->>'socios')::int = 2 and n = 0, v::text || ', ' || n);
  v := public.importar_excel(caja, 'socios', socios, false);
  n := (select count(*) from public.socios where caja_id = caja);
  t := (select fecha_ingreso::text from public.socios where caja_id = caja and cedula = '1710034065');
  perform pg_temp.anotar('Importa dos socios con su fecha de ingreso',
    not (v->>'simulado')::boolean and n = 2 and t = '2024-02-01', n || ', ' || t);
  e := pg_temp.error_de(format(imp, caja, 'socios', '[
    {"fila": 2, "cedula": "0926687856", "nombre": "Rosa", "apellido": "Vera", "fecha_ingreso": "2024-03-01"},
    {"fila": 3, "cedula": "0102030400", "nombre": "Otra", "apellido": "Ana", "fecha_ingreso": "2024-03-01"}]', false));
  n := (select count(*) from public.socios where caja_id = caja);
  perform pg_temp.anotar('Cédula ya registrada: error con su fila y no entra nadie',
    e like 'DM400 Socios, fila 3 (Cédula): Ya está en la caja: Ana Pérez%' and n = 2, e || ', ' || n);
  e := pg_temp.error_de(format(imp, caja, 'socios', '[
    {"fila": 2, "cedula": "0926687856", "nombre": "Rosa", "apellido": "Vera", "fecha_ingreso": "2024-03-01"},
    {"fila": 3, "cedula": "0926687856", "nombre": "Rosa", "apellido": "Vera", "fecha_ingreso": "2024-03-01"}]', false));
  perform pg_temp.anotar('Cédula repetida en el archivo: rechazado', e like 'DM400 Socios, fila 3 (Cédula): Repetida%', e);
  e := pg_temp.error_de(format(imp, caja, 'socios', '[
    {"fila": 4, "cedula": "0102030401", "nombre": "Rosa", "apellido": "Vera", "fecha_ingreso": "2024-03-01"}]', false));
  perform pg_temp.anotar('Cédula inválida: el error de la ficha con su fila', e like 'DM400 Socios, fila 4: La cédula no es válida%', e);
  e := pg_temp.error_de(format(imp, caja, 'socios', '[
    {"fila": 2, "cedula": "0926687856", "nombre": "Rosa", "apellido": "Vera", "fecha_ingreso": "2023-12-31"}]', false));
  perform pg_temp.anotar('Ingreso antes de la fundación: rechazado', e like 'DM400 Socios, fila 2 (Fecha de ingreso): La fecha es anterior a la fundación de la caja (01/01/2024)%', e);
  e := pg_temp.error_de(format(imp, caja, 'socios', format('[
    {"fila": 2, "cedula": "0926687856", "nombre": "Rosa", "apellido": "Vera", "fecha_ingreso": "%s"}]',
    (now() at time zone 'America/Guayaquil')::date + 1), false));
  perform pg_temp.anotar('Ingreso después de hoy: rechazado', e like 'DM400%posterior a hoy%', e);

  -- Ahorros
  v := public.importar_excel(caja, 'ahorros', '[
    {"fila": 2, "cedula": "0102030400", "fecha": "2024-03-01", "tipo": "deposito", "monto": 100, "descripcion": "Aporte"},
    {"fila": 3, "cedula": "0102030400", "fecha": "2024-04-01", "tipo": "retiro", "monto": 30, "descripcion": ""},
    {"fila": 4, "cedula": "0102030400", "fecha": "2024-03-01", "tipo": "deposito", "monto": 20.5, "descripcion": "Mismo día"}]', false);
  select count(*) into n from public.cuentas_ahorro c join public.socios s on s.id = c.socio_id
  where c.caja_id = caja and s.cedula = '0102030400' and c.fecha_apertura = '2024-03-01' and c.saldo = 90.5;
  perform pg_temp.anotar('Abre la cuenta el día del primer movimiento y deja el saldo de los tres',
    n = 1 and (v->'cuentas'->0->>'nueva')::boolean and (v->'cuentas'->0->>'saldo_despues')::numeric = 90.5, v::text);
  t := (select string_agg(fecha || ' ' || saldo_posterior, ', ' order by fecha, created_at) from public.transacciones where caja_id = caja);
  perform pg_temp.anotar('Movimientos en orden de fecha y de fila, con su saldo',
    t = '2024-03-01 100.00, 2024-03-01 120.50, 2024-04-01 90.50', t);
  e := pg_temp.error_de(format(imp, caja, 'ahorros', '[
    {"fila": 2, "cedula": "0102030400", "fecha": "2024-05-01", "tipo": "deposito", "monto": 10},
    {"fila": 3, "cedula": "0102030400", "fecha": "2024-06-01", "tipo": "retiro", "monto": 200}]', false));
  v_num := (select saldo from public.cuentas_ahorro c join public.socios s on s.id = c.socio_id where c.caja_id = caja and s.cedula = '0102030400');
  perform pg_temp.anotar('Retiro que no alcanza: rechazado y el depósito de antes tampoco entra',
    e like 'DM400 Movimientos, fila 3 (Monto): El 01/06/2024 la cuenta de Ana Pérez tiene $100,50: no alcanza para retirar $200,00%' and v_num = 90.5,
    e || ', ' || v_num);
  e := pg_temp.error_de(format(imp, caja, 'ahorros', '[
    {"fila": 2, "cedula": "0102030400", "fecha": "2024-03-15", "tipo": "deposito", "monto": 10}]', false));
  perform pg_temp.anotar('Anterior al último movimiento de la cuenta: rechazado', e like 'DM400%hasta el 01/04/2024%', e);
  e := pg_temp.error_de(format(imp, caja, 'ahorros', '[
    {"fila": 2, "cedula": "1710034065", "fecha": "2024-01-20", "tipo": "deposito", "monto": 10}]', false));
  perform pg_temp.anotar('Antes del ingreso del socio: rechazado', e like 'DM400%anterior al ingreso de Luis Mora (01/02/2024)%', e);
  e := pg_temp.error_de(format(imp, caja, 'ahorros', '[
    {"fila": 2, "cedula": "0926687856", "fecha": "2024-05-20", "tipo": "deposito", "monto": 10}]', false));
  perform pg_temp.anotar('Cédula que no está en la caja: rechazado', e like 'DM400 Movimientos, fila 2 (Cédula): No hay un socio%', e);
  e := pg_temp.error_de(format(imp, caja, 'ahorros', '[
    {"fila": 2, "cedula": "0102030400", "fecha": "2024-05-20", "tipo": "deposito", "monto": 10.555}]', false));
  perform pg_temp.anotar('Monto con tres decimales: rechazado', e like 'DM400%dos decimales%', e);

  -- Fondos
  v := public.importar_excel(caja, 'fondos', '[
    {"fila": 2, "fondo": "Fondo  de eventos", "fecha": "2024-02-10", "tipo": "deposito", "monto": 50, "descripcion": "Rifa"},
    {"fila": 3, "fondo": "fondo de eventos", "fecha": "2024-02-20", "tipo": "retiro", "monto": 20, "descripcion": "Compra"}]', false);
  select count(*), max(saldo) into n, v_num from public.fondos_caja where caja_id = caja;
  perform pg_temp.anotar('Crea el fondo una vez y deja su saldo',
    n = 1 and v_num = 30 and (v->'fondos'->0->>'nuevo')::boolean, n || ', ' || v_num || ', ' || v::text);
  perform set_config('role', 'postgres', true);
  update public.fondos_caja set activo = false where caja_id = caja;
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(imp, caja, 'fondos', '[
    {"fila": 2, "fondo": "Fondo de eventos", "fecha": "2024-03-10", "tipo": "deposito", "monto": 5, "descripcion": "Rifa"}]', false));
  perform pg_temp.anotar('Fondo cerrado: rechazado', e like 'DM400%está cerrado%', e);
  perform set_config('role', 'postgres', true);
  update public.fondos_caja set activo = true where caja_id = caja;

  -- Créditos: 1.200 al 12 % en 12 meses (cuota: 100 de capital y 12 de interés)
  update public.cajas set monto_maximo_credito = 500 where id = caja;
  perform pg_temp.como(tes);
  v := public.importar_excel(caja, 'creditos', '[
    {"fila": 2, "referencia": 1, "cedula": "0102030400", "monto": 1200, "tasa_interes": 12, "plazo_meses": 12, "fecha_desembolso": "2024-02-01",
     "pagos": [{"fila": 2, "fecha": "2024-03-01", "capital": 100, "interes": 5},
               {"fila": 3, "fecha": "2024-04-01", "capital": 100, "interes": 5},
               {"fila": 4, "fecha": "2024-05-01", "capital": 100, "interes": 5}]},
    {"fila": 3, "referencia": 2, "cedula": "1710034065", "monto": 1200, "tasa_interes": 12, "plazo_meses": 12, "fecha_desembolso": "2024-02-01",
     "pagos": [{"fila": 5, "fecha": "2024-06-01", "capital": 1200, "interes": 50}]},
    {"fila": 4, "referencia": 3, "cedula": "1710034065", "monto": 1200, "tasa_interes": 12, "plazo_meses": 12, "fecha_desembolso": "2024-02-01",
     "pagos": [{"fila": 6, "fecha": "2024-03-01", "capital": 250, "interes": 30}]},
    {"fila": 5, "referencia": 4, "cedula": "1710034065", "monto": 300, "tasa_interes": 10, "plazo_meses": 6, "fecha_desembolso": "2024-07-01", "pagos": []}
  ]', false);
  perform pg_temp.anotar('El monto máximo de la caja no se aplica a lo importado', jsonb_array_length((v->'creditos')::jsonb) = 4, v::text);

  select * into cred from public.creditos where caja_id = caja and numero = (v->'creditos'->0->>'numero')::int;
  perform pg_temp.anotar('Tres cuotas pagadas con menos interés: saldadas, el resto con la fórmula',
    cred.estado = 'activo' and cred.saldo_pendiente = 1008 and cred.interes_condonado = 21 and cred.monto_total = 1344
      and cred.fecha_vencimiento = '2025-02-01',
    cred.estado || ' saldo ' || cred.saldo_pendiente || ' condonado ' || cred.interes_condonado || ' total ' || cred.monto_total || ' vence ' || cred.fecha_vencimiento);
  t := (select string_agg(numero_cuota || ':' || monto_capital || '+' || monto_interes || ' ' || saldo_antes || '>' || saldo_despues, ', ' order by fecha_pago)
        from public.pagos_credito where credito_id = cred.id and es_importado);
  perform pg_temp.anotar('Un pago por cuota, marcado como importado, con el saldo de antes y después',
    t = '1:100.00+5.00 1323.00>1218.00, 2:100.00+5.00 1218.00>1113.00, 3:100.00+5.00 1113.00>1008.00', t);

  select * into cred from public.creditos where caja_id = caja and numero = (v->'creditos'->1->>'numero')::int;
  n := (select count(*) from public.pagos_credito where credito_id = cred.id);
  perform pg_temp.anotar('Todo el capital pagado: pagado, aunque el interés no cuadre',
    cred.estado = 'pagado' and cred.saldo_pendiente = 0 and cred.interes_condonado = 94 and n = 12,
    cred.estado || ' saldo ' || cred.saldo_pendiente || ' condonado ' || cred.interes_condonado || ', ' || n || ' partes');

  select * into cred from public.creditos where caja_id = caja and numero = (v->'creditos'->2->>'numero')::int;
  t := (select string_agg(numero_cuota || ':' || monto_capital || '+' || monto_interes, ', ' order by numero_cuota)
        from public.pagos_credito where credito_id = cred.id);
  perform pg_temp.anotar('Un pago de dos cuotas y media: capital en orden e interés según el capital',
    t = '1:100.00+12.00, 2:100.00+12.00, 3:50.00+6.00' and cred.saldo_pendiente = 1064 and cred.interes_condonado = 0,
    t || ' saldo ' || cred.saldo_pendiente);

  select * into cred from public.creditos where caja_id = caja and numero = (v->'creditos'->3->>'numero')::int;
  perform pg_temp.anotar('Crédito sin pagos: activo con el total de la fórmula',
    cred.estado = 'activo' and cred.saldo_pendiente = 315 and cred.monto_total = 315 and cred.aprobado_por = tes,
    cred.estado || ' ' || cred.saldo_pendiente);

  n := (select count(*) from public.creditos where caja_id = caja);
  v := public.importar_excel(caja, 'creditos', '[
    {"fila": 2, "referencia": 1, "cedula": "0102030400", "monto": 100, "tasa_interes": 12, "plazo_meses": 2, "fecha_desembolso": "2024-02-01", "pagos": []}]', true);
  perform pg_temp.anotar('Simulacro de créditos: da el número que tendría y no guarda',
    (v->>'simulado')::boolean and (v->'creditos'->0->>'numero')::int = n + 1
      and (select count(*) from public.creditos where caja_id = caja) = n, v::text);
  e := pg_temp.error_de(format(imp, caja, 'creditos', '[
    {"fila": 2, "referencia": 9, "cedula": "0102030400", "monto": 100, "tasa_interes": 12, "plazo_meses": 2, "fecha_desembolso": "2024-02-01",
     "pagos": [{"fila": 7, "fecha": "2024-03-01", "capital": 150, "interes": 0}]}]', false));
  perform pg_temp.anotar('Más capital que lo prestado: rechazado', e like 'DM400 Pagos, fila 7: Los pagos del crédito N.º 9 suman más capital%', e);
  e := pg_temp.error_de(format(imp, caja, 'creditos', '[
    {"fila": 2, "referencia": 9, "cedula": "0102030400", "monto": 100, "tasa_interes": 12, "plazo_meses": 2, "fecha_desembolso": "2024-02-01",
     "pagos": [{"fila": 7, "fecha": "2024-01-20", "capital": 10, "interes": 0}]}]', false));
  perform pg_temp.anotar('Pago antes del desembolso: rechazado', e like 'DM400 Pagos, fila 7 (Fecha): Es anterior al desembolso%', e);
  e := pg_temp.error_de(format(imp, caja, 'creditos', '[
    {"fila": 2, "referencia": 9, "cedula": "0102030400", "monto": 100, "tasa_interes": 12.345, "plazo_meses": 2, "fecha_desembolso": "2024-02-01", "pagos": []}]', false));
  perform pg_temp.anotar('Tasa con tres decimales: rechazada', e like 'DM400%Tasa anual%', e);
  perform set_config('role', 'postgres', true);
  n := (select count(*) from public.creditos where caja_id = caja);
  perform pg_temp.anotar('El monto máximo sigue rigiendo fuera de la importación',
    pg_temp.error_de(format('insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses, monto_total, cuota_mensual, saldo_pendiente) select %L, id, 600, 12, 12, 0, 0, 0 from public.socios where caja_id = %L limit 1', caja, caja)) like 'DM400%máximo%', n::text);

  -- Caja bloqueada
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(imp, caja, 'socios', socios, false));
  perform pg_temp.anotar('Caja bloqueada: no se importa', e like 'DM409%', e);

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
  raise exception E'IMPORTACIÓN: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
