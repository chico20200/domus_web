-- 021: Salida de un socio con liquidación (Etapa 7, T4; especificaciones §12)
--
-- El socio que sale recibe sus ahorros y el interés del ciclo, menos su deuda: el capital
-- pendiente y el interés de las cuotas vencidas; el interés de las cuotas que aún no
-- vencen se condona. No sale si sus ahorros no cubren la deuda.
--
-- El backend calcula la liquidación (utils/liquidacion.js, el mismo cálculo de la vista
-- previa) y registrar_salida la registra toda junta; si algo falla, no queda nada:
--   1. paga cada crédito en curso con registrar_pago_credito: las cuotas vencidas con su
--      capital y su interés, las demás solo con capital y su interés condonado; el
--      crédito queda pagado;
--   2. anula las solicitudes sin aprobar (no movieron dinero; decisión del 27 nov);
--   3. retira de sus cuentas primero lo que pagó los créditos y después el resto, que se
--      le entrega, y las cierra;
--   4. desactiva la ficha: la 018 anota la fecha de salida y la 020 cierra su periodo;
--   5. guarda la liquidación, con la lista que se revisó antes (ahorros e interés
--      entregados).
-- Revisa por su cuenta lo que no depende del cálculo: solo el coordinador, caja operable,
-- ficha activa, saldos y créditos sin cambios desde la vista previa, todo el capital
-- pendiente cubierto, ahorros que alcanzan y la lista marcada.
--
-- Además, desde aquí una ficha con ahorros o créditos no se desactiva sin liquidación.

create table if not exists public.liquidaciones (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas (id) on delete cascade,
  socio_id uuid not null references public.socios (id) on delete cascade,
  fecha date not null,
  ahorros numeric(12,2) not null check (ahorros >= 0),
  interes numeric(12,2) not null check (interes >= 0),
  ciclo_numero int,
  ciclo_inicio date,
  ciclo_fin date,
  tipo_reparto text check (tipo_reparto in ('diferenciada', 'equitativa')),
  deuda numeric(12,2) not null check (deuda >= 0),
  interes_condonado numeric(12,2) not null default 0 check (interes_condonado >= 0),
  neto numeric(12,2) not null,
  -- { cuentas: [...], creditos: [...], solicitudes: [...] } tal como se liquidaron
  detalle jsonb not null default '{}'::jsonb,
  ahorros_entregados boolean not null,
  interes_entregado boolean not null,
  registrado_por uuid,
  created_at timestamptz not null default now(),
  constraint liquidacion_cuadra check (neto = ahorros + interes - deuda),
  constraint ahorros_cubren_la_deuda check (ahorros >= deuda)
);
create index if not exists liquidaciones_socio_idx on public.liquidaciones (socio_id, fecha);
create index if not exists liquidaciones_ciclo_idx on public.liquidaciones (caja_id, ciclo_inicio);

comment on table public.liquidaciones is
  'Liquidación de salida de cada socio (migración 021). La escribe solo registrar_salida.';

alter table public.liquidaciones enable row level security;
drop policy if exists "tesorero o el titular ven las liquidaciones" on public.liquidaciones;
create policy "tesorero o el titular ven las liquidaciones" on public.liquidaciones
  for select to authenticated
  using (private.tiene_rol(caja_id, 'tesorero') or private.es_mi_ficha(socio_id));
revoke all on public.liquidaciones from anon, authenticated;
grant select on public.liquidaciones to authenticated;

-- ─── Una ficha con ahorros o créditos no se desactiva sin liquidación ────────────────
-- registrar_salida corre como dueño y no pasa por aquí.
create or replace function private.salida_con_liquidacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or not (old.activo and not new.activo) then
    return new;
  end if;
  if exists (select 1 from public.cuentas_ahorro where socio_id = new.id and saldo > 0)
     or exists (select 1 from public.creditos
                 where socio_id = new.id and estado in ('pendiente', 'activo', 'vencido')) then
    raise exception 'Tiene ahorros o créditos en curso: registra su salida con la liquidación'
      using errcode = 'DM409';
  end if;
  return new;
end;
$$;

drop trigger if exists salida_con_liquidacion on public.socios;
create trigger salida_con_liquidacion before update on public.socios
  for each row execute function private.salida_con_liquidacion();

-- ─── registrar_salida ────────────────────────────────────────────────────────────────
-- p_plan:
-- {
--   "cuentas":  [{ "id": uuid, "saldo": 120.50 }, …]            saldos de la vista previa
--   "creditos": [{ "id": uuid, "saldo_pendiente": 300.00,
--                  "partes": [{ "numero_cuota": 3, "capital": 100, "interes": 12,
--                               "interes_condonado": 0 }, …] }, …]
--   "solicitudes": [uuid, …]
--   "interes":  { "monto": 18.37, "ciclo_numero": 2, "ciclo_inicio": "2026-01-01",
--                 "ciclo_fin": "2026-12-31", "tipo": "diferenciada" } | null
--   "detalle":  { … }                                            lo que se muestra en el PDF
--   "ahorros_entregados": true, "interes_entregado": true
-- }
create or replace function public.registrar_salida(p_caja uuid, p_socio uuid, p_plan jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_socio public.socios;
  v_cta record;
  v_cr public.creditos;
  v_item jsonb;
  v_parte jsonb;
  v_reg json;
  v_saldo numeric(12,2);
  v_capital_plan numeric(12,2);
  v_capital_falta numeric(12,2);
  v_ahorros numeric(12,2) := 0;
  v_deuda numeric(12,2) := 0;
  v_condonado numeric(12,2) := 0;
  v_interes numeric(12,2);
  v_por_pagar numeric(12,2);
  v_retiro numeric(12,2);
  v_vistas uuid[] := '{}';
  v_liq public.liquidaciones;
begin
  -- Quién y dónde
  if not private.tiene_rol(p_caja, 'coordinador') then
    raise exception 'Socio no encontrado' using errcode = 'DM404';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  select * into v_socio from public.socios where id = p_socio and caja_id = p_caja for update;
  if not found then
    raise exception 'Socio no encontrado' using errcode = 'DM404';
  end if;
  if not v_socio.activo then
    raise exception 'La ficha ya está inactiva: ya salió de la caja' using errcode = 'DM409';
  end if;
  if coalesce((p_plan->>'ahorros_entregados')::boolean, false) is not true
     or coalesce((p_plan->>'interes_entregado')::boolean, false) is not true then
    raise exception 'Antes de registrar la salida, confirma que se le entregaron sus ahorros y el interés del ciclo'
      using errcode = 'DM400';
  end if;

  v_interes := coalesce((p_plan->'interes'->>'monto')::numeric, 0);
  if v_interes < 0 or round(v_interes, 2) <> v_interes then
    raise exception 'El interés del ciclo no es válido' using errcode = 'DM400';
  end if;

  -- Las cuentas: las mismas, con los mismos saldos que en la vista previa
  for v_cta in
    select * from public.cuentas_ahorro where socio_id = p_socio and caja_id = p_caja for update
  loop
    v_item := null;
    select x into v_item from jsonb_array_elements(coalesce(p_plan->'cuentas', '[]')) x
     where (x->>'id')::uuid = v_cta.id;
    if v_item is null and v_cta.saldo > 0 then
      raise exception 'Sus cuentas cambiaron mientras se preparaba la liquidación. Vuelve a calcularla.'
        using errcode = 'DM409';
    end if;
    if v_item is not null and (v_item->>'saldo')::numeric <> v_cta.saldo then
      raise exception 'El saldo de la cuenta % cambió mientras se preparaba la liquidación. Vuelve a calcularla.',
        v_cta.numero_cuenta using errcode = 'DM409';
    end if;
    if v_cta.saldo > 0 and v_cta.estado <> 'activa' then
      raise exception 'La cuenta % está %: reábrela antes de liquidarla', v_cta.numero_cuenta, v_cta.estado
        using errcode = 'DM409';
    end if;
    v_ahorros := v_ahorros + v_cta.saldo;
  end loop;

  -- 1. Los créditos en curso: todos en el plan y saldados
  if exists (select 1 from public.creditos c
              where c.socio_id = p_socio and c.caja_id = p_caja and c.estado in ('activo', 'vencido')
                and not exists (select 1 from jsonb_array_elements(coalesce(p_plan->'creditos', '[]')) x
                                 where (x->>'id')::uuid = c.id)) then
    raise exception 'Sus créditos cambiaron mientras se preparaba la liquidación. Vuelve a calcularla.'
      using errcode = 'DM409';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_plan->'creditos', '[]')) loop
    select * into v_cr from public.creditos
     where id = (v_item->>'id')::uuid and caja_id = p_caja and socio_id = p_socio for update;
    if not found or v_cr.estado not in ('activo', 'vencido') or v_cr.id = any(v_vistas) then
      raise exception 'Sus créditos cambiaron mientras se preparaba la liquidación. Vuelve a calcularla.'
        using errcode = 'DM409';
    end if;
    v_vistas := v_vistas || v_cr.id;

    -- Todo el capital que falta, ni un centavo condonado
    select coalesce(sum((x->>'capital')::numeric), 0) into v_capital_plan
      from jsonb_array_elements(coalesce(v_item->'partes', '[]')) x;
    select v_cr.monto_solicitado - coalesce(sum(p.monto_capital), 0) into v_capital_falta
      from public.pagos_credito p where p.credito_id = v_cr.id;
    if abs(v_capital_plan - v_capital_falta) > 0.01 then
      raise exception 'La liquidación del crédito N.º % no cubre todo su capital pendiente ($%)',
        v_cr.numero, to_char(v_capital_falta, 'FM999999990.00') using errcode = 'DM409';
    end if;

    v_saldo := (v_item->>'saldo_pendiente')::numeric;
    for v_parte in select * from jsonb_array_elements(coalesce(v_item->'partes', '[]')) loop
      -- registrar_pago_credito revisa el rol, los montos, la cuota y el saldo esperado
      v_reg := public.registrar_pago_credito(
        p_caja, v_cr.id, v_saldo,
        (v_parte->>'numero_cuota')::int,
        coalesce((v_parte->>'capital')::numeric, 0),
        coalesce((v_parte->>'interes')::numeric, 0),
        case when coalesce((v_parte->>'interes_condonado')::numeric, 0) > 0 then 'prepago' else 'cuota' end,
        null,
        coalesce((v_parte->>'interes_condonado')::numeric, 0),
        v_hoy);
      v_saldo := (v_reg->>'saldo_pendiente')::numeric;
      v_deuda := v_deuda + coalesce((v_parte->>'capital')::numeric, 0)
                         + coalesce((v_parte->>'interes')::numeric, 0);
      v_condonado := v_condonado + coalesce((v_parte->>'interes_condonado')::numeric, 0);
    end loop;
    if v_saldo > 0.001 then
      raise exception 'El crédito N.º % no queda saldado con la liquidación (faltan $%)',
        v_cr.numero, to_char(v_saldo, 'FM999999990.00') using errcode = 'DM409';
    end if;
  end loop;

  if v_ahorros < v_deuda then
    raise exception 'Sus ahorros ($%) no cubren su deuda ($%)',
      to_char(v_ahorros, 'FM999999990.00'), to_char(v_deuda, 'FM999999990.00') using errcode = 'DM409';
  end if;

  -- 2. Las solicitudes sin aprobar: las del plan y ninguna otra
  if (select count(*) from public.creditos
       where socio_id = p_socio and caja_id = p_caja and estado = 'pendiente')
     <> jsonb_array_length(coalesce(p_plan->'solicitudes', '[]')) then
    raise exception 'Sus solicitudes de crédito cambiaron mientras se preparaba la liquidación. Vuelve a calcularla.'
      using errcode = 'DM409';
  end if;
  delete from public.creditos
   where socio_id = p_socio and caja_id = p_caja and estado = 'pendiente'
     and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_plan->'solicitudes', '[]')) x);

  -- 3. Retiros: primero lo que pagó los créditos, después lo que se le entrega
  v_por_pagar := v_deuda;
  for v_cta in
    select * from public.cuentas_ahorro
     where socio_id = p_socio and caja_id = p_caja and saldo > 0 order by numero_cuenta
  loop
    v_saldo := v_cta.saldo;
    if v_por_pagar > 0 then
      v_retiro := least(v_por_pagar, v_saldo);
      insert into public.transacciones
        (caja_id, cuenta_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, registrado_por, fecha)
      values (p_caja, v_cta.id, 'retiro', v_retiro, v_saldo, v_saldo - v_retiro,
              'Liquidación de salida: pago de sus créditos', auth.uid(), v_hoy);
      v_saldo := v_saldo - v_retiro;
      v_por_pagar := v_por_pagar - v_retiro;
    end if;
    if v_saldo > 0 then
      insert into public.transacciones
        (caja_id, cuenta_id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, registrado_por, fecha)
      values (p_caja, v_cta.id, 'retiro', v_saldo, v_saldo, 0,
              'Liquidación de salida: entrega de sus ahorros', auth.uid(), v_hoy);
    end if;
    update public.cuentas_ahorro set saldo = 0, updated_at = now() where id = v_cta.id;
  end loop;
  update public.cuentas_ahorro
     set estado = 'cerrada', fecha_cierre = v_hoy, updated_at = now()
   where socio_id = p_socio and caja_id = p_caja and estado <> 'cerrada';

  -- 4. La ficha: fecha de salida (018) y fin de su periodo (020)
  update public.socios set activo = false, updated_at = now() where id = p_socio;

  -- 5. La liquidación
  insert into public.liquidaciones
    (caja_id, socio_id, fecha, ahorros, interes, ciclo_numero, ciclo_inicio, ciclo_fin, tipo_reparto,
     deuda, interes_condonado, neto, detalle, ahorros_entregados, interes_entregado, registrado_por)
  values
    (p_caja, p_socio, v_hoy, v_ahorros, v_interes,
     (p_plan->'interes'->>'ciclo_numero')::int,
     (p_plan->'interes'->>'ciclo_inicio')::date,
     (p_plan->'interes'->>'ciclo_fin')::date,
     p_plan->'interes'->>'tipo',
     v_deuda, v_condonado, v_ahorros + v_interes - v_deuda,
     coalesce(p_plan->'detalle', '{}'::jsonb), true, true, auth.uid())
  returning * into v_liq;

  return row_to_json(v_liq);
end;
$$;

revoke execute on function public.registrar_salida(uuid, uuid, jsonb) from public, anon;
grant execute on function public.registrar_salida(uuid, uuid, jsonb) to authenticated;
