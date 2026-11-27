-- 024: Eliminar una caja (Etapa 7, T9; especificaciones §12)
--
-- Una caja se elimina al final de su vida, después de liquidar a todos sus socios. No se
-- borra nada: pasa a estado 'eliminada' (la 004 ya lo preveía), nadie registra nada en
-- ella (caja_operable) y sus datos se conservan (decisión del 26 nov). Sus miembros la ven
-- como "caja eliminada" y la quitan de su lista (T11).
--
-- Solo el coordinador, y solo si no queda nada en curso:
-- - ningún crédito pendiente, activo ni vencido;
-- - ninguna cuenta de ahorro con saldo (cerrada o en $0);
-- - ningún fondo de caja con saldo;
-- - ningún socio activo (cada uno salió con su liquidación).
-- requisitos_eliminar_caja devuelve qué falta, para que la pantalla lo muestre (T10), y
-- eliminar_caja vuelve a comprobarlo todo con la caja bloqueada para escritura, así que
-- nada puede colarse entre la revisión y la eliminación. Pide el nombre de la caja,
-- escrito como confirmación. Al eliminarla se desactivan sus códigos de invitación.

alter table public.cajas
  add column if not exists eliminada_por uuid references auth.users (id);

comment on column public.cajas.eliminada_por is
  'Quién la eliminó (Etapa 7, migración 024); la fecha va en estado_cambiado_en.';

-- ─── Lo que falta para eliminarla ───────────────────────────────────────────────────
create or replace function public.requisitos_eliminar_caja(p_caja uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_creditos int;
  v_cuentas int;
  v_ahorros numeric(12,2);
  v_fondos int;
  v_saldo_fondos numeric(12,2);
  v_socios int;
begin
  if not private.tiene_rol(p_caja, 'coordinador') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;

  select count(*) into v_creditos from public.creditos
   where caja_id = p_caja and estado in ('pendiente', 'activo', 'vencido');
  select count(*), coalesce(sum(saldo), 0) into v_cuentas, v_ahorros from public.cuentas_ahorro
   where caja_id = p_caja and saldo > 0;
  select count(*), coalesce(sum(saldo), 0) into v_fondos, v_saldo_fondos from public.fondos_caja
   where caja_id = p_caja and saldo > 0;
  select count(*) into v_socios from public.socios where caja_id = p_caja and activo;

  return json_build_object(
    'creditos', v_creditos,
    'cuentas_con_saldo', v_cuentas,
    'ahorros', v_ahorros,
    'fondos_con_saldo', v_fondos,
    'saldo_fondos', v_saldo_fondos,
    'socios_activos', v_socios,
    'puede_eliminar', v_creditos = 0 and v_cuentas = 0 and v_fondos = 0 and v_socios = 0
  );
end;
$$;

revoke execute on function public.requisitos_eliminar_caja(uuid) from public, anon;
grant execute on function public.requisitos_eliminar_caja(uuid) to authenticated;

-- ─── Eliminarla ─────────────────────────────────────────────────────────────────────
create or replace function public.eliminar_caja(p_caja uuid, p_nombre text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  v_req json;
begin
  if not private.tiene_rol(p_caja, 'coordinador') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  -- Bloqueo de la fila: mientras se revisa, nadie más cambia su estado
  select * into v_caja from public.cajas where id = p_caja for update;
  if v_caja.estado = 'eliminada' then
    raise exception 'La caja ya está eliminada' using errcode = 'DM409';
  end if;
  if v_caja.estado <> 'activa' then
    raise exception 'La caja está bloqueada por la administración de DOMUS: no se puede eliminar'
      using errcode = 'DM409';
  end if;
  if btrim(coalesce(p_nombre, '')) <> btrim(v_caja.nombre) then
    raise exception 'Escribe el nombre de la caja tal como aparece para confirmar'
      using errcode = 'DM400';
  end if;

  -- Que nadie registre nada mientras se revisa: los socios, las cuentas, los créditos y los
  -- fondos de la caja quedan bloqueados para escritura hasta el final de la transacción
  perform 1 from public.socios where caja_id = p_caja for update;
  perform 1 from public.cuentas_ahorro where caja_id = p_caja for update;
  perform 1 from public.creditos where caja_id = p_caja for update;
  perform 1 from public.fondos_caja where caja_id = p_caja for update;

  v_req := public.requisitos_eliminar_caja(p_caja);
  if (v_req->>'socios_activos')::int > 0 then
    raise exception 'Aún tiene % socio(s) activo(s): registra la salida de cada uno con su liquidación',
      v_req->>'socios_activos' using errcode = 'DM409';
  end if;
  if (v_req->>'creditos')::int > 0 then
    raise exception 'Aún tiene % crédito(s) pendiente(s) o en curso', v_req->>'creditos'
      using errcode = 'DM409';
  end if;
  if (v_req->>'cuentas_con_saldo')::int > 0 then
    raise exception 'Aún hay $% en % cuenta(s) de ahorro',
      to_char((v_req->>'ahorros')::numeric, 'FM999999990.00'), v_req->>'cuentas_con_saldo'
      using errcode = 'DM409';
  end if;
  if (v_req->>'fondos_con_saldo')::int > 0 then
    raise exception 'Aún hay $% en % fondo(s) de caja: retíralo antes',
      to_char((v_req->>'saldo_fondos')::numeric, 'FM999999990.00'), v_req->>'fondos_con_saldo'
      using errcode = 'DM409';
  end if;

  update public.cajas
     set estado = 'eliminada', estado_motivo = 'Eliminada por su coordinador',
         estado_cambiado_en = now(), eliminada_por = auth.uid()
   where id = p_caja
  returning * into v_caja;
  update public.invitaciones_caja set activo = false where caja_id = p_caja and activo;

  return json_build_object('id', v_caja.id, 'nombre', v_caja.nombre, 'estado', v_caja.estado,
                           'estado_cambiado_en', v_caja.estado_cambiado_en);
end;
$$;

revoke execute on function public.eliminar_caja(uuid, text) from public, anon;
grant execute on function public.eliminar_caja(uuid, text) to authenticated;
