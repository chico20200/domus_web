-- Prueba de eliminar una caja (Etapa 7, T9 y T11; migraciones 024, 025 y 026).
--
-- QUÉ HACE: dentro de una transacción crea una caja con un coordinador, un tesorero y a
-- Ana, con $100 de ahorro y una solicitud de crédito, un fondo con $50 y un código de
-- invitación. Comprueba que solo el coordinador vea lo que falta y elimine la caja; que
-- no se pueda mientras quede un socio activo, un crédito, un ahorro o un fondo con saldo;
-- que pida el nombre de la caja; que al eliminarla quede 'eliminada' con quién lo hizo,
-- sin códigos de invitación activos, sin admitir registros y con sus datos intactos; y
-- que una caja bloqueada por la administración no se elimine. Desde la 025, el
-- coordinador también tiene su ficha con $20: no registra su propia salida mientras Ana
-- siga activa, pero como último socio sí, y conserva el acceso para eliminar la caja.
-- Desde la 026: una caja que opera no se quita de la lista; la eliminada sí, y quien la
-- quita deja de verla, sin tocar los datos ni el acceso de los demás.
--
-- NO DEJA RASTRO, igual que aislamiento.sql.
--
-- CÓMO SE CORRE: Supabase → SQL Editor, pegar el archivo y ejecutarlo. El resultado sale
-- como mensaje de error: "ELIMINAR CAJA: N de N casos pasan" y la lista de casos.

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
  coord uuid := 'd0000000-0000-4000-8000-0000000000d5';
  tes uuid := 'd0000000-0000-4000-8000-0000000000d6';
  caja uuid; otra uuid; ana uuid; a1 uuid; sol uuid; fondo uuid; propia uuid; p1 uuid;
  e text; t text; n int; r json;
  q_elim text := 'select public.eliminar_caja(%L, %L)';
  q_req text := 'select public.requisitos_eliminar_caja(%L)';
begin
  insert into auth.users (id, email, aud, role) values
    (coord, 'coord.elim@prueba.domus', 'authenticated', 'authenticated'),
    (tes, 'tes.elim@prueba.domus', 'authenticated', 'authenticated');
  perform pg_temp.como(coord);
  caja := (public.crear_caja('Caja de cierre', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;
  otra := (public.crear_caja('Caja bloqueada', 'Prueba', '2024-01-01', 1, 12, 'prueba')->>'id')::uuid;

  perform set_config('role', 'postgres', true);
  insert into public.miembros_caja (caja_id, user_id, rol, activo) values (caja, tes, 'tesorero', true);
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, direccion) values
    (caja, '0102030400', 'Ana', 'Pérez', '2024-01-01', 'Calle 1') returning id into ana;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, ana, 'EL-001') returning id into a1;
  insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, direccion, user_id) values
    (caja, '1104680135', 'Coord', 'Inador', '2024-01-01', 'Calle 2', coord) returning id into propia;
  insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta) values (caja, propia, 'EL-002') returning id into p1;
  insert into public.invitaciones_caja (caja_id, codigo, rol, creado_por, expira_at)
    values (caja, 'ELIM01', 'socio', coord, now() + interval '7 days');

  perform pg_temp.como(coord);
  perform public.registrar_movimiento(caja, a1, 'deposito', 100, 'prueba');
  perform public.registrar_movimiento(caja, p1, 'deposito', 20, 'prueba');
  insert into public.creditos (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses)
    values (caja, ana, 50, 12, 3) returning id into sol;
  fondo := (public.crear_fondo(caja, 'Fondo de cierre')->>'id')::uuid;
  perform public.registrar_movimiento_fondo(caja, fondo, 'deposito', 50, 'prueba');

  e := pg_temp.error_de(format('select public.quitar_caja_eliminada(%L)', caja));
  perform pg_temp.anotar('Una caja que opera no se quita de la lista', e like 'DM409%eliminada%', e);

  perform pg_temp.como(tes);
  e := pg_temp.error_de(format(q_req, caja));
  perform pg_temp.anotar('El tesorero no ve lo que falta', e like 'DM404%', e);
  e := pg_temp.error_de(format(q_elim, caja, 'Caja de cierre'));
  perform pg_temp.anotar('El tesorero no elimina la caja', e like 'DM404%', e);

  perform pg_temp.como(coord);
  r := public.requisitos_eliminar_caja(caja);
  perform pg_temp.anotar('Lo que falta: 2 socios, 1 crédito, $120 en 2 cuentas, $50 en 1 fondo',
    (r->>'socios_activos')::int = 2 and (r->>'creditos')::int = 1 and (r->>'cuentas_con_saldo')::int = 2
    and (r->>'ahorros')::numeric = 120 and (r->>'fondos_con_saldo')::int = 1 and (r->>'saldo_fondos')::numeric = 50
    and (r->>'puede_eliminar')::boolean = false, r::text);
  e := pg_temp.error_de(format(q_elim, caja, 'Otra caja'));
  perform pg_temp.anotar('Con otro nombre: rechazada', e like 'DM400%nombre%', e);
  e := pg_temp.error_de(format(q_elim, caja, 'Caja de cierre'));
  perform pg_temp.anotar('Con un socio activo: rechazada', e like 'DM409%socio%', e);

  e := pg_temp.error_de(format('select public.registrar_salida(%L, %L, %L::jsonb)', caja, propia, jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', p1, 'saldo', 20)),
    'creditos', '[]'::jsonb, 'solicitudes', '[]'::jsonb, 'interes', null,
    'ahorros_entregados', true, 'interes_entregado', true)));
  perform pg_temp.anotar('Con Ana activa, el coordinador no registra su propia salida', e like 'DM409%otros socios activos%', e);
  e := pg_temp.error_de(format('select public.registrar_salida(%L, %L, %L::jsonb)', caja, ana, jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', a1, 'saldo', 100)),
    'creditos', '[]'::jsonb, 'solicitudes', jsonb_build_array(sol), 'interes', null,
    'ahorros_entregados', true, 'interes_entregado', true)));
  perform pg_temp.anotar('Ana sale con su liquidación', e = 'sin error', e);
  e := pg_temp.error_de(format(q_elim, caja, 'Caja de cierre'));
  perform pg_temp.anotar('Con el coordinador aún activo: rechazada', e like 'DM409%1 socio%', e);
  e := pg_temp.error_de(format('select public.registrar_salida(%L, %L, %L::jsonb)', caja, propia, jsonb_build_object(
    'cuentas', jsonb_build_array(jsonb_build_object('id', p1, 'saldo', 20)),
    'creditos', '[]'::jsonb, 'solicitudes', '[]'::jsonb, 'interes', null,
    'ahorros_entregados', true, 'interes_entregado', true)));
  perform pg_temp.anotar('Como último socio, el coordinador registra su propia salida (025)', e = 'sin error', e);
  select activo::text into t from public.miembros_caja where caja_id = caja and user_id = coord;
  perform pg_temp.anotar('Y conserva su acceso a la caja', t = 'true', t);
  select detalle->>'acceso_retirado' into t from public.liquidaciones where socio_id = propia;
  perform pg_temp.anotar('Su liquidación anota que no se le retiró', t = 'false', t);
  e := pg_temp.error_de(format(q_elim, caja, 'Caja de cierre'));
  perform pg_temp.anotar('Con dinero en un fondo: rechazada', e like 'DM409%fondo%', e);

  perform public.registrar_movimiento_fondo(caja, fondo, 'retiro', 50, 'cierre de la caja');
  r := public.requisitos_eliminar_caja(caja);
  perform pg_temp.anotar('Ya no falta nada', (r->>'puede_eliminar')::boolean, r::text);

  e := pg_temp.error_de(format(q_elim, caja, '  Caja de cierre '));
  perform pg_temp.anotar('Eliminada (el nombre se compara sin espacios de más)', e = 'sin error', e);
  select estado || ' ' || (eliminada_por = coord) || ' ' || (estado_cambiado_en is not null) into t from public.cajas where id = caja;
  perform pg_temp.anotar('Queda eliminada, con quién y cuándo', t = 'eliminada true true', t);
  n := (select count(*) from public.invitaciones_caja where caja_id = caja and activo);
  perform pg_temp.anotar('Sin códigos de invitación activos', n = 0, n::text);
  e := pg_temp.error_de(format(q_elim, caja, 'Caja de cierre'));
  perform pg_temp.anotar('No se elimina dos veces', e like 'DM409%ya está eliminada%', e);

  e := pg_temp.error_de(format('select public.registrar_movimiento_fondo(%L, %L, %L, 10, %L)', caja, fondo, 'deposito', 'prueba'));
  perform pg_temp.anotar('No admite movimientos', e <> 'sin error', e);
  e := pg_temp.error_de(format('insert into public.socios (caja_id, cedula, nombre, apellido) values (%L, %L, %L, %L)', caja, '1710034065', 'Luis', 'Mora'));
  perform pg_temp.anotar('No admite socios nuevos', e like '42501%', e);
  e := pg_temp.error_de(format('update public.cajas set nombre = %L where id = %L', 'Otro nombre', caja));
  select nombre into t from public.cajas where id = caja;
  perform pg_temp.anotar('No se le cambia el nombre', t = 'Caja de cierre', e || ' / ' || t);
  e := pg_temp.error_de('select public.unirse_con_codigo(''ELIM01'')');
  perform pg_temp.anotar('Su código ya no sirve para entrar', e <> 'sin error', e);

  perform pg_temp.como(tes);
  n := (select count(*) from public.liquidaciones where caja_id = caja)
     + (select count(*) from public.transacciones where caja_id = caja)
     + (select count(*) from public.socios where caja_id = caja);
  perform pg_temp.anotar('Sus datos se conservan y se leen (2 liquidaciones, 4 movimientos, 2 fichas)', n = 8, n::text);
  e := pg_temp.error_de(format('select public.quitar_caja_eliminada(%L)', caja));
  perform pg_temp.anotar('El tesorero la quita de su lista (026)', e = 'sin error', e);
  n := (select count(*) from public.cajas where id = caja) + (select count(*) from public.liquidaciones where caja_id = caja);
  perform pg_temp.anotar('Y ya no la ve, ni sus datos', n = 0, n::text);
  e := pg_temp.error_de(format('select public.quitar_caja_eliminada(%L)', caja));
  perform pg_temp.anotar('No la quita dos veces', e like 'DM404%', e);
  perform pg_temp.como(coord);
  n := (select count(*) from public.liquidaciones where caja_id = caja);
  perform pg_temp.anotar('El coordinador la sigue viendo con sus datos', n = 2, n::text);

  perform set_config('role', 'postgres', true);
  update public.cajas set estado = 'bloqueada' where id = otra;
  perform pg_temp.como(coord);
  e := pg_temp.error_de(format(q_elim, otra, 'Caja bloqueada'));
  perform pg_temp.anotar('Una caja bloqueada por la administración no se elimina', e like 'DM409%bloqueada%', e);
end
$casos$;

do $resumen$
declare
  total int; pasan int; texto text;
begin
  select count(*), count(*) filter (where ok) into total, pasan from resultados;
  select string_agg(format('%s %s. %s (%s)', case when ok then 'PASA ' else 'FALLA' end, n, caso, detalle), E'\n' order by n)
    into texto from resultados;
  raise exception E'ELIMINAR CAJA: % de % casos pasan\n%', pasan, total, texto;
end
$resumen$;
