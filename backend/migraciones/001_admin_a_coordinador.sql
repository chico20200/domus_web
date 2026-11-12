-- 001: el rol "admin" de una caja pasa a llamarse "coordinador" (especificaciones §9.1)
--
-- Esquema revisado el 11 nov 2026: "rol" es el enum public.rol_caja (admin, tesorero, socio),
-- usado por miembros_caja.rol e invitaciones_caja.rol. Ninguna política, función, trigger ni
-- vista menciona sus valores, así que basta con renombrar el valor: las filas existentes
-- cambian solas y el orden del enum se conserva.
--
-- CUÁNDO EJECUTARLO: en el mismo momento en que se despliega el backend de la rama etapa-2.
--   - El backend viejo inserta 'admin' al crear una caja: con el enum renombrado, crear cajas falla.
--   - El backend nuevo solo reconoce 'coordinador': antes de la migración, los coordinadores
--     actuales quedan sin permisos de coordinador.
-- Después, cada usuario debe volver a elegir su caja (el frontend también traduce el valor
-- viejo que haya quedado guardado en el navegador).
--
-- Se ejecuta en el editor SQL de Supabase.

alter type public.rol_caja rename value 'admin' to 'coordinador';

-- Comprobación: debe listar coordinador, tesorero, socio
select enumlabel from pg_enum where enumtypid = 'public.rol_caja'::regtype order by enumsortorder;

-- Para deshacerlo:
-- alter type public.rol_caja rename value 'coordinador' to 'admin';
