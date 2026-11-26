-- 011: foto opcional del comprobante en depósitos, retiros y pagos (Etapa 6, T16)
--
-- El movimiento se registra primero, como siempre (registrar_movimiento,
-- registrar_pago_credito): la foto es opcional y no debe impedir que el dinero quede
-- registrado. Después el backend sube la foto a Storage (bucket comprobantes, 010) y la
-- une al movimiento con adjuntar_comprobante. La misma función sirve para agregar la foto
-- más tarde desde el historial.
--
-- Un comprobante no se cambia ni se quita: es respaldo del movimiento. Por eso la
-- función solo lo pone si aún no tiene.

alter table public.transacciones add column if not exists comprobante text;
alter table public.pagos_credito add column if not exists comprobante text;

-- p_tipo: 'movimiento' (transacciones) o 'pago' (pagos_credito)
-- p_ruta: la ruta en el bucket comprobantes, {caja}/{socio}/{archivo}
create or replace function public.adjuntar_comprobante(p_tipo text, p_id uuid, p_ruta text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_caja uuid;
  v_socio uuid;
  v_actual text;
begin
  if p_tipo = 'movimiento' then
    select t.caja_id, c.socio_id, t.comprobante into v_caja, v_socio, v_actual
    from public.transacciones t join public.cuentas_ahorro c on c.id = t.cuenta_id
    where t.id = p_id for update of t;
  elsif p_tipo = 'pago' then
    select p.caja_id, c.socio_id, p.comprobante into v_caja, v_socio, v_actual
    from public.pagos_credito p join public.creditos c on c.id = p.credito_id
    where p.id = p_id for update of p;
  else
    raise exception 'Tipo de comprobante desconocido' using errcode = 'DM400';
  end if;

  -- Sin el registro o sin rol de tesorero en su caja, la misma respuesta
  if v_caja is null or not private.tiene_rol(v_caja, 'tesorero') then
    raise exception 'Registro no encontrado' using errcode = 'DM404';
  end if;
  if not private.caja_operable(v_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  if v_actual is not null then
    raise exception 'Este registro ya tiene su comprobante' using errcode = 'DM409';
  end if;
  -- La foto tiene que estar en la carpeta de esa caja y ese socio, y existir
  if p_ruta is null or p_ruta not like v_caja || '/' || v_socio || '/%' then
    raise exception 'La foto no corresponde a este registro' using errcode = 'DM400';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'comprobantes' and name = p_ruta) then
    raise exception 'La foto no se encuentra' using errcode = 'DM400';
  end if;

  if p_tipo = 'movimiento' then
    update public.transacciones set comprobante = p_ruta where id = p_id;
  else
    update public.pagos_credito set comprobante = p_ruta where id = p_id;
  end if;

  return json_build_object('id', p_id, 'comprobante', p_ruta);
end;
$$;

revoke execute on function public.adjuntar_comprobante(text, uuid, text) from public, anon;
grant execute on function public.adjuntar_comprobante(text, uuid, text) to authenticated;
