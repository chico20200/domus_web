-- 026: Quitar de mi lista una caja eliminada (Etapa 7, T11; especificaciones §12)
--
-- Una caja eliminada (024) sigue en "Mis cajas" de quienes tenían acceso, como "caja
-- eliminada": pueden entrar a consultar su historia, como en una caja bloqueada, y
-- quitarla de su lista cuando quieran. Quitarla desactiva su propia membresía; los datos
-- de la caja no se tocan. Nadie cambia su propia membresía con un update (solo el
-- coordinador gestiona miembros, 004), por eso va en una función, y solo para una caja
-- eliminada: de una caja que opera se sale por la salida con liquidación o lo quita el
-- coordinador.

create or replace function public.quitar_caja_eliminada(p_caja uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.miembros_caja
                  where caja_id = p_caja and user_id = auth.uid() and activo) then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  if not exists (select 1 from public.cajas where id = p_caja and estado = 'eliminada') then
    raise exception 'Solo se quita de la lista una caja eliminada' using errcode = 'DM409';
  end if;
  update public.miembros_caja set activo = false
   where caja_id = p_caja and user_id = auth.uid();
end;
$$;

revoke execute on function public.quitar_caja_eliminada(uuid) from public, anon;
grant execute on function public.quitar_caja_eliminada(uuid) to authenticated;
