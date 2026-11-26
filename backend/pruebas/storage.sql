-- Prueba de las políticas de Storage (Etapa 6, T15; migración 010).
--
-- QUÉ HACE: crea dentro de una transacción dos cajas con sus cuentas y escribe y lee
-- directamente en storage.objects con el rol de cada cuenta, que es lo que hace la API de
-- Storage con su token. No sube archivos de verdad: comprueba quién puede crear, ver,
-- cambiar y borrar cada fila. Los límites de tamaño y de tipo los aplica la API de
-- Storage, no la tabla, así que aquí no se prueban.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "STORAGE: 25 de 25 casos pasan" y la lista de casos.

begin;

-- Storage bloquea los DELETE directos con un trigger salvo que la sesión active esta
-- opción, que es lo que hace la API de Storage. Las políticas se siguen aplicando.
select set_config('storage.allow_delete_query', 'true', true);

create temp table resultados (n serial, caso text, ok boolean, detalle text) on commit drop;
grant insert, select on resultados to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

create function pg_temp.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  if p_usuario is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

create function pg_temp.error_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'sin error';
exception when others then
  return sqlstate;
end $$;

-- Filas que afecta una sentencia (un UPDATE o DELETE sin política no falla: no toca nada)
create function pg_temp.filas(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function pg_temp.anotar(p_caso text, p_ok boolean, p_detalle text) returns void
language sql as $$ insert into resultados (caso, ok, detalle) values (p_caso, p_ok, p_detalle) $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

do $casos$
declare
  coord uuid := 'd0000000-0000-4000-8000-0000000000e1';
  tes uuid := 'd0000000-0000-4000-8000-0000000000e2';
  socio uuid := 'd0000000-0000-4000-8000-0000000000e3';
  ajeno uuid := 'd0000000-0000-4000-8000-0000000000e4';
  a uuid; b uuid; s1 uuid; s2 uuid; sb uuid;
  e text; n bigint;
  subir text := 'insert into storage.objects (bucket_id, name) values (%L, %L)';
  ver text := 'select 1 from storage.objects where bucket_id = %L and name = %L';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.storage@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.storage@prueba.domus', 'authenticated', 'authenticated'),
    (socio, 'socio.storage@prueba.domus', 'authenticated', 'authenticated'),
    (ajeno, 'ajeno.storage@prueba.domus', 'authenticated', 'authenticated');

  perform pg_temp.como(coord);
  a := (public.crear_caja('Caja A de storage', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (a, '1710034065', 'Socia', 'Vinculada') returning id into s1;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (a, '1104680135', 'Otro', 'Socio') returning id into s2;
  perform pg_temp.como(ajeno);
  b := (public.crear_caja('Caja B de storage', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido) values (b, '1710034065', 'De', 'Otra') returning id into sb;

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values
    (a, tes, 'tesorero', true), (a, socio, 'socio', true);
  update public.socios set user_id = socio where id = s1;

  -- Comprobantes
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(subir, 'comprobantes', a || '/' || s1 || '/r1.jpg'));
  perform pg_temp.anotar('Comprobante: el tesorero sube en su caja', e = 'sin error', e);
  e := pg_temp.error_de(format(subir, 'comprobantes', a || '/' || s2 || '/r2.jpg'));
  perform pg_temp.anotar('Comprobante: otro socio de la caja', e = 'sin error', e);
  e := pg_temp.error_de(format(subir, 'comprobantes', a || '/' || sb || '/r3.jpg'));
  perform pg_temp.anotar('Comprobante: no a nombre de una ficha de otra caja', e = '42501', e);
  e := pg_temp.error_de(format(subir, 'comprobantes', 'sin-uuid/' || s1 || '/r4.jpg'));
  perform pg_temp.anotar('Comprobante: una ruta sin la caja no pasa', e = '42501', e);
  n := pg_temp.filas(format('update storage.objects set name = name || ''x'' where bucket_id = ''comprobantes'' and name like %L', a || '%'));
  perform pg_temp.anotar('Comprobante: nadie lo cambia', n = 0, n::text);
  n := pg_temp.filas(format('delete from storage.objects where bucket_id = ''comprobantes'' and name like %L', a || '%'));
  perform pg_temp.anotar('Comprobante: nadie lo borra', n = 0, n::text);
  n := (select count(*) from storage.objects where bucket_id = 'comprobantes');
  perform pg_temp.anotar('Comprobante: el tesorero ve los de su caja', n = 2, n::text);

  perform pg_temp.como(socio);
  n := (select count(*) from storage.objects where bucket_id = 'comprobantes');
  perform pg_temp.anotar('Comprobante: el socio ve solo los de su ficha', n = 1, n::text);
  e := pg_temp.error_de(format(subir, 'comprobantes', a || '/' || s1 || '/r5.jpg'));
  perform pg_temp.anotar('Comprobante: el socio no sube', e = '42501', e);

  perform pg_temp.como(ajeno);
  n := (select count(*) from storage.objects where bucket_id = 'comprobantes' and name like a || '%');
  perform pg_temp.anotar('Comprobante: el coordinador de otra caja no ve ninguno', n = 0, n::text);
  e := pg_temp.error_de(format(subir, 'comprobantes', a || '/' || s1 || '/r6.jpg'));
  perform pg_temp.anotar('Comprobante: ni sube en una caja ajena', e = '42501', e);

  perform pg_temp.como(null);
  n := (select count(*) from storage.objects where bucket_id = 'comprobantes');
  perform pg_temp.anotar('Comprobante: sin sesión no se ve nada', n = 0, n::text);

  -- Foto de la caja
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(subir, 'cajas', a || '/foto.jpg'));
  perform pg_temp.anotar('Foto de caja: el tesorero no la cambia', e = '42501', e);
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(subir, 'cajas', a || '/foto.jpg'));
  perform pg_temp.anotar('Foto de caja: el coordinador la sube', e = 'sin error', e);
  n := pg_temp.filas(format('update storage.objects set updated_at = now() where bucket_id = ''cajas'' and name = %L', a || '/foto.jpg'));
  perform pg_temp.anotar('Foto de caja: el coordinador la reemplaza', n = 1, n::text);
  perform pg_temp.como(socio);
  n := (select count(*) from storage.objects where bucket_id = 'cajas' and name = a || '/foto.jpg');
  perform pg_temp.anotar('Foto de caja: la ve un socio de la caja', n = 1, n::text);
  perform pg_temp.como(ajeno);
  n := (select count(*) from storage.objects where bucket_id = 'cajas' and name = a || '/foto.jpg');
  perform pg_temp.anotar('Foto de caja: no la ve otra caja', n = 0, n::text);

  -- Foto de perfil
  perform pg_temp.como(socio);
  e := pg_temp.error_de(format(subir, 'perfiles', socio || '/foto.jpg'));
  perform pg_temp.anotar('Perfil: cada cuenta sube la suya', e = 'sin error', e);
  e := pg_temp.error_de(format(subir, 'perfiles', tes || '/foto.jpg'));
  perform pg_temp.anotar('Perfil: no en la carpeta de otra cuenta', e = '42501', e);
  perform pg_temp.como(tes);
  n := (select count(*) from storage.objects where bucket_id = 'perfiles' and name = socio || '/foto.jpg');
  perform pg_temp.anotar('Perfil: la ve quien comparte una caja', n = 1, n::text);
  n := pg_temp.filas(format('delete from storage.objects where bucket_id = ''perfiles'' and name = %L', socio || '/foto.jpg'));
  perform pg_temp.anotar('Perfil: otra cuenta no la borra', n = 0, n::text);
  perform pg_temp.como(ajeno);
  n := (select count(*) from storage.objects where bucket_id = 'perfiles' and name = socio || '/foto.jpg');
  perform pg_temp.anotar('Perfil: no la ve quien no comparte caja', n = 0, n::text);
  perform pg_temp.como(socio);
  n := pg_temp.filas(format('delete from storage.objects where bucket_id = ''perfiles'' and name = %L', socio || '/foto.jpg'));
  perform pg_temp.anotar('Perfil: la cuenta la quita', n = 1, n::text);

  -- Caja bloqueada: no se sube nada nuevo
  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = a;
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(subir, 'comprobantes', a || '/' || s1 || '/r7.jpg'));
  perform pg_temp.anotar('Caja bloqueada: no se suben comprobantes', e = '42501', e);
  n := (select count(*) from storage.objects where bucket_id = 'comprobantes');
  perform pg_temp.anotar('Caja bloqueada: los comprobantes se siguen viendo', n = 2, n::text);

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
  raise exception E'STORAGE: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
