-- Prueba de los comprobantes (Etapa 6, T16; migración 011).
--
-- QUÉ HACE: dentro de una transacción registra un depósito y un pago, pone filas en el
-- bucket comprobantes (como lo haría la API de Storage) y comprueba quién une una foto a
-- un registro y con qué ruta.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "COMPROBANTES: 11 de 11 casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000f1';
  socio_u uuid := 'd0000000-0000-4000-8000-0000000000f2';
  caja uuid; s1 uuid; s2 uuid; cuenta uuid; credito uuid; mov uuid; pago uuid;
  e text; t text;
  adjuntar text := 'select public.adjuntar_comprobante(%L, %L, %L)';
  subir text := 'insert into storage.objects (bucket_id, name) values (''comprobantes'', %L)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.comprobante@prueba.domus', 'authenticated', 'authenticated'),
    (socio_u, 'socio.comprobante@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de comprobantes', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (caja, '1710034065', 'Ana', 'Uno') returning id into s1;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (caja, '1104680135', 'Beto', 'Dos') returning id into s2;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, s1, 'CA-COMP-1') returning id into cuenta;
  mov := ((public.registrar_movimiento(caja, cuenta, 'deposito', 50))->'transaccion'->>'id')::uuid;
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
  values (caja, s1, 300, 12, 3) returning id into credito;
  update public.creditos set estado = 'activo', fecha_desembolso = '2026-01-01', fecha_vencimiento = '2026-04-01' where id = credito;
  pago := ((public.registrar_pago_credito(caja, credito, 309, 1, 100, 3, 'cuota'))->'pago'->>'id')::uuid;
  execute format(subir, caja || '/' || s1 || '/m.jpg');
  execute format(subir, caja || '/' || s1 || '/p.jpg');
  execute format(subir, caja || '/' || s2 || '/otro.jpg');

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, socio_u, 'socio', true);

  -- Quién
  perform pg_temp.como(socio_u);
  e := pg_temp.error_de(format(adjuntar, 'movimiento', mov, caja || '/' || s1 || '/m.jpg'));
  perform pg_temp.anotar('Un socio no adjunta', e = 'DM404', e);

  -- Qué ruta
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(adjuntar, 'movimiento', mov, caja || '/' || s2 || '/otro.jpg'));
  perform pg_temp.anotar('Foto de la carpeta de otro socio: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(adjuntar, 'movimiento', mov, caja || '/' || s1 || '/no-existe.jpg'));
  perform pg_temp.anotar('Foto que no está en Storage: rechazada', e = 'DM400', e);
  e := pg_temp.error_de(format(adjuntar, 'otro', mov, caja || '/' || s1 || '/m.jpg'));
  perform pg_temp.anotar('Tipo desconocido: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(adjuntar, 'pago', mov, caja || '/' || s1 || '/m.jpg'));
  perform pg_temp.anotar('Id de un movimiento como pago: no se encuentra', e = 'DM404', e);

  -- Bien
  e := pg_temp.error_de(format(adjuntar, 'movimiento', mov, caja || '/' || s1 || '/m.jpg'));
  t := (select comprobante from public.transacciones where id = mov);
  perform pg_temp.anotar('Depósito: la foto queda unida', e = 'sin error' and t = caja || '/' || s1 || '/m.jpg', e || ' → ' || coalesce(t, 'nada'));
  e := pg_temp.error_de(format(adjuntar, 'pago', pago, caja || '/' || s1 || '/p.jpg'));
  t := (select comprobante from public.pagos_credito where id = pago);
  perform pg_temp.anotar('Pago: la foto queda unida', e = 'sin error' and t = caja || '/' || s1 || '/p.jpg', e || ' → ' || coalesce(t, 'nada'));

  -- No se cambia
  e := pg_temp.error_de(format(adjuntar, 'movimiento', mov, caja || '/' || s1 || '/p.jpg'));
  perform pg_temp.anotar('Un registro con foto no la cambia', e = 'DM409', e);
  e := pg_temp.error_de(format('update public.transacciones set comprobante = null where id = %L', mov));
  perform pg_temp.anotar('Nadie quita la foto a mano', e = '42501', e);
  e := pg_temp.error_de(format('update public.pagos_credito set comprobante = null where id = %L', pago));
  perform pg_temp.anotar('Ni la de un pago', e = '42501', e);

  -- Caja bloqueada
  perform set_config('role', 'postgres', true);
  update public.transacciones set comprobante = null where id = mov;
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(adjuntar, 'movimiento', mov, caja || '/' || s1 || '/m.jpg'));
  perform pg_temp.anotar('Caja bloqueada: no se adjunta', e = 'DM409', e);

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
  raise exception E'COMPROBANTES: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
