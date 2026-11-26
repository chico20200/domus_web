-- Prueba de Fondos de caja (Etapa 6, T18; migración 014).
--
-- QUÉ HACE: dentro de una transacción crea dos cajas, fondos y movimientos, y comprueba
-- quién ve y quién registra, los saldos, los cierres y que nada se escriba a mano.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "FONDOS: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000b1';
  tes uuid := 'd0000000-0000-4000-8000-0000000000b2';
  socio_u uuid := 'd0000000-0000-4000-8000-0000000000b3';
  otro uuid := 'd0000000-0000-4000-8000-0000000000b4';
  caja uuid; caja2 uuid; fondo uuid; fondo2 uuid;
  e text; v_saldo numeric; n int; t text;
  mover text := 'select public.registrar_movimiento_fondo(%L, %L, %L, %s, %L)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.fondos@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.fondos@prueba.domus', 'authenticated', 'authenticated'),
    (socio_u, 'socio.fondos@prueba.domus', 'authenticated', 'authenticated'),
    (otro, 'otro.fondos@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de fondos', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform pg_temp.como(otro);
  caja2 := (public.crear_caja('Otra caja de fondos', 'Prueba', '2025-01-01', 1, 12, 'prueba')->>'id')::uuid;
  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values
    (caja, tes, 'tesorero', true), (caja, socio_u, 'socio', true);

  -- Crear
  perform pg_temp.como(socio_u);
  e := pg_temp.error_de(format('select public.crear_fondo(%L, %L)', caja, 'Fondo social'));
  perform pg_temp.anotar('Un socio no crea fondos', e = 'DM404', e);
  perform pg_temp.como(tes);
  e := pg_temp.error_de(format('select public.crear_fondo(%L, %L)', caja, 'ab'));
  perform pg_temp.anotar('Nombre de menos de 3 letras: rechazado', e = 'DM400', e);
  fondo := (public.crear_fondo(caja, '  Fondo social ', 'Para actividades')->>'id')::uuid;
  t := (select nombre from public.fondos_caja where id = fondo);
  perform pg_temp.anotar('El tesorero crea un fondo (sin espacios de más)', t = 'Fondo social', t);
  e := pg_temp.error_de(format('select public.crear_fondo(%L, %L)', caja, 'FONDO SOCIAL'));
  perform pg_temp.anotar('Nombre repetido (sin importar mayúsculas): rechazado', e = 'DM409', e);
  fondo2 := (public.crear_fondo(caja, 'Fondo de actividades')->>'id')::uuid;

  -- Movimientos
  e := pg_temp.error_de(format(mover, caja, fondo, 'deposito', 100, 'Rifa de noviembre'));
  v_saldo := (select saldo from public.fondos_caja where id = fondo);
  perform pg_temp.anotar('Depósito de $100', e = 'sin error' and v_saldo = 100, e || ', saldo ' || v_saldo);
  e := pg_temp.error_de(format(mover, caja, fondo, 'retiro', 150, 'Compra'));
  perform pg_temp.anotar('Retiro mayor que el saldo: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(mover, caja, fondo, 'retiro', 40, 'Refrigerio de la asamblea'));
  select count(*) into n from public.movimientos_fondo
  where fondo_id = fondo and tipo = 'retiro' and saldo_anterior = 100 and saldo_posterior = 60 and registrado_por = tes;
  v_saldo := (select saldo from public.fondos_caja where id = fondo);
  perform pg_temp.anotar('Retiro de $40: saldo 60 y el movimiento con sus saldos', e = 'sin error' and v_saldo = 60 and n = 1, e || ', saldo ' || v_saldo);
  e := pg_temp.error_de(format(mover, caja, fondo, 'deposito', 10, '  '));
  perform pg_temp.anotar('Sin descripción: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(mover, caja, fondo, 'deposito', 10.555, 'Multa'));
  perform pg_temp.anotar('Tres decimales: rechazado', e = 'DM400', e);
  e := pg_temp.error_de(format(mover, caja, fondo, 'otro', 10, 'Multa'));
  perform pg_temp.anotar('Tipo desconocido: rechazado', e = 'DM400', e);

  -- Nada a mano
  e := pg_temp.error_de(format('update public.fondos_caja set saldo = 999 where id = %L', fondo));
  perform pg_temp.anotar('Nadie escribe el saldo a mano', e = '42501', e);
  e := pg_temp.error_de(format('insert into public.movimientos_fondo (caja_id, fondo_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion) values (%L, %L, ''deposito'', 5, 0, 5, ''x'')', caja, fondo));
  perform pg_temp.anotar('Nadie inserta un movimiento a mano', e = '42501', e);
  e := pg_temp.error_de(format('delete from public.movimientos_fondo where fondo_id = %L', fondo));
  perform pg_temp.anotar('Nadie borra movimientos', e = '42501', e);

  -- Quién ve
  perform pg_temp.como(socio_u);
  n := (select count(*) from public.fondos_caja where caja_id = caja);
  perform pg_temp.anotar('Un socio no ve los fondos', n = 0, n || ' fondos');
  perform pg_temp.como(otro);
  n := (select count(*) from public.fondos_caja where caja_id = caja) + (select count(*) from public.movimientos_fondo where caja_id = caja);
  perform pg_temp.anotar('El coordinador de otra caja no ve nada', n = 0, n || ' filas');
  e := pg_temp.error_de(format(mover, caja, fondo, 'deposito', 10, 'Intruso'));
  perform pg_temp.anotar('Ni registra en ella', e = 'DM404', e);
  e := pg_temp.error_de(format(mover, caja2, fondo, 'deposito', 10, 'Fondo de otra caja'));
  perform pg_temp.anotar('Un fondo de otra caja con su propia caja: no se encuentra', e = 'DM404', e);
  perform pg_temp.como(coord);
  n := (select count(*) from public.fondos_caja where caja_id = caja);
  perform pg_temp.anotar('El coordinador ve los dos fondos', n = 2, n || ' fondos');

  -- Editar y cerrar
  e := pg_temp.error_de(format('select public.editar_fondo(%L, %L, %L)', caja, fondo2, 'fondo social'));
  perform pg_temp.anotar('Renombrar a un nombre que ya existe: rechazado', e = 'DM409', e);
  e := pg_temp.error_de(format('select public.editar_fondo(%L, %L, %L, %L)', caja, fondo2, 'Fondo de eventos', 'Fiestas'));
  t := (select nombre || ' / ' || descripcion from public.fondos_caja where id = fondo2);
  perform pg_temp.anotar('Renombrar', e = 'sin error' and t = 'Fondo de eventos / Fiestas', e || ', ' || t);
  e := pg_temp.error_de(format('select public.cambiar_estado_fondo(%L, %L, false)', caja, fondo));
  perform pg_temp.anotar('Cerrar con saldo: rechazado', e = 'DM409', e);
  perform public.registrar_movimiento_fondo(caja, fondo, 'retiro', 60, 'Cierre del fondo');
  e := pg_temp.error_de(format('select public.cambiar_estado_fondo(%L, %L, false)', caja, fondo));
  perform pg_temp.anotar('Cerrar en $0', e = 'sin error' and not (select activo from public.fondos_caja where id = fondo), e);
  e := pg_temp.error_de(format(mover, caja, fondo, 'deposito', 10, 'Multa'));
  perform pg_temp.anotar('Un fondo cerrado no recibe movimientos', e = 'DM409', e);
  e := pg_temp.error_de(format('select public.cambiar_estado_fondo(%L, %L, true)', caja, fondo));
  perform pg_temp.anotar('Reabrir', e = 'sin error' and (select activo from public.fondos_caja where id = fondo), e);

  -- Los fondos no tocan los ahorros
  n := (select count(*) from public.transacciones where caja_id = caja) + (select count(*) from public.cuentas_ahorro where caja_id = caja);
  perform pg_temp.anotar('Los fondos no crean movimientos de ahorro', n = 0, n || ' filas');

  -- Caja bloqueada
  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = caja;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(mover, caja, fondo, 'deposito', 10, 'Multa'));
  perform pg_temp.anotar('Caja bloqueada: no se registra', e = 'DM409', e);
  e := pg_temp.error_de(format('select public.crear_fondo(%L, %L)', caja, 'Fondo nuevo'));
  perform pg_temp.anotar('Caja bloqueada: no se crean fondos', e = 'DM409', e);

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
  raise exception E'FONDOS: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
