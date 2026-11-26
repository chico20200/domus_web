-- 012: foto de perfil y foto de la caja (Etapa 6, T17)
--
-- Las fotos viven en Storage (buckets perfiles y cajas, migración 010); la tabla guarda
-- la ruta, no una dirección: los buckets son privados y el backend da un enlace firmado.
-- Antes profiles.foto_url pedía una dirección https (005); ninguna cuenta la usaba.
--
-- La ruta no se escribe con un UPDATE directo: la ponen poner_foto_perfil y
-- poner_foto_caja, que revisan que la foto esté en la carpeta de esa cuenta o caja y
-- que exista. Así nadie apunta su perfil a la foto de otro.

alter table public.profiles rename column foto_url to foto;
revoke update (foto) on public.profiles from authenticated;

alter table public.cajas add column if not exists foto text;

-- El perfil nuevo nace sin foto (antes se guardaba '' en foto_url). Los perfiles que ya
-- tenían '' quedan en null: "sin foto" es uno solo.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nombre, telefono)
  values (new.id, '', '')
  on conflict (id) do nothing;
  return new;
end;
$$;
alter table public.profiles alter column foto drop default;
update public.profiles set foto = null where foto = '';

-- La validación del perfil ya no mira la foto (la revisa poner_foto_perfil)
create or replace function private.validar_perfil() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.nombre is distinct from old.nombre then
    new.nombre := regexp_replace(btrim(coalesce(new.nombre, '')), '[[:space:]]+', ' ', 'g');
    if new.nombre = '' then
      raise exception 'Escribe tu nombre' using errcode = 'DM400';
    end if;
    if new.nombre !~ '^[[:alpha:]][[:alpha:]'' -]*$' then
      raise exception 'Usa solo letras y espacios' using errcode = 'DM400';
    end if;
    if length(new.nombre) < 6 then
      raise exception 'Escribe al menos 6 caracteres' using errcode = 'DM400';
    end if;
  end if;
  if new.telefono is distinct from old.telefono then
    new.telefono := private.solo_digitos(new.telefono);
    if new.telefono !~ '^([0-9]{10})?$' then
      raise exception 'El teléfono tiene exactamente 10 dígitos' using errcode = 'DM400';
    end if;
  end if;
  return new;
end;
$$;

-- p_ruta null quita la foto. Devuelve la ruta anterior, para que el backend la borre.
create or replace function public.poner_foto_perfil(p_ruta text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_anterior text;
begin
  if v_uid is null then
    raise exception 'Inicia sesión' using errcode = 'DM403';
  end if;
  if p_ruta is not null then
    if p_ruta not like v_uid || '/%' then
      raise exception 'La foto no corresponde a tu cuenta' using errcode = 'DM400';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'perfiles' and name = p_ruta) then
      raise exception 'La foto no se encuentra' using errcode = 'DM400';
    end if;
  end if;
  select foto into v_anterior from public.profiles where id = v_uid for update;
  update public.profiles set foto = p_ruta, updated_at = now() where id = v_uid;
  return json_build_object('foto', p_ruta, 'anterior', v_anterior);
end;
$$;

create or replace function public.poner_foto_caja(p_caja uuid, p_ruta text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_anterior text;
begin
  if not private.tiene_rol(p_caja, 'coordinador') then
    raise exception 'Caja no encontrada' using errcode = 'DM404';
  end if;
  if not private.caja_operable(p_caja) then
    raise exception 'La caja no admite registros nuevos' using errcode = 'DM409';
  end if;
  if p_ruta is not null then
    if p_ruta not like p_caja || '/%' then
      raise exception 'La foto no corresponde a esta caja' using errcode = 'DM400';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'cajas' and name = p_ruta) then
      raise exception 'La foto no se encuentra' using errcode = 'DM400';
    end if;
  end if;
  select foto into v_anterior from public.cajas where id = p_caja for update;
  update public.cajas set foto = p_ruta, updated_at = now() where id = p_caja;
  return json_build_object('foto', p_ruta, 'anterior', v_anterior);
end;
$$;

revoke execute on function public.poner_foto_perfil(text) from public, anon;
revoke execute on function public.poner_foto_caja(uuid, text) from public, anon;
grant execute on function public.poner_foto_perfil(text) to authenticated;
grant execute on function public.poner_foto_caja(uuid, text) to authenticated;
