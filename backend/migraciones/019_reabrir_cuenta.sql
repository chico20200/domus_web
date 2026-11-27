-- 019: Cerrar y reabrir una cuenta de ahorro (Etapa 7, T1)
--
-- La 005 ya exige saldo 0 para cerrar una cuenta y pone fecha_cierre. Falta la regla de
-- vuelta: una cuenta cerrada solo se reabre si la ficha de su titular está activa. Sin
-- ella, la cuenta de alguien que salió de la caja podría volver a recibir depósitos. Para
-- un socio que vuelve, primero se reactiva la ficha (T8) y después se reabre la cuenta.

create or replace function private.validar_cuenta() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.saldo := 0;
    new.estado := 'activa';
    new.fecha_cierre := null;
    return new;
  end if;
  if new.estado = 'cerrada' and old.estado <> 'cerrada' then
    if old.saldo > 0 then
      raise exception 'Para cerrar la cuenta, el saldo tiene que estar en 0 ($% disponibles)',
        to_char(old.saldo, 'FM999999990.00') using errcode = 'DM400';
    end if;
    new.fecha_cierre := (now() at time zone 'America/Guayaquil')::date;
  elsif new.estado <> 'cerrada' then
    if old.estado = 'cerrada'
       and not exists (select 1 from public.socios s where s.id = new.socio_id and s.activo) then
      raise exception 'El titular está inactivo: reactiva su ficha antes de reabrir la cuenta'
        using errcode = 'DM409';
    end if;
    new.fecha_cierre := null;
  end if;
  return new;
end;
$$;
