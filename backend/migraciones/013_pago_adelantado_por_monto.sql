-- 013: pago adelantado por monto (Etapa 6, T30)
--
-- Un adelanto de capital se reparte desde la última cuota hacia atrás. Las cuotas que
-- quedan con todo su capital cubierto se marcan como adelantadas y se condona su interés
-- (como el pago adelantado de una cuota de antes). La que queda a medias recibe solo
-- capital y conserva su interés completo: el interés es fijo todos los meses.
--
-- El backend calcula el reparto (utils/amortizacion.js, planAdelanto) y esta función lo
-- registra todo junto: cada parte es un pago de registrar_pago_credito, y si una falla
-- no queda ninguna. Además revisa lo que no depende del cálculo:
--   - solo el tesorero de la caja, en una caja operable y un crédito activo;
--   - solo cuotas que vencen después del mes en curso (nadie condona interés de una
--     cuota que ya tocaba pagar), sin repetir cuota;
--   - el saldo no cambió desde que se calculó (p_saldo_esperado).
--
-- p_partes: [{ "numero_cuota": 6, "capital": 100, "interes_condonado": 6 }, …]
-- interes_condonado > 0 marca la cuota como adelantada (es_prepago); 0 es la cuota a
-- medias, que se registra como pago de solo capital.

create or replace function public.registrar_pago_adelantado(
  p_caja uuid,
  p_credito uuid,
  p_saldo_esperado numeric,
  p_partes jsonb,
  p_fecha date default null
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_credito public.creditos;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_parte jsonb;
  v_cuota int;
  v_capital numeric;
  v_condonado numeric;
  v_vence date;
  v_vistas int[] := '{}';
  v_saldo numeric := p_saldo_esperado;
  v_registro json;
  v_pagos json[] := '{}';
  v_total_capital numeric := 0;
  v_total_condonado numeric := 0;
begin
  if not private.tiene_rol(p_caja, 'tesorero') then
    raise exception 'Crédito no encontrado' using errcode = 'DM404';
  end if;
  if p_partes is null or jsonb_typeof(p_partes) <> 'array' or jsonb_array_length(p_partes) = 0 then
    raise exception 'El pago adelantado no tiene cuotas' using errcode = 'DM400';
  end if;

  select * into v_credito from public.creditos
  where id = p_credito and caja_id = p_caja for update;
  if not found then
    raise exception 'Crédito no encontrado' using errcode = 'DM404';
  end if;
  if v_credito.estado <> 'activo' or v_credito.fecha_desembolso is null then
    raise exception 'Solo se puede hacer un pago adelantado en un crédito activo' using errcode = 'DM400';
  end if;

  for v_parte in select * from jsonb_array_elements(p_partes) loop
    v_cuota := (v_parte->>'numero_cuota')::int;
    v_capital := coalesce((v_parte->>'capital')::numeric, 0);
    v_condonado := coalesce((v_parte->>'interes_condonado')::numeric, 0);

    if v_cuota is null or v_cuota = any(v_vistas) then
      raise exception 'Número de cuota inválido' using errcode = 'DM400';
    end if;
    v_vistas := v_vistas || v_cuota;

    -- Vence el último día del mes, n meses después del desembolso (amortizacion.js)
    v_vence := (date_trunc('month', v_credito.fecha_desembolso)
                + make_interval(months => v_cuota + 1) - interval '1 day')::date;
    if date_trunc('month', v_vence) <= date_trunc('month', v_hoy) then
      raise exception 'Solo se adelantan cuotas que vencen después de este mes' using errcode = 'DM400';
    end if;

    -- registrar_pago_credito revisa el rol, la caja, los montos, la cuota y el saldo
    v_registro := public.registrar_pago_credito(
      p_caja, p_credito, v_saldo, v_cuota, v_capital, 0,
      case when v_condonado > 0 then 'prepago' else 'cuota' end,
      null, v_condonado, p_fecha);

    v_saldo := (v_registro->>'saldo_pendiente')::numeric;
    v_pagos := v_pagos || (v_registro->'pago');
    v_total_capital := v_total_capital + v_capital;
    v_total_condonado := v_total_condonado + v_condonado;
  end loop;

  return json_build_object(
    'pagos', to_json(v_pagos),
    'capital_pagado', v_total_capital,
    'interes_condonado', v_total_condonado,
    'saldo_pendiente', v_saldo,
    'credito_pagado', v_saldo <= 0.001
  );
end;
$$;

revoke execute on function public.registrar_pago_adelantado(uuid, uuid, numeric, jsonb, date) from public, anon;
grant execute on function public.registrar_pago_adelantado(uuid, uuid, numeric, jsonb, date) to authenticated;
