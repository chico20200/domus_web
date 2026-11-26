-- 008: monto máximo de crédito por caja (Etapa 6, T12; HU005, HU011)
--
-- El coordinador fija en Configuración cuánto presta la caja como máximo en un solo
-- crédito. Vacío (null) es sin límite, que es como estaban todas las cajas. La base lo
-- revisa en cada solicitud, igual que las demás reglas de la 005: así no se salta
-- hablando directo con Supabase. Bajar el máximo no toca los créditos ya solicitados.

alter table public.cajas add column if not exists monto_maximo_credito numeric(12, 2);

alter table public.cajas drop constraint if exists cajas_monto_maximo_credito_check;
alter table public.cajas add constraint cajas_monto_maximo_credito_check
  check (monto_maximo_credito is null or monto_maximo_credito > 0);

-- Lo cambia quien ya puede configurar la caja (política "coordinador configura la caja")
grant update (monto_maximo_credito) on public.cajas to authenticated;

-- Corre antes que validar_credito (orden alfabético); no dependen entre sí
create or replace function private.limitar_monto_credito() returns trigger
language plpgsql set search_path = '' as $$
declare
  maximo numeric(12, 2);
begin
  select monto_maximo_credito into maximo from public.cajas where id = new.caja_id;
  if maximo is not null and new.monto_solicitado > maximo then
    -- $1.500,00, como lo muestra el frontend
    raise exception 'El monto máximo de crédito de esta caja es $%',
      translate(to_char(maximo, 'FM999,999,990.00'), ',.', '.,') using errcode = 'DM400';
  end if;
  return new;
end;
$$;

drop trigger if exists limitar_monto_credito on public.creditos;
create trigger limitar_monto_credito before insert on public.creditos
  for each row execute function private.limitar_monto_credito();
