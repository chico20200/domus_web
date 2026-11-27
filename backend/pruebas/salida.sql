-- Prueba de la fecha de salida del socio (Etapa 6, T24; migración 018).
--
-- QUÉ HACE: dentro de una transacción crea una caja con dos socios y comprueba que la
-- base anote la fecha de salida al desactivar una ficha, que la conserve al editarla,
-- que la quite al reactivarla y que nadie la escriba a mano.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "SALIDA: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000f1';
  caja uuid; ana uuid; luis uuid;
  e text; d date; hoy date := (now() at time zone 'America/Guayaquil')::date;
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.salida@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de salidas', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform set_config('role', 'postgres', true);
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01') returning id into ana;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '1710034065', 'Luis', 'Mora', '2024-01-01') returning id into luis;

  perform pg_temp.como(coord);
  select fecha_salida into d from public.socios where id = ana;
  perform pg_temp.anotar('Un socio activo no tiene fecha de salida', d is null, coalesce(d::text, 'null'));
  update public.socios set activo = false, updated_at = now() where id = ana;
  select fecha_salida into d from public.socios where id = ana;
  perform pg_temp.anotar('Al desactivarlo, la base anota hoy', d = hoy, coalesce(d::text, 'null'));
  update public.socios set telefono = '0991234567', updated_at = now() where id = ana;
  select fecha_salida into d from public.socios where id = ana;
  perform pg_temp.anotar('Editar la ficha inactiva no cambia la fecha', d = hoy, coalesce(d::text, 'null'));
  e := pg_temp.error_de(format('update public.socios set fecha_salida = %L where id = %L', '2024-06-01', ana));
  perform pg_temp.anotar('Nadie escribe la fecha de salida a mano', e like '42501%', e);
  update public.socios set activo = true, updated_at = now() where id = ana;
  select fecha_salida into d from public.socios where id = ana;
  perform pg_temp.anotar('Al reactivarlo, se quita', d is null, coalesce(d::text, 'null'));

  perform set_config('role', 'postgres', true);
  e := pg_temp.error_de(format('update public.socios set fecha_ingreso = %L, activo = false where id = %L', '2099-01-01', luis));
  perform pg_temp.anotar('Nunca antes del ingreso: con ingreso futuro, la salida es ese día',
    e = 'sin error' and (select fecha_salida from public.socios where id = luis) = '2099-01-01', e);
  e := pg_temp.error_de(format('insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, activo, fecha_salida) values (%L, %L, %L, %L, %L, false, %L)',
    caja, '0926687856', 'Rosa', 'Vera', '2024-05-01', '2024-03-01'));
  perform pg_temp.anotar('Una salida anterior al ingreso: rechazada', e like '23514%', e);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'SALIDA: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
