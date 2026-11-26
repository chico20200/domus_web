-- Prueba de la foto de perfil y de la caja (Etapa 6, T17; migración 012).
--
-- QUÉ HACE: dentro de una transacción crea cuentas y una caja, pone filas en los buckets
-- perfiles y cajas (como lo haría la API de Storage) y comprueba quién pone qué foto.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "FOTOS: 18 de 18 casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000e1';
  teso uuid := 'd0000000-0000-4000-8000-0000000000e2';
  otro uuid := 'd0000000-0000-4000-8000-0000000000e3';
  caja uuid; otra_caja uuid;
  e text; t text; r json;
  perfil text := 'select public.poner_foto_perfil(%L)';
  de_caja text := 'select public.poner_foto_caja(%L, %L)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.foto@prueba.domus', 'authenticated', 'authenticated'),
    (teso, 'teso.foto@prueba.domus', 'authenticated', 'authenticated'),
    (otro, 'otro.foto@prueba.domus', 'authenticated', 'authenticated');

  t := (select coalesce(foto, 'null') from public.profiles where id = otro);
  perform pg_temp.anotar('Una cuenta nueva nace sin foto', t = 'null', t);

  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de fotos', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform pg_temp.como(otro);
  otra_caja := (public.crear_caja('Otra caja de fotos', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, teso, 'tesorero', true);
  insert into storage.objects (bucket_id, name) values
    ('perfiles', coord || '/a.jpg'), ('perfiles', coord || '/b.jpg'), ('perfiles', otro || '/x.jpg'),
    ('cajas', caja || '/a.jpg'), ('cajas', caja || '/b.jpg'), ('cajas', otra_caja || '/x.jpg');

  -- Perfil
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(perfil, otro || '/x.jpg'));
  perform pg_temp.anotar('Perfil: la foto de otra cuenta no', e = 'DM400', e);
  e := pg_temp.error_de(format(perfil, coord || '/no-existe.jpg'));
  perform pg_temp.anotar('Perfil: una foto que no está en Storage no', e = 'DM400', e);
  r := public.poner_foto_perfil(coord || '/a.jpg');
  t := (select foto from public.profiles where id = coord);
  perform pg_temp.anotar('Perfil: la propia sí', t = coord || '/a.jpg', coalesce(t, 'nada'));
  r := public.poner_foto_perfil(coord || '/b.jpg');
  perform pg_temp.anotar('Perfil: al cambiarla devuelve la anterior', r->>'anterior' = coord || '/a.jpg', r::text);
  r := public.poner_foto_perfil(null);
  t := (select coalesce(foto, 'null') from public.profiles where id = coord);
  perform pg_temp.anotar('Perfil: quitarla', t = 'null' and r->>'anterior' = coord || '/b.jpg', t);
  e := pg_temp.error_de(format('update public.profiles set foto = %L where id = %L', otro || '/x.jpg', coord));
  perform pg_temp.anotar('Perfil: nadie escribe la ruta a mano', e = '42501', e);
  e := pg_temp.error_de(format('update public.profiles set nombre = %L where id = %L', 'Ana', coord));
  perform pg_temp.anotar('Perfil: el nombre se sigue validando', e = 'DM400', e);
  e := pg_temp.error_de(format('update public.profiles set nombre = %L where id = %L', 'Carmen Ruiz', coord));
  perform pg_temp.anotar('Perfil: y se sigue editando', e = 'sin error', e);

  -- Caja
  perform pg_temp.como(teso);
  e := pg_temp.error_de(format(de_caja, caja, caja || '/a.jpg'));
  perform pg_temp.anotar('Caja: el tesorero no la cambia', e = 'DM404', e);
  perform pg_temp.como(otro);
  e := pg_temp.error_de(format(de_caja, caja, caja || '/a.jpg'));
  perform pg_temp.anotar('Caja: el coordinador de otra caja no', e = 'DM404', e);
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(de_caja, caja, otra_caja || '/x.jpg'));
  perform pg_temp.anotar('Caja: la foto de otra caja no', e = 'DM400', e);
  e := pg_temp.error_de(format(de_caja, caja, caja || '/no-existe.jpg'));
  perform pg_temp.anotar('Caja: una foto que no está en Storage no', e = 'DM400', e);
  r := public.poner_foto_caja(caja, caja || '/a.jpg');
  t := (select foto from public.cajas where id = caja);
  perform pg_temp.anotar('Caja: el coordinador sí', t = caja || '/a.jpg', coalesce(t, 'nada'));
  r := public.poner_foto_caja(caja, null);
  t := (select coalesce(foto, 'null') from public.cajas where id = caja);
  perform pg_temp.anotar('Caja: quitarla devuelve la anterior', t = 'null' and r->>'anterior' = caja || '/a.jpg', r::text);
  e := pg_temp.error_de(format('update public.cajas set foto = %L where id = %L', caja || '/b.jpg', caja));
  perform pg_temp.anotar('Caja: nadie escribe la ruta a mano', e = '42501', e);

  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(de_caja, caja, caja || '/b.jpg'));
  perform pg_temp.anotar('Caja bloqueada: no se cambia la foto', e = 'DM409', e);

  perform pg_temp.como(null);
  e := pg_temp.error_de(format(perfil, coord || '/a.jpg'));
  perform pg_temp.anotar('Sin sesión: nada', e in ('DM403', '42501'), e);

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
  raise exception E'FOTOS: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
