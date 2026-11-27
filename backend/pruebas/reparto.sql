-- Prueba del tipo de reparto por ciclo y del sobrante a Fondos (Etapa 6, T23; migración 017).
--
-- QUÉ HACE: dentro de una transacción crea una caja fundada el 1 ene 2024 con ciclos
-- de 12 meses, socios y un fondo, y comprueba quién elige el tipo, que se guarde en el
-- ciclo actual y quién pasa el sobrante de un ciclo cerrado, una sola vez.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "REPARTO: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000e1';
  tes uuid := 'd0000000-0000-4000-8000-0000000000e2';
  socio_u uuid := 'd0000000-0000-4000-8000-0000000000e3';
  caja uuid; fondo uuid;
  e text; t text; n int; v_num numeric;
  vigente date;
  elegir text := 'select public.cambiar_tipo_reparto(%L, %L)';
  sobra text := 'select public.pasar_sobrante_a_fondo(%L, %L, %L, %s, %L)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.reparto@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.reparto@prueba.domus', 'authenticated', 'authenticated'),
    (socio_u, 'socio.reparto@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de reparto', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values
    (caja, tes, 'tesorero', true), (caja, socio_u, 'socio', true);
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01'),
    (caja, '1710034065', 'Luis', 'Mora', '2024-01-01'),
    (caja, '0926687856', 'Rosa', 'Vera', '2024-01-01');
  vigente := private.inicio_ciclo_vigente(caja, (now() at time zone 'America/Guayaquil')::date);

  -- Tipo de reparto
  perform pg_temp.como(socio_u);
  e := pg_temp.error_de(format(elegir, caja, 'equitativa'));
  perform pg_temp.anotar('Un socio no cambia el reparto', e like 'DM404%', e);
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(elegir, caja, 'equitativa'));
  perform pg_temp.anotar('El tesorero tampoco: es del coordinador', e like 'DM404%', e);
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(elegir, caja, 'mitad'));
  perform pg_temp.anotar('Tipo desconocido: rechazado', e like 'DM400%', e);
  e := pg_temp.error_de(format(elegir, caja, 'equitativa'));
  select string_agg(inicio || ' ' || tipo, ', ') into t from public.repartos_ciclo where caja_id = caja;
  perform pg_temp.anotar('El coordinador elige la equitativa: queda en el ciclo actual',
    e = 'sin error' and t = vigente || ' equitativa', e || ', ' || t);
  e := pg_temp.error_de(format(elegir, caja, 'diferenciada'));
  select count(*), max(tipo) into n, t from public.repartos_ciclo where caja_id = caja;
  perform pg_temp.anotar('Cambiar otra vez reemplaza la del mismo ciclo', n = 1 and t = 'diferenciada', n || ' ' || t);
  perform pg_temp.como(socio_u);
  n := (select count(*) from public.repartos_ciclo where caja_id = caja);
  perform pg_temp.anotar('Un socio ve el tipo de su caja', n = 1, n::text);
  e := pg_temp.error_de(format('insert into public.repartos_ciclo (caja_id, inicio, tipo) values (%L, %L, %L)', caja, '2024-01-01', 'equitativa'));
  perform pg_temp.anotar('Nadie escribe la tabla a mano', e like '42501%', e);

  -- Sobrante a Fondos
  perform pg_temp.como(tes);
  fondo := (public.crear_fondo(caja, 'Fondo social')->>'id')::uuid;
  perform pg_temp.como(socio_u);
  e := pg_temp.error_de(format(sobra, caja, '2024-01-01', '2024-12-31', 0.02, fondo));
  perform pg_temp.anotar('Un socio no pasa el sobrante', e like 'DM404%', e);
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(sobra, caja, vigente, (vigente + interval '12 months' - interval '1 day')::date, 0.02, fondo));
  perform pg_temp.anotar('Ciclo en curso: todavía no', e like 'DM400%ya cerró%', e);
  e := pg_temp.error_de(format(sobra, caja, '2024-01-01', '2024-12-31', 0.04, fondo));
  perform pg_temp.anotar('Más de un centavo por socio (3 socios, $0,04): rechazado', e like 'DM400%centavo por socio%', e);
  e := pg_temp.error_de(format(sobra, caja, '2024-01-01', '2024-12-31', 0, fondo));
  perform pg_temp.anotar('Sobrante en 0: rechazado', e like 'DM400%', e);
  e := pg_temp.error_de(format(sobra, caja, '2024-01-01', '2024-12-31', 0.02, fondo));
  select saldo into v_num from public.fondos_caja where id = fondo;
  select descripcion into t from public.movimientos_fondo where fondo_id = fondo;
  perform pg_temp.anotar('Pasa $0,02 del ciclo 2024 al fondo, con su descripción',
    e = 'sin error' and v_num = 0.02 and t = 'Centavos que sobraron del reparto de intereses del ciclo 01/01/2024 – 31/12/2024',
    e || ', ' || v_num || ', ' || t);
  n := (select count(*) from public.sobrantes_ciclo where caja_id = caja);
  perform pg_temp.anotar('Queda anotado y el tesorero lo ve', n = 1, n::text);
  e := pg_temp.error_de(format(sobra, caja, '2024-01-01', '2024-12-31', 0.01, fondo));
  perform pg_temp.anotar('Una segunda vez en el mismo ciclo: rechazado', e like 'DM409%ya se pasó%', e);
  fondo := (public.crear_fondo(caja, 'Fondo cerrado')->>'id')::uuid;
  perform public.cambiar_estado_fondo(caja, fondo, false);
  e := pg_temp.error_de(format(sobra, caja, '2025-01-01', '2025-12-31', 0.01, fondo));
  n := (select count(*) from public.sobrantes_ciclo where caja_id = caja);
  perform pg_temp.anotar('Fondo cerrado: rechazado y no se anota', e like 'DM409%cerrado%' and n = 1, e || ', ' || n);

  -- Caja bloqueada
  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(elegir, caja, 'equitativa'));
  perform pg_temp.anotar('Caja bloqueada: no se cambia el reparto', e like 'DM409%', e);

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
  raise exception E'REPARTO: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
