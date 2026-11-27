-- Prueba de cerrar y reabrir una cuenta de ahorro (Etapa 7, T1; migraciones 005 y 019).
--
-- QUÉ HACE: dentro de una transacción crea una caja con un socio y su cuenta, y comprueba
-- que la cuenta no se cierre con saldo, que se cierre en 0 con la fecha de hoy, que
-- cerrada no admita movimientos, que se reabra con la ficha activa y que no se reabra si
-- el titular está inactivo.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "CUENTAS: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000f2';
  caja uuid; ana uuid; cta uuid;
  e text; c record; hoy date := (now() at time zone 'America/Guayaquil')::date;
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.cuentas@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de cuentas', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform set_config('role', 'postgres', true);
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01') returning id into ana;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values
    (caja, ana, 'PRUEBA-001') returning id into cta;

  perform pg_temp.como(coord);
  perform public.registrar_movimiento(caja, cta, 'deposito', 25, 'prueba');
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = %L where id = %L', 'cerrada', cta));
  perform pg_temp.anotar('Con saldo no se cierra', e like 'DM400%', e);

  perform public.registrar_movimiento(caja, cta, 'retiro', 25, 'prueba');
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = %L where id = %L', 'cerrada', cta));
  select estado, fecha_cierre into c from public.cuentas_ahorro where id = cta;
  perform pg_temp.anotar('En 0 se cierra, con la fecha de hoy', e = 'sin error' and c.estado = 'cerrada' and c.fecha_cierre = hoy, e || ' ' || c.estado || ' ' || coalesce(c.fecha_cierre::text, 'null'));

  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, %L, 10, %L)', caja, cta, 'deposito', 'prueba'));
  perform pg_temp.anotar('Cerrada no admite depósitos', e <> 'sin error', e);

  update public.socios set activo = false, updated_at = now() where id = ana;
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = %L where id = %L', 'activa', cta));
  perform pg_temp.anotar('Con el titular inactivo no se reabre', e like 'DM409%', e);

  update public.socios set activo = true, direccion = 'Calle nueva 2', updated_at = now() where id = ana;
  e := pg_temp.error_de(format('update public.cuentas_ahorro set estado = %L where id = %L', 'activa', cta));
  select estado, fecha_cierre into c from public.cuentas_ahorro where id = cta;
  perform pg_temp.anotar('Con la ficha activa se reabre y pierde la fecha de cierre', e = 'sin error' and c.estado = 'activa' and c.fecha_cierre is null, e || ' ' || c.estado);

  e := pg_temp.error_de(format('select public.registrar_movimiento(%L, %L, %L, 10, %L)', caja, cta, 'deposito', 'prueba'));
  perform pg_temp.anotar('Reabierta admite depósitos', e = 'sin error', e);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'CUENTAS: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
