-- 006: el administrador de DOMUS bloquea y restablece cajas (Etapa 6, T10; HU019, HU020)
--
-- La 004 ya agregó cajas.estado ('activa' | 'bloqueada' | 'eliminada') y las políticas
-- que impiden registrar en una caja que no está activa (private.caja_operable). Una caja
-- bloqueada se sigue leyendo: sus miembros ven sus datos, pero nadie registra nada.
--
-- Aquí: la bitácora del administrador pasa a registrar también acciones sobre cajas, y
-- una función cambia el estado y escribe la bitácora en la misma transacción (sin
-- registro no hay bloqueo, HU-S02). Solo la llama el backend con la clave de servicio.

-- ─── Bitácora: acciones sobre cajas ──────────────────────────────────────────────────
alter table public.bitacora_administracion
  add column if not exists caja_id uuid references public.cajas(id) on delete set null,
  add column if not exists caja_nombre text;

-- Las filas de una caja no tienen cuenta afectada
alter table public.bitacora_administracion alter column usuario_correo set default '';

alter table public.bitacora_administracion drop constraint if exists bitacora_administracion_accion_check;
alter table public.bitacora_administracion add constraint bitacora_administracion_accion_check
  check (accion in ('bloquear', 'restablecer', 'bloquear_caja', 'restablecer_caja'));

-- Cada fila habla de una cuenta o de una caja
alter table public.bitacora_administracion drop constraint if exists bitacora_administracion_sujeto_check;
alter table public.bitacora_administracion add constraint bitacora_administracion_sujeto_check
  check (
    (accion in ('bloquear', 'restablecer') and caja_nombre is null)
    or (accion in ('bloquear_caja', 'restablecer_caja') and caja_nombre is not null)
  );

-- ─── Bloquear o restablecer una caja ─────────────────────────────────────────────────
-- p_admin: quien lo hace (el backend ya comprobó que administra DOMUS).
create or replace function public.admin_estado_caja(
  p_caja uuid, p_bloquear boolean, p_motivo text, p_admin uuid
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_caja public.cajas;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if char_length(v_motivo) < 10 then
    raise exception 'Escribe el motivo, con al menos 10 caracteres' using errcode = 'DM400';
  end if;

  select * into v_caja from public.cajas where id = p_caja for update;
  if not found then
    raise exception 'La caja no existe' using errcode = 'DM404';
  end if;
  if v_caja.estado = 'eliminada' then
    raise exception 'La caja fue eliminada' using errcode = 'DM409';
  end if;
  if p_bloquear and v_caja.estado = 'bloqueada' then
    raise exception 'La caja ya está bloqueada' using errcode = 'DM409';
  end if;
  if not p_bloquear and v_caja.estado <> 'bloqueada' then
    raise exception 'La caja no está bloqueada' using errcode = 'DM409';
  end if;

  update public.cajas set
    estado = case when p_bloquear then 'bloqueada' else 'activa' end,
    estado_motivo = case when p_bloquear then v_motivo end,
    estado_cambiado_en = now()
  where id = p_caja
  returning * into v_caja;

  insert into public.bitacora_administracion (admin_id, accion, caja_id, caja_nombre, motivo)
  values (p_admin, case when p_bloquear then 'bloquear_caja' else 'restablecer_caja' end,
          p_caja, v_caja.nombre, v_motivo);

  return json_build_object(
    'id', v_caja.id, 'estado', v_caja.estado,
    'estado_motivo', v_caja.estado_motivo, 'estado_cambiado_en', v_caja.estado_cambiado_en
  );
end;
$$;

revoke execute on function public.admin_estado_caja(uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_estado_caja(uuid, boolean, text, uuid) to service_role;
