-- 023: Reactivar a un socio que salió (Etapa 7, T8)
--
-- Quien salió con su liquidación puede volver: se reactiva su ficha, con sus datos de
-- antes salvo la dirección, que se escribe de nuevo (especificaciones §12). Al pasar a
-- activa, la base ya hace lo demás: borra la fecha de salida (018) y abre un periodo
-- nuevo desde hoy (020), así el reparto no lo cuenta en los meses en que estuvo fuera.
--
-- Aquí, en la base, las dos reglas de la reactivación:
-- - Solo el coordinador cambia el estado de una ficha, en los dos sentidos (antes, la
--   política de update dejaba al tesorero; la ruta ya lo limitaba). La salida va por
--   registrar_salida (security definer), que no pasa por esta regla.
-- - Al reactivar, la dirección no puede quedar vacía ni ser la de antes sin tocar: la
--   ruta la manda escrita de nuevo; aquí se exige que no esté vacía.
-- Si vuelve a usar DOMUS, entra a la caja con un código de invitación (022).

create or replace function private.cambiar_estado_socio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or new.activo is not distinct from old.activo then
    return new;
  end if;
  if not private.tiene_rol(new.caja_id, 'coordinador') then
    raise exception 'Solo el coordinador cambia el estado de una ficha' using errcode = 'DM403';
  end if;
  if new.activo and coalesce(btrim(new.direccion), '') = '' then
    raise exception 'Para reactivar la ficha, escribe su dirección actual' using errcode = 'DM400';
  end if;
  return new;
end;
$$;

drop trigger if exists cambiar_estado_socio on public.socios;
create trigger cambiar_estado_socio before update on public.socios
  for each row execute function private.cambiar_estado_socio();
