-- 015: fecha propia en los movimientos de ahorro (T21, bloque F)
--
-- Hasta ahora un depósito o retiro solo tenía created_at, la hora en que se registró, y
-- Reportes lo ubicaba en su mes con esa hora. Para importar movimientos de meses pasados
-- hace falta una fecha aparte: la del día del movimiento.
--
--   - transacciones.fecha: date, obligatoria. Por defecto, hoy en Guayaquil (lo que ya
--     hacía registrar_movimiento, que no cambia). Las filas existentes copian el día de
--     su created_at en Guayaquil.
--   - Nadie la escribe a mano: el permiso de escribir transacciones ya estaba quitado
--     (005). Solo la pondrá la importación (T22).
--   - Índice por cuenta y fecha: el detalle de la cuenta y la importación las leen así.

alter table public.transacciones add column if not exists fecha date;

update public.transacciones
set fecha = (created_at at time zone 'America/Guayaquil')::date
where fecha is null;

alter table public.transacciones
  alter column fecha set default ((now() at time zone 'America/Guayaquil')::date),
  alter column fecha set not null;

create index if not exists transacciones_cuenta_fecha_idx
  on public.transacciones (cuenta_id, fecha, created_at);
