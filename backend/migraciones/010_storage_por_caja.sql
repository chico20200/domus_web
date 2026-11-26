-- 010: fotos en Supabase Storage, privadas y separadas por caja (Etapa 6, T15)
--
-- Tres buckets privados: nada se descarga con un enlace público. El backend pide con el
-- token de la persona un enlace firmado que dura poco, y las políticas de abajo deciden
-- si puede. Así las fotos tienen el mismo aislamiento entre cajas que los datos (004).
--
--   comprobantes  {caja_id}/{socio_id}/{archivo}  foto del comprobante de un depósito,
--                 retiro o pago (T16). La ve el tesorero de la caja y el socio dueño de la
--                 ficha; la sube el tesorero en una caja activa. No se cambia ni se borra:
--                 es respaldo de un movimiento.
--   cajas         {caja_id}/{archivo}             foto de la caja (T17). La ven sus
--                 miembros; la cambia el coordinador.
--   perfiles      {user_id}/{archivo}             foto de perfil (T17). La ve la cuenta y
--                 quien comparte una caja con ella; la cambia solo la cuenta.
--
-- Solo imágenes (el frontend las reduce antes de subirlas). La primera carpeta de la
-- ruta dice de quién es el archivo; una ruta que no empieza con un uuid no pasa ninguna
-- política.

-- ─── Buckets ──────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('cajas', 'cajas', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('perfiles', 'perfiles', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── Carpeta de la ruta como uuid ─────────────────────────────────────────────────────
-- La n-ésima carpeta de la ruta, o null si no es un uuid (así un nombre raro no rompe la
-- política con un error de conversión: simplemente no da acceso)
create or replace function private.carpeta_uuid(p_nombre text, p_n int)
returns uuid language sql immutable set search_path = '' as $$
  select case when f ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then f::uuid end
  from (select (storage.foldername(p_nombre))[p_n] as f) x
$$;

grant execute on function private.carpeta_uuid(text, int) to authenticated;

-- El socio de la carpeta es de esa caja (un tesorero no sube a nombre de una ficha ajena)
create or replace function private.socio_de_caja(p_socio uuid, p_caja uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.socios where id = p_socio and caja_id = p_caja)
$$;

grant execute on function private.socio_de_caja(uuid, uuid) to authenticated;

-- ─── Políticas ────────────────────────────────────────────────────────────────────────
drop policy if exists "comprobantes: ver" on storage.objects;
create policy "comprobantes: ver" on storage.objects for select to authenticated using (
  bucket_id = 'comprobantes' and (
    private.tiene_rol(private.carpeta_uuid(name, 1), 'tesorero')
    or private.es_mi_ficha(private.carpeta_uuid(name, 2))
  )
);

drop policy if exists "comprobantes: subir" on storage.objects;
create policy "comprobantes: subir" on storage.objects for insert to authenticated with check (
  bucket_id = 'comprobantes'
  and private.tiene_rol(private.carpeta_uuid(name, 1), 'tesorero')
  and private.caja_operable(private.carpeta_uuid(name, 1))
  and private.socio_de_caja(private.carpeta_uuid(name, 2), private.carpeta_uuid(name, 1))
);

drop policy if exists "cajas: ver" on storage.objects;
create policy "cajas: ver" on storage.objects for select to authenticated using (
  bucket_id = 'cajas' and private.tiene_rol(private.carpeta_uuid(name, 1), 'socio')
);

drop policy if exists "cajas: subir" on storage.objects;
create policy "cajas: subir" on storage.objects for insert to authenticated with check (
  bucket_id = 'cajas'
  and private.tiene_rol(private.carpeta_uuid(name, 1), 'coordinador')
  and private.caja_operable(private.carpeta_uuid(name, 1))
);

drop policy if exists "cajas: cambiar" on storage.objects;
create policy "cajas: cambiar" on storage.objects for update to authenticated using (
  bucket_id = 'cajas' and private.tiene_rol(private.carpeta_uuid(name, 1), 'coordinador')
) with check (
  bucket_id = 'cajas'
  and private.tiene_rol(private.carpeta_uuid(name, 1), 'coordinador')
  and private.caja_operable(private.carpeta_uuid(name, 1))
);

drop policy if exists "cajas: quitar" on storage.objects;
create policy "cajas: quitar" on storage.objects for delete to authenticated using (
  bucket_id = 'cajas' and private.tiene_rol(private.carpeta_uuid(name, 1), 'coordinador')
);

drop policy if exists "perfiles: ver" on storage.objects;
create policy "perfiles: ver" on storage.objects for select to authenticated using (
  bucket_id = 'perfiles' and (
    private.carpeta_uuid(name, 1) = auth.uid()
    or private.comparte_caja(private.carpeta_uuid(name, 1))
  )
);

drop policy if exists "perfiles: subir" on storage.objects;
create policy "perfiles: subir" on storage.objects for insert to authenticated with check (
  bucket_id = 'perfiles' and private.carpeta_uuid(name, 1) = auth.uid()
);

drop policy if exists "perfiles: cambiar" on storage.objects;
create policy "perfiles: cambiar" on storage.objects for update to authenticated using (
  bucket_id = 'perfiles' and private.carpeta_uuid(name, 1) = auth.uid()
) with check (
  bucket_id = 'perfiles' and private.carpeta_uuid(name, 1) = auth.uid()
);

drop policy if exists "perfiles: quitar" on storage.objects;
create policy "perfiles: quitar" on storage.objects for delete to authenticated using (
  bucket_id = 'perfiles' and private.carpeta_uuid(name, 1) = auth.uid()
);
