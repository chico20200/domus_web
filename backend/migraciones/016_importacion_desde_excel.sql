-- 016: Importación desde Excel (Etapa 6, T22)
--
-- El frontend lee y revisa el archivo (T21) y manda las filas ya convertidas. Aquí se
-- vuelve a revisar todo, porque la base no confía en el navegador, y se guarda todo o
-- nada: una sola función por llamada, y un error en cualquier fila deshace lo demás.
--
-- public.importar_excel(caja, módulo, filas, simular). Con simular = true hace la
-- importación completa y la deshace al final: así la vista previa muestra lo que la base
-- haría de verdad (saldos, número de cuenta y de crédito, estado de cada crédito).
--
-- Reglas (decididas con el usuario, ver ESTADO.md, bloque F):
-- - Cada fila trae su fecha. Entre la fundación de la caja y hoy; la de un socio, desde
--   su ingreso. Puede caer en un ciclo cerrado: todavía no hay liquidaciones guardadas.
-- - Ahorros y fondos: se aplican en orden de fecha (y de fila el mismo día) desde el
--   saldo de hoy. Un movimiento no puede ser anterior al último que la cuenta o el fondo
--   ya tiene en DOMUS. Un socio sin cuenta activa recibe una, abierta el día de su primer
--   movimiento; un fondo que no existe se crea.
-- - Créditos "tal como se pagaron": entran desembolsados, con sus pagos reales. El
--   capital de cada pago cubre las cuotas en orden y su interés se reparte entre esas
--   cuotas según el capital. Una cuota que el capital importado cubre entera queda
--   saldada con el interés que se cobró de verdad; lo que faltó de interés se anota como
--   condonado. En las cuotas que faltan rige la fórmula de DOMUS. El monto máximo de
--   crédito de la caja no se aplica: son préstamos que ya se dieron.

-- Los pagos importados se marcan: analizarEstadoCredito (backend) usa la marca para dar
-- por saldada una cuota que la importación cubrió entera.
alter table public.pagos_credito add column if not exists es_importado boolean not null default false;

-- El monto máximo no se aplica a los créditos que se importan
create or replace function private.limitar_monto_credito()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  maximo numeric(12, 2);
begin
  if current_setting('domus.importando', true) = 'si' then
    return new;
  end if;
  select monto_maximo_credito into maximo from public.cajas where id = new.caja_id;
  if maximo is not null and new.monto_solicitado > maximo then
    raise exception 'El monto máximo de crédito de esta caja es $%',
      translate(to_char(maximo, 'FM999,999,990.00'), ',.', '.,') using errcode = 'DM400';
  end if;
  return new;
end;
$$;

-- ── Ayudas ─────────────────────────────────────────────────────────

create or replace function private.dinero(p numeric)
returns text language sql immutable set search_path to '' as $$
  select '$' || translate(to_char(p, 'FM999,999,990.00'), ',.', '.,')
$$;

create or replace function private.dma(p date)
returns text language sql immutable set search_path to '' as $$
  select to_char(p, 'DD/MM/YYYY')
$$;

create or replace function private.error_importacion(p_donde text, p_columna text, p_mensaje text)
returns void language plpgsql volatile set search_path to '' as $$
begin
  raise exception '%', p_donde || coalesce(' (' || p_columna || ')', '') || ': ' || p_mensaje
    using errcode = 'DM400';
end;
$$;

/** Fecha de una fila: entre p_desde (la fundación) y hoy */
create or replace function private.fecha_importada(
  p_texto text, p_donde text, p_columna text, p_desde date, p_hoy date)
returns date language plpgsql stable set search_path to '' as $$
declare
  v date;
begin
  begin
    v := p_texto::date;
  exception when others then
    v := null;
  end;
  if v is null then
    perform private.error_importacion(p_donde, p_columna, 'Falta la fecha o no es válida');
  end if;
  if v > p_hoy then
    perform private.error_importacion(p_donde, p_columna, 'La fecha es posterior a hoy');
  end if;
  if v < p_desde then
    perform private.error_importacion(p_donde, p_columna,
      'La fecha es anterior a la fundación de la caja (' || private.dma(p_desde) || ')');
  end if;
  return v;
end;
$$;

/** Monto en dólares, con hasta dos decimales; mayor que 0, o desde 0 si p_cero */
create or replace function private.monto_importado(
  p_texto text, p_donde text, p_columna text, p_cero boolean)
returns numeric language plpgsql stable set search_path to '' as $$
declare
  v numeric;
begin
  begin
    v := p_texto::numeric;
  exception when others then
    v := null;
  end;
  if v is null then
    perform private.error_importacion(p_donde, p_columna, 'Falta el monto o no es un número');
  end if;
  if v < 0 or (v = 0 and not p_cero) then
    perform private.error_importacion(p_donde, p_columna,
      case when p_cero then 'No puede ser negativo' else 'Tiene que ser mayor que 0' end);
  end if;
  if round(v, 2) <> v then
    perform private.error_importacion(p_donde, p_columna, 'Usa como máximo dos decimales');
  end if;
  return v;
end;
$$;

/** Socio activo de la caja por su cédula, que ya estaba en la fecha dada */
create or replace function private.socio_importado(
  p_caja uuid, p_cedula text, p_fecha date, p_donde text, p_que text)
returns public.socios language plpgsql stable set search_path to '' as $$
declare
  v public.socios;
begin
  select * into v from public.socios
  where caja_id = p_caja and cedula = private.solo_digitos(p_cedula);
  if not found then
    perform private.error_importacion(p_donde, 'Cédula',
      'No hay un socio con la cédula ' || coalesce(p_cedula, '') || ' en la caja');
  end if;
  if not v.activo then
    perform private.error_importacion(p_donde, 'Cédula', v.nombre || ' ' || v.apellido || ' está inactivo');
  end if;
  if p_fecha < v.fecha_ingreso then
    perform private.error_importacion(p_donde, null, p_que || ' es anterior al ingreso de '
      || v.nombre || ' ' || v.apellido || ' (' || private.dma(v.fecha_ingreso) || ')');
  end if;
  return v;
end;
$$;

/** Siguiente número de cuenta libre, con la forma de generarNumeroCuenta (backend) */
create or replace function private.siguiente_numero_cuenta(p_caja uuid)
returns text language plpgsql set search_path to '' as $$
declare
  n int;
  v text;
begin
  perform pg_advisory_xact_lock(hashtextextended('numero_cuenta:' || p_caja::text, 0));
  select count(*) + 1 into n from public.cuentas_ahorro where caja_id = p_caja;
  loop
    v := 'CA-' || lpad(n::text, 4, '0');
    exit when not exists (select 1 from public.cuentas_ahorro where caja_id = p_caja and numero_cuenta = v);
    n := n + 1;
  end loop;
  return v;
end;
$$;

-- ── Socios ─────────────────────────────────────────────────────────
-- Fila: { fila, cedula, nombre, apellido, fecha_ingreso, telefono, email, direccion }

create or replace function private.importar_socios(p_caja uuid, p_filas jsonb, p_fundacion date, p_hoy date)
returns jsonb language plpgsql set search_path to '' as $$
declare
  r jsonb;
  v_donde text;
  v_cedula text;
  v_fecha date;
  v_otro public.socios;
  v_vistas jsonb := '{}';
  v_n int := 0;
begin
  for r in select value from jsonb_array_elements(p_filas) order by (value->>'fila')::int loop
    v_donde := 'Socios, fila ' || coalesce(r->>'fila', '?');
    v_cedula := private.solo_digitos(r->>'cedula');
    v_fecha := private.fecha_importada(r->>'fecha_ingreso', v_donde, 'Fecha de ingreso', p_fundacion, p_hoy);
    if v_vistas ? v_cedula then
      perform private.error_importacion(v_donde, 'Cédula',
        'Repetida: también está en la fila ' || (v_vistas->>v_cedula));
    end if;
    select * into v_otro from public.socios where caja_id = p_caja and cedula = v_cedula;
    if found then
      perform private.error_importacion(v_donde, 'Cédula',
        'Ya está en la caja: ' || v_otro.nombre || ' ' || v_otro.apellido);
    end if;
    v_vistas := v_vistas || jsonb_build_object(v_cedula, r->>'fila');
    begin
      -- validar_ficha (005) revisa nombre, cédula, teléfono y correo
      insert into public.socios (caja_id, cedula, nombre, apellido, fecha_ingreso, telefono, email, direccion)
      values (p_caja, v_cedula, r->>'nombre', r->>'apellido', v_fecha,
              coalesce(r->>'telefono', ''), coalesce(btrim(r->>'email'), ''), coalesce(btrim(r->>'direccion'), ''));
    exception when sqlstate 'DM400' then
      perform private.error_importacion(v_donde, null, sqlerrm);
    end;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('socios', v_n);
end;
$$;

-- ── Ahorros ────────────────────────────────────────────────────────
-- Fila: { fila, cedula, fecha, tipo (deposito | retiro), monto, descripcion }

create or replace function private.importar_ahorros(p_caja uuid, p_filas jsonb, p_fundacion date, p_hoy date)
returns jsonb language plpgsql set search_path to '' as $$
declare
  r jsonb;
  v_donde text;
  v_fecha date;
  v_tipo text;
  v_monto numeric(12,2);
  v_socio public.socios;
  v_cuenta public.cuentas_ahorro;
  v_estado jsonb;
  v_cuentas jsonb := '{}';
  v_activas int;
  v_ultima date;
  v_nuevo numeric(12,2);
  v_resumen jsonb := '[]';
  k text;
begin
  for r in
    select value from jsonb_array_elements(p_filas)
    order by value->>'fecha', (value->>'fila')::int
  loop
    v_donde := 'Movimientos, fila ' || coalesce(r->>'fila', '?');
    v_fecha := private.fecha_importada(r->>'fecha', v_donde, 'Fecha', p_fundacion, p_hoy);
    v_socio := private.socio_importado(p_caja, r->>'cedula', v_fecha, v_donde, 'La fecha');
    v_tipo := r->>'tipo';
    if v_tipo is null or v_tipo not in ('deposito', 'retiro') then
      perform private.error_importacion(v_donde, 'Tipo', 'Escribe Depósito o Retiro');
    end if;
    v_monto := private.monto_importado(r->>'monto', v_donde, 'Monto', false);

    -- La cuenta del socio: la activa que tiene o una nueva desde su primer movimiento
    v_estado := v_cuentas->(v_socio.id::text);
    if v_estado is null then
      select count(*) into v_activas from public.cuentas_ahorro
      where caja_id = p_caja and socio_id = v_socio.id and estado = 'activa';
      if v_activas > 1 then
        perform private.error_importacion(v_donde, 'Cédula', v_socio.nombre || ' ' || v_socio.apellido
          || ' tiene ' || v_activas || ' cuentas activas: la importación no sabe en cuál poner el movimiento');
      end if;
      if v_activas = 1 then
        select * into v_cuenta from public.cuentas_ahorro
        where caja_id = p_caja and socio_id = v_socio.id and estado = 'activa' for update;
        select max(fecha) into v_ultima from public.transacciones where cuenta_id = v_cuenta.id;
        v_estado := jsonb_build_object('nueva', false, 'ultima', v_ultima);
      else
        insert into public.cuentas_ahorro (caja_id, socio_id, numero_cuenta, saldo, estado, fecha_apertura)
        values (p_caja, v_socio.id, private.siguiente_numero_cuenta(p_caja), 0, 'activa', v_fecha)
        returning * into v_cuenta;
        v_estado := jsonb_build_object('nueva', true, 'ultima', null);
      end if;
      v_estado := v_estado || jsonb_build_object(
        'cuenta_id', v_cuenta.id, 'numero_cuenta', v_cuenta.numero_cuenta,
        'socio', v_socio.nombre || ' ' || v_socio.apellido, 'saldo_antes', v_cuenta.saldo, 'movimientos', 0);
    else
      select * into v_cuenta from public.cuentas_ahorro where id = (v_estado->>'cuenta_id')::uuid;
    end if;

    v_ultima := (v_estado->>'ultima')::date;
    if v_ultima is not null and v_fecha < v_ultima then
      perform private.error_importacion(v_donde, 'Fecha', 'La cuenta de ' || (v_estado->>'socio')
        || ' ya tiene movimientos en DOMUS hasta el ' || private.dma(v_ultima)
        || ': no se importan movimientos anteriores');
    end if;

    if v_tipo = 'retiro' then
      if v_monto > v_cuenta.saldo then
        perform private.error_importacion(v_donde, 'Monto', 'El ' || private.dma(v_fecha) || ' la cuenta de '
          || (v_estado->>'socio') || ' tiene ' || private.dinero(v_cuenta.saldo)
          || ': no alcanza para retirar ' || private.dinero(v_monto));
      end if;
      v_nuevo := v_cuenta.saldo - v_monto;
    else
      v_nuevo := v_cuenta.saldo + v_monto;
    end if;

    -- created_at con la hora real de cada fila: ordena los movimientos del mismo día
    insert into public.transacciones
      (caja_id, cuenta_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, registrado_por, fecha, created_at)
    values
      (p_caja, v_cuenta.id, v_tipo::public.tipo_transaccion, v_monto, v_cuenta.saldo, v_nuevo,
       coalesce(btrim(r->>'descripcion'), ''), auth.uid(), v_fecha, clock_timestamp());
    update public.cuentas_ahorro set saldo = v_nuevo, updated_at = now() where id = v_cuenta.id;

    v_cuentas := v_cuentas || jsonb_build_object(v_socio.id::text,
      v_estado || jsonb_build_object('movimientos', (v_estado->>'movimientos')::int + 1));
  end loop;

  for k in select jsonb_object_keys(v_cuentas) loop
    v_estado := v_cuentas->k;
    v_resumen := v_resumen || jsonb_build_object(
      'socio', v_estado->>'socio',
      'numero_cuenta', v_estado->>'numero_cuenta',
      'nueva', (v_estado->>'nueva')::boolean,
      'movimientos', (v_estado->>'movimientos')::int,
      'saldo_antes', (v_estado->>'saldo_antes')::numeric,
      'saldo_despues', (select saldo from public.cuentas_ahorro where id = (v_estado->>'cuenta_id')::uuid));
  end loop;
  return jsonb_build_object('cuentas',
    (select coalesce(jsonb_agg(e order by e->>'socio'), '[]') from jsonb_array_elements(v_resumen) e));
end;
$$;

-- ── Fondos ─────────────────────────────────────────────────────────
-- Fila: { fila, fondo, fecha, tipo (deposito | retiro), monto, descripcion }

create or replace function private.importar_fondos(p_caja uuid, p_filas jsonb, p_fundacion date, p_hoy date)
returns jsonb language plpgsql set search_path to '' as $$
declare
  r jsonb;
  v_donde text;
  v_fecha date;
  v_tipo text;
  v_monto numeric(12,2);
  v_nombre text;
  v_clave text;
  v_desc text;
  v_fondo public.fondos_caja;
  v_estado jsonb;
  v_fondos jsonb := '{}';
  v_ultima date;
  v_nuevo numeric(12,2);
  v_resumen jsonb := '[]';
  k text;
begin
  for r in
    select value from jsonb_array_elements(p_filas)
    order by value->>'fecha', (value->>'fila')::int
  loop
    v_donde := 'Movimientos, fila ' || coalesce(r->>'fila', '?');
    v_nombre := regexp_replace(btrim(coalesce(r->>'fondo', '')), '\s+', ' ', 'g');
    v_clave := lower(v_nombre);
    v_fecha := private.fecha_importada(r->>'fecha', v_donde, 'Fecha', p_fundacion, p_hoy);
    v_tipo := r->>'tipo';
    if v_tipo is null or v_tipo not in ('deposito', 'retiro') then
      perform private.error_importacion(v_donde, 'Tipo', 'Escribe Depósito o Retiro');
    end if;
    v_monto := private.monto_importado(r->>'monto', v_donde, 'Monto', false);
    v_desc := btrim(coalesce(r->>'descripcion', ''));
    if char_length(v_desc) < 3 or char_length(v_desc) > 200 then
      perform private.error_importacion(v_donde, 'Descripción', 'La descripción va de 3 a 200 caracteres');
    end if;

    v_estado := v_fondos->v_clave;
    if v_estado is null then
      select * into v_fondo from public.fondos_caja
      where caja_id = p_caja and lower(btrim(nombre)) = v_clave for update;
      if found then
        if not v_fondo.activo then
          perform private.error_importacion(v_donde, 'Fondo',
            v_fondo.nombre || ' está cerrado. Ábrelo de nuevo en Fondos antes de importar');
        end if;
        select max(fecha) into v_ultima from public.movimientos_fondo where fondo_id = v_fondo.id;
        v_estado := jsonb_build_object('nuevo', false, 'ultima', v_ultima);
      else
        begin
          perform private.validar_fondo(v_nombre, null);
        exception when sqlstate 'DM400' then
          perform private.error_importacion(v_donde, 'Fondo', sqlerrm);
        end;
        insert into public.fondos_caja (caja_id, nombre) values (p_caja, v_nombre) returning * into v_fondo;
        v_estado := jsonb_build_object('nuevo', true, 'ultima', null);
      end if;
      v_estado := v_estado || jsonb_build_object(
        'fondo_id', v_fondo.id, 'fondo', v_fondo.nombre, 'saldo_antes', v_fondo.saldo, 'movimientos', 0);
    else
      select * into v_fondo from public.fondos_caja where id = (v_estado->>'fondo_id')::uuid;
    end if;

    v_ultima := (v_estado->>'ultima')::date;
    if v_ultima is not null and v_fecha < v_ultima then
      perform private.error_importacion(v_donde, 'Fecha', (v_estado->>'fondo')
        || ' ya tiene movimientos en DOMUS hasta el ' || private.dma(v_ultima)
        || ': no se importan movimientos anteriores');
    end if;

    if v_tipo = 'retiro' then
      if v_monto > v_fondo.saldo then
        perform private.error_importacion(v_donde, 'Monto', 'El ' || private.dma(v_fecha) || ' '
          || (v_estado->>'fondo') || ' tiene ' || private.dinero(v_fondo.saldo)
          || ': no alcanza para retirar ' || private.dinero(v_monto));
      end if;
      v_nuevo := v_fondo.saldo - v_monto;
    else
      v_nuevo := v_fondo.saldo + v_monto;
    end if;

    insert into public.movimientos_fondo
      (caja_id, fondo_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, fecha, registrado_por, created_at)
    values
      (p_caja, v_fondo.id, v_tipo, v_monto, v_fondo.saldo, v_nuevo, v_desc, v_fecha, auth.uid(), clock_timestamp());
    update public.fondos_caja set saldo = v_nuevo, updated_at = now() where id = v_fondo.id;

    v_fondos := v_fondos || jsonb_build_object(v_clave,
      v_estado || jsonb_build_object('movimientos', (v_estado->>'movimientos')::int + 1));
  end loop;

  for k in select jsonb_object_keys(v_fondos) loop
    v_estado := v_fondos->k;
    v_resumen := v_resumen || jsonb_build_object(
      'fondo', v_estado->>'fondo',
      'nuevo', (v_estado->>'nuevo')::boolean,
      'movimientos', (v_estado->>'movimientos')::int,
      'saldo_antes', (v_estado->>'saldo_antes')::numeric,
      'saldo_despues', (select saldo from public.fondos_caja where id = (v_estado->>'fondo_id')::uuid));
  end loop;
  return jsonb_build_object('fondos',
    (select coalesce(jsonb_agg(e order by e->>'fondo'), '[]') from jsonb_array_elements(v_resumen) e));
end;
$$;

-- ── Créditos y pagos ───────────────────────────────────────────────
-- Fila: { fila, referencia, cedula, monto, tasa_interes, plazo_meses, fecha_desembolso,
--         pagos: [{ fila, fecha, capital, interes }] }
--
-- Las cuotas siguen la tabla de generarTablaAmortizacion (backend): capital e interés
-- iguales cada mes, redondeados a centavos, y la última absorbe la diferencia.

create or replace function private.importar_creditos(p_caja uuid, p_filas jsonb, p_fundacion date, p_hoy date)
returns jsonb language plpgsql set search_path to '' as $$
declare
  r jsonb;
  p jsonb;
  v_donde text;
  v_donde_pago text;
  v_socio public.socios;
  v_monto numeric(12,2);
  v_tasa numeric;
  v_plazo int;
  v_desembolso date;
  v_fecha date;
  v_formula numeric(12,2);
  v_credito public.creditos;
  v_refs jsonb := '{}';
  -- Por cuota, en centavos
  cap bigint[];
  inte bigint[];
  cap_pag bigint[];
  int_pag bigint[];
  tocada boolean[];
  v_cap_c bigint;
  v_int_c bigint;
  v_monto_c bigint;
  v_int_total_c bigint;
  v_cuota int;
  v_resto bigint;
  v_toma bigint;
  v_partes_k int[];
  v_partes_c bigint[];
  v_suma bigint;
  v_int_parte bigint;
  v_int_repartido bigint;
  v_lista jsonb;
  v_saldo_c bigint;
  v_condonado_c bigint;
  v_pagado_c bigint;
  v_corre bigint;
  v_capital_total bigint;
  v_interes_total bigint;
  v_resumen jsonb := '[]';
  i int;
  j int;
begin
  perform set_config('domus.importando', 'si', true);

  for r in select value from jsonb_array_elements(p_filas) order by (value->>'fila')::int loop
    v_donde := 'Créditos, fila ' || coalesce(r->>'fila', '?');
    if v_refs ? coalesce(r->>'referencia', '') then
      perform private.error_importacion(v_donde, 'N.º',
        'Repetido: el N.º ' || (r->>'referencia') || ' ya está en la fila ' || (v_refs->>(r->>'referencia')));
    end if;
    v_refs := v_refs || jsonb_build_object(coalesce(r->>'referencia', ''), r->>'fila');

    v_monto := private.monto_importado(r->>'monto', v_donde, 'Monto prestado', false);
    begin
      v_tasa := (r->>'tasa_interes')::numeric;
      v_plazo := (r->>'plazo_meses')::int;
    exception when others then
      perform private.error_importacion(v_donde, null, 'La tasa o el plazo no son números');
    end;
    if v_tasa is null or v_tasa < 0.01 or v_tasa > 100 or round(v_tasa, 2) <> v_tasa then
      perform private.error_importacion(v_donde, 'Tasa anual (%)', 'La tasa va de 0,01 a 100, con hasta dos decimales');
    end if;
    if v_plazo is null or v_plazo < 1 or v_plazo > 120 then
      perform private.error_importacion(v_donde, 'Plazo (meses)', 'El plazo va de 1 a 120 meses');
    end if;
    v_desembolso := private.fecha_importada(r->>'fecha_desembolso', v_donde, 'Fecha de desembolso', p_fundacion, p_hoy);
    v_socio := private.socio_importado(p_caja, r->>'cedula', v_desembolso, v_donde, 'El desembolso');

    -- La tabla de cuotas de la fórmula
    v_formula := round(v_monto * (1 + v_tasa / 100 * v_plazo / 12.0), 2);
    v_monto_c := round(v_monto * 100);
    v_int_total_c := round(v_formula * 100) - v_monto_c;
    v_cap_c := round(v_monto / v_plazo, 2) * 100;
    v_int_c := round(v_int_total_c / 100.0 / v_plazo, 2) * 100;
    cap := array_fill(v_cap_c, array[v_plazo]);
    inte := array_fill(v_int_c, array[v_plazo]);
    cap[v_plazo] := v_monto_c - v_cap_c * (v_plazo - 1);
    inte[v_plazo] := v_int_total_c - v_int_c * (v_plazo - 1);
    cap_pag := array_fill(0::bigint, array[v_plazo]);
    int_pag := array_fill(0::bigint, array[v_plazo]);
    tocada := array_fill(false, array[v_plazo]);

    -- Reparte cada pago entre las cuotas, en orden de fecha
    v_lista := '[]';
    v_capital_total := 0;
    v_interes_total := 0;
    v_cuota := 1;
    v_resto := cap[1];
    for p in
      select value from jsonb_array_elements(coalesce(r->'pagos', '[]'))
      order by value->>'fecha', (value->>'fila')::int
    loop
      v_donde_pago := 'Pagos, fila ' || coalesce(p->>'fila', '?');
      v_fecha := private.fecha_importada(p->>'fecha', v_donde_pago, 'Fecha', p_fundacion, p_hoy);
      if v_fecha < v_desembolso then
        perform private.error_importacion(v_donde_pago, 'Fecha', 'Es anterior al desembolso del crédito N.º '
          || (r->>'referencia') || ' (' || private.dma(v_desembolso) || ')');
      end if;
      v_toma := round(private.monto_importado(p->>'capital', v_donde_pago, 'Capital', true) * 100);
      v_int_parte := round(private.monto_importado(p->>'interes', v_donde_pago, 'Interés', true) * 100);
      if v_toma = 0 and v_int_parte = 0 then
        perform private.error_importacion(v_donde_pago, null, 'El pago necesita capital o interés mayor que 0');
      end if;
      v_capital_total := v_capital_total + v_toma;
      v_interes_total := v_interes_total + v_int_parte;
      if v_capital_total > v_monto_c then
        perform private.error_importacion(v_donde_pago, null, 'Los pagos del crédito N.º ' || (r->>'referencia')
          || ' suman más capital que los ' || private.dinero(v_monto) || ' prestados');
      end if;

      -- El capital cubre las cuotas en orden; un pago de solo interés va a la cuota en curso
      v_partes_k := '{}';
      v_partes_c := '{}';
      declare
        c bigint := v_toma;
      begin
        while c > 0 loop
          while v_resto <= 0 and v_cuota < v_plazo loop
            v_cuota := v_cuota + 1;
            v_resto := cap[v_cuota];
          end loop;
          if v_resto <= 0 then
            -- No debería pasar (el capital no supera lo prestado): queda en la última cuota
            v_partes_k := v_partes_k || v_plazo;
            v_partes_c := v_partes_c || c;
            c := 0;
          else
            v_toma := least(c, v_resto);
            v_partes_k := v_partes_k || v_cuota;
            v_partes_c := v_partes_c || v_toma;
            c := c - v_toma;
            v_resto := v_resto - v_toma;
          end if;
        end loop;
      end;
      if cardinality(v_partes_k) = 0 then
        while v_resto <= 0 and v_cuota < v_plazo loop
          v_cuota := v_cuota + 1;
          v_resto := cap[v_cuota];
        end loop;
        v_partes_k := array[v_cuota];
        v_partes_c := array[0::bigint];
      end if;

      -- El interés, entre las cuotas que tocó, según el capital de cada una
      select coalesce(sum(x), 0) into v_suma from unnest(v_partes_c) x;
      v_int_repartido := 0;
      for i in 1 .. cardinality(v_partes_k) loop
        j := v_partes_k[i];
        if i = cardinality(v_partes_k) then
          v_toma := v_int_parte - v_int_repartido;
        elsif v_suma = 0 then
          v_toma := 0;
        else
          v_toma := (v_int_parte * v_partes_c[i]) / v_suma;
        end if;
        v_int_repartido := v_int_repartido + v_toma;
        cap_pag[j] := cap_pag[j] + v_partes_c[i];
        int_pag[j] := int_pag[j] + v_toma;
        tocada[j] := true;
        if v_partes_c[i] + v_toma > 0 then
          v_lista := v_lista || jsonb_build_object('fecha', v_fecha, 'cuota', j,
            'capital', v_partes_c[i], 'interes', v_toma);
        end if;
      end loop;
    end loop;

    -- Lo que falta: las cuotas cubiertas quedan saldadas; en las demás rige la fórmula
    v_saldo_c := 0;
    v_condonado_c := 0;
    for j in 1 .. v_plazo loop
      if tocada[j] and cap_pag[j] >= cap[j] then
        v_condonado_c := v_condonado_c + greatest(inte[j] - int_pag[j], 0);
      else
        v_saldo_c := v_saldo_c + greatest(cap[j] - cap_pag[j], 0) + greatest(inte[j] - int_pag[j], 0);
      end if;
    end loop;
    v_pagado_c := v_capital_total + v_interes_total;

    begin
      insert into public.creditos
        (caja_id, socio_id, monto_solicitado, tasa_interes, plazo_meses, monto_total, cuota_mensual,
         saldo_pendiente, estado, fecha_desembolso, fecha_vencimiento, aprobado_por, interes_condonado)
      values
        (p_caja, v_socio.id, v_monto, v_tasa, v_plazo, (v_pagado_c + v_saldo_c + v_condonado_c) / 100.0,
         round(v_formula / v_plazo, 2), v_saldo_c / 100.0,
         case when v_saldo_c = 0 then 'pagado' else 'activo' end::public.estado_credito,
         v_desembolso, (v_desembolso + make_interval(months => v_plazo))::date, auth.uid(), v_condonado_c / 100.0)
      returning * into v_credito;
    exception when sqlstate 'DM400' then
      perform private.error_importacion(v_donde, null, sqlerrm);
    end;

    -- Los pagos, con el saldo que quedaba antes y después de cada uno
    v_corre := v_pagado_c + v_saldo_c;
    for p in select value from jsonb_array_elements(v_lista) loop
      v_toma := (p->>'capital')::bigint + (p->>'interes')::bigint;
      insert into public.pagos_credito
        (caja_id, credito_id, numero_cuota, monto_pagado, monto_capital, monto_interes, saldo_antes,
         saldo_despues, fecha_pago, registrado_por, es_importado, created_at)
      values
        (p_caja, v_credito.id, (p->>'cuota')::int, v_toma / 100.0, (p->>'capital')::bigint / 100.0,
         (p->>'interes')::bigint / 100.0, v_corre / 100.0, (v_corre - v_toma) / 100.0, (p->>'fecha')::date,
         auth.uid(), true, clock_timestamp());
      v_corre := v_corre - v_toma;
    end loop;

    v_resumen := v_resumen || jsonb_build_object(
      'referencia', r->'referencia',
      'numero', v_credito.numero,
      'socio', v_socio.nombre || ' ' || v_socio.apellido,
      'monto', v_monto,
      'estado', v_credito.estado,
      'pagos', jsonb_array_length(coalesce(r->'pagos', '[]')),
      'capital_pagado', round(v_capital_total / 100.0, 2),
      'interes_pagado', round(v_interes_total / 100.0, 2),
      'interes_condonado', v_credito.interes_condonado,
      'saldo_pendiente', v_credito.saldo_pendiente);
  end loop;

  perform set_config('domus.importando', '', true);
  return jsonb_build_object('creditos', v_resumen);
end;
$$;

-- ── La función que llama el backend ────────────────────────────────

create or replace function public.importar_excel(
  p_caja uuid, p_modulo text, p_filas jsonb, p_simular boolean default false)
returns json
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_fundacion date;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_pagos int;
  v jsonb;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  if p_modulo is null or p_modulo not in ('socios', 'ahorros', 'creditos', 'fondos') then
    raise exception 'Módulo de importación inválido' using errcode = 'DM400';
  end if;
  select fecha_fundacion into v_fundacion from public.cajas where id = p_caja;
  if v_fundacion is null then
    raise exception 'La caja no tiene fecha de fundación. Configúrala en Configuración, Periodo de la caja'
      using errcode = 'DM400';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene filas para importar' using errcode = 'DM400';
  end if;
  if p_modulo = 'creditos' then
    select coalesce(sum(jsonb_array_length(coalesce(e->'pagos', '[]'))), 0) into v_pagos
    from jsonb_array_elements(p_filas) e;
  end if;
  if jsonb_array_length(p_filas) > 2000 or coalesce(v_pagos, 0) > 2000 then
    raise exception 'Una hoja admite hasta 2.000 filas' using errcode = 'DM400';
  end if;

  -- Un simulacro hace todo y lo deshace con un error propio que se atrapa aquí mismo
  begin
    v := case p_modulo
      when 'socios' then private.importar_socios(p_caja, p_filas, v_fundacion, v_hoy)
      when 'ahorros' then private.importar_ahorros(p_caja, p_filas, v_fundacion, v_hoy)
      when 'fondos' then private.importar_fondos(p_caja, p_filas, v_fundacion, v_hoy)
      else private.importar_creditos(p_caja, p_filas, v_fundacion, v_hoy)
    end;
    if p_simular then
      raise exception 'simulacro' using errcode = 'DMSIM';
    end if;
  exception when sqlstate 'DMSIM' then
    return (v || '{"simulado": true}')::json;
  end;
  return (v || '{"simulado": false}')::json;
end;
$$;

revoke all on function public.importar_excel(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.importar_excel(uuid, text, jsonb, boolean) to authenticated;

revoke all on function private.importar_socios(uuid, jsonb, date, date) from public, anon, authenticated;
revoke all on function private.importar_ahorros(uuid, jsonb, date, date) from public, anon, authenticated;
revoke all on function private.importar_fondos(uuid, jsonb, date, date) from public, anon, authenticated;
revoke all on function private.importar_creditos(uuid, jsonb, date, date) from public, anon, authenticated;
revoke all on function private.siguiente_numero_cuenta(uuid) from public, anon, authenticated;
revoke all on function private.socio_importado(uuid, text, date, text, text) from public, anon, authenticated;
