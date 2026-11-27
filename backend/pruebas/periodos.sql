-- Prueba de los periodos de membresía (Etapa 7, T2; migración 020).
--
-- QUÉ HACE: dentro de una transacción crea una caja con fichas y comprueba que la base
-- lleve sus periodos: el primero al crear la ficha, cerrado al desactivarla, uno nuevo al
-- reactivarla, el inicio del primero al corregir la fecha de ingreso, una ficha importada
-- ya inactiva con su periodo cerrado, y que nadie escriba los periodos a mano ni vea los
-- de otro socio.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "PERIODOS: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000f3';
  socio uuid := 'd0000000-0000-4000-8000-0000000000f4';
  caja uuid; ana uuid; luis uuid; rosa uuid;
  e text; n int; t text; hoy date := (now() at time zone 'America/Guayaquil')::date;
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.periodos@prueba.domus', 'authenticated', 'authenticated'),
    (socio, 'luis.periodos@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de periodos', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol) values (caja, socio, 'socio');
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01') returning id into ana;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, user_id) values
    (caja, '1710034065', 'Luis', 'Mora', '2024-03-01', socio) returning id into luis;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, activo, fecha_salida) values
    (caja, '0926687856', 'Rosa', 'Vera', '2024-02-01', false, '2024-09-30') returning id into rosa;

  perform pg_temp.como(coord);
  select string_agg(ingreso || '→' || coalesce(salida::text, 'abierto'), ', ') into t from public.periodos_socio where socio_id = ana;
  perform pg_temp.anotar('Ficha nueva: un periodo abierto desde su ingreso', t = '2024-01-01→abierto', t);
  select string_agg(ingreso || '→' || coalesce(salida::text, 'abierto'), ', ') into t from public.periodos_socio where socio_id = rosa;
  perform pg_temp.anotar('Ficha importada inactiva: su periodo ya cerrado', t = '2024-02-01→2024-09-30', t);

  update public.socios set activo = false, updated_at = now() where id = ana;
  select string_agg(ingreso || '→' || coalesce(salida::text, 'abierto'), ', ') into t from public.periodos_socio where socio_id = ana;
  perform pg_temp.anotar('Desactivar cierra el periodo hoy', t = '2024-01-01→' || hoy, t);

  update public.socios set activo = true, updated_at = now() where id = ana;
  select string_agg(ingreso || '→' || coalesce(salida::text, 'abierto'), ', ' order by ingreso, salida nulls last) into t from public.periodos_socio where socio_id = ana;
  perform pg_temp.anotar('Reactivar abre un periodo nuevo desde hoy', t = '2024-01-01→' || hoy || ', ' || hoy || '→abierto', t);
  select fecha_ingreso::text into t from public.socios where id = ana;
  perform pg_temp.anotar('La ficha conserva su primer ingreso', t = '2024-01-01', t);

  perform set_config('role', 'postgres', true);
  update public.socios set fecha_ingreso = '2024-02-15' where id = luis;
  select string_agg(ingreso::text, ', ') into t from public.periodos_socio where socio_id = luis;
  perform pg_temp.anotar('Corregir el ingreso mueve el inicio del primer periodo', t = '2024-02-15', t);
  e := pg_temp.error_de(format('update public.socios set fecha_ingreso = %L where id = %L', '2024-12-01', rosa));
  perform pg_temp.anotar('El ingreso no pasa de la primera salida', e like 'DM409%' or e like '23514%', e);

  perform pg_temp.como(coord);
  e := pg_temp.error_de(format('insert into public.periodos_socio (caja_id, socio_id, ingreso) values (%L, %L, %L)', caja, ana, '2020-01-01'));
  perform pg_temp.anotar('Nadie inserta periodos a mano', e like '42501%', e);
  e := pg_temp.error_de(format('update public.periodos_socio set salida = %L where socio_id = %L', '2024-05-01', luis));
  n := (select count(*) from public.periodos_socio where socio_id = luis and salida is not null);
  perform pg_temp.anotar('Nadie los cambia a mano', e like '42501%' and n = 0, e);
  n := (select count(*) from public.periodos_socio where caja_id = caja);
  perform pg_temp.anotar('El coordinador ve todos los de su caja', n = 4, n::text);

  perform pg_temp.como(socio);
  n := (select count(*) from public.periodos_socio where caja_id = caja);
  perform pg_temp.anotar('El socio ve solo los suyos', n = 1, n::text);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'PERIODOS: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
