-- Prueba de la corrección de la fecha de ingreso (Etapa 6, T14; migración 009).
--
-- QUÉ HACE: crea dentro de una transacción una caja con su coordinador y un tesorero, y
-- comprueba quién corrige, con qué motivo, qué fechas acepta según los ciclos cerrados y
-- que cada corrección queda registrada.
--
-- NO DEJA RASTRO, igual que validacion.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "FECHA DE INGRESO: 18 de 18 casos pasan" y la lista de casos.
-- Las fechas de los casos se calculan desde hoy, así que la prueba sirve cualquier día.

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

-- Ejecuta y devuelve el SQLSTATE y el mensaje del error, o 'sin error'
create function pg_temp.error_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'sin error';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

create function pg_temp.anotar(p_caso text, p_ok boolean, p_detalle text) returns void
language sql as $$ insert into resultados (caso, ok, detalle) values (p_caso, p_ok, p_detalle) $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

do $casos$
declare
  coord uuid := 'd0000000-0000-4000-8000-0000000000c1';
  tes uuid := 'd0000000-0000-4000-8000-0000000000c2';
  ajeno uuid := 'd0000000-0000-4000-8000-0000000000c3';
  hoy date := (now() at time zone 'America/Guayaquil')::date;
  -- Ciclos anuales desde enero; fundada hace dos años: hay ciclos cerrados
  vigente date := date_trunc('year', hoy)::date;
  caja uuid; caja2 uuid; nuevo uuid; viejo uuid; otro uuid;
  e text; t text; n bigint;
  corregir text := 'select public.corregir_fecha_ingreso(%L, %L, %L)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.fecha@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.fecha@prueba.domus', 'authenticated', 'authenticated'),
    (ajeno, 'ajeno.fecha@prueba.domus', 'authenticated', 'authenticated');

  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de fechas', 'Prueba', (vigente - interval '2 years')::date, 1, 12, 'prueba')->>'id')::uuid;
  caja2 := (public.crear_caja('Caja sin periodo', 'Prueba', (vigente - interval '2 years')::date, 1, 12, 'prueba')->>'id')::uuid;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso)
  values (caja, '1710034065', 'Nueva', 'Socia', hoy) returning id into nuevo;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso)
  values (caja, '1104680135', 'Antiguo', 'Socio', vigente - 200) returning id into viejo;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso)
  values (caja2, '1710034065', 'Otra', 'Caja', hoy) returning id into otro;

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, tes, 'tesorero', true);
  update public.cajas set fecha_fundacion = null where id = caja2;

  -- El inicio del ciclo vigente, como utils/ciclos.js
  t := private.inicio_ciclo_vigente(caja, hoy)::text;
  perform pg_temp.anotar('Inicio del ciclo vigente: 1 de enero de este año', t = vigente::text, t);
  t := private.inicio_ciclo_vigente(caja, '2026-03-31')::text;
  perform pg_temp.anotar('Anual desde enero, visto el 31 mar 2026: vigente desde ene 2026', t = '2026-01-01', t);
  update public.cajas set mes_inicio_ciclo = 4, duracion_ciclo = 6, fecha_fundacion = '2024-02-15' where id = caja;
  t := private.inicio_ciclo_vigente(caja, '2026-11-26')::text;
  perform pg_temp.anotar('Semestral desde abril, fundada en feb 2024: vigente desde oct 2026', t = '2026-10-01', t);
  t := private.inicio_ciclo_vigente(caja, '2026-03-31')::text;
  perform pg_temp.anotar('Semestral desde abril, visto el 31 mar 2026: vigente desde oct 2025', t = '2025-10-01', t);
  update public.cajas set mes_inicio_ciclo = 1, duracion_ciclo = 12, fecha_fundacion = (vigente - interval '2 years')::date where id = caja;
  t := coalesce(private.inicio_ciclo_vigente(caja2, hoy)::text, 'null');
  perform pg_temp.anotar('Sin periodo configurado: no hay ciclos cerrados', t = 'null', t);

  -- Quién
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(corregir, nuevo, vigente, 'Se registró con la fecha del día'));
  perform pg_temp.anotar('El tesorero no corrige', e like 'DM404%', e);
  e := pg_temp.error_de(format('update public.socios set fecha_ingreso = %L where id = %L', vigente, nuevo));
  perform pg_temp.anotar('Nadie cambia la columna a mano', e like '42501%', e);
  perform pg_temp.como(ajeno);
  e := pg_temp.error_de(format(corregir, nuevo, vigente, 'Se registró con la fecha del día'));
  perform pg_temp.anotar('Una cuenta de otra caja no corrige (ni sabe si la ficha existe)', e like 'DM404%', e);

  -- Qué
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(corregir, nuevo, vigente, 'corto'));
  perform pg_temp.anotar('Sin motivo suficiente: rechazado', e like 'DM400%', e);
  e := pg_temp.error_de(format(corregir, nuevo, hoy + 1, 'Se registró con la fecha del día'));
  perform pg_temp.anotar('Fecha futura: rechazada', e like 'DM400%', e);
  e := pg_temp.error_de(format(corregir, nuevo, vigente - 1, 'Se registró con la fecha del día'));
  perform pg_temp.anotar('Fecha nueva en un ciclo cerrado: rechazada con la primera fecha válida',
    e = 'DM400 La fecha nueva cae en un ciclo cerrado. Usa una fecha desde el ' || to_char(vigente, 'DD/MM/YYYY'), e);
  e := pg_temp.error_de(format(corregir, viejo, hoy, 'Se equivocaron al registrarlo'));
  perform pg_temp.anotar('Fecha actual en un ciclo cerrado: no se corrige', e like 'DM409%', e);
  e := pg_temp.error_de(format(corregir, nuevo, vigente, '  Se registró con la fecha del día  '));
  t := (select fecha_ingreso::text from public.socios where id = nuevo);
  perform pg_temp.anotar('Corrección válida: la fecha cambia', e = 'sin error' and t = vigente::text, e || ' → ' || t);
  t := (select fecha_anterior || ' ' || fecha_nueva || ' ' || motivo || ' ' || (corregido_por = coord)
        from public.correcciones_fecha_ingreso where socio_id = nuevo);
  perform pg_temp.anotar('Queda registrada: antes, después, motivo sin espacios y quién',
    t = hoy || ' ' || vigente || ' Se registró con la fecha del día true', coalesce(t, 'nada'));
  t := (select string_agg(ingreso::text, ', ') from public.periodos_socio where socio_id = nuevo);
  perform pg_temp.anotar('Y el primer periodo de membresía empieza en la fecha nueva (migración 020)',
    t = vigente::text, coalesce(t, 'nada'));
  e := pg_temp.error_de(format(corregir, otro, (hoy - interval '5 years')::date, 'La caja no tiene periodo todavía'));
  perform pg_temp.anotar('Caja sin periodo: cualquier fecha pasada vale', e = 'sin error', e);

  -- Quién ve el registro
  perform pg_temp.como(tes);
  n := (select count(*) from public.correcciones_fecha_ingreso where caja_id = caja);
  perform pg_temp.anotar('El tesorero ve las correcciones de su caja', n = 1, n::text);
  perform pg_temp.como(ajeno);
  n := (select count(*) from public.correcciones_fecha_ingreso);
  perform pg_temp.anotar('Otra cuenta no ve ninguna', n = 0, n::text);

  -- Caja bloqueada
  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(corregir, nuevo, hoy, 'Volver a la fecha original'));
  perform pg_temp.anotar('Caja bloqueada: no se corrige', e like 'DM409%', e);

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
  raise exception E'FECHA DE INGRESO: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
