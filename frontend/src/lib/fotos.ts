import { useCallback, useEffect, useSyncExternalStore } from "react"
import { profileService } from "../api/profile.service"
import { cajasService } from "../api/cajas.service"

/**
 * La foto de perfil y la de la caja (T17) se ven en varios sitios a la vez: la barra
 * superior, la barra lateral, Perfil y Configuración. Este almacén las guarda una vez por
 * cuenta y por caja, así al cambiarla en una página cambia en todas sin recargar.
 *
 * Los enlaces son firmados y duran una hora: si una imagen deja de cargar, `refrescar`
 * pide uno nuevo.
 */

export interface DatosMiPerfil {
  nombre: string
  foto_url: string | null
}

function crearAlmacen<T>(cargar: (clave: string) => Promise<T>) {
  const valores = new Map<string, T>()
  const pidiendo = new Set<string>()
  const oyentes = new Set<() => void>()
  const avisar = () => oyentes.forEach((f) => f())
  const suscribir = (f: () => void) => {
    oyentes.add(f)
    return () => oyentes.delete(f)
  }

  function pedir(clave: string) {
    if (pidiendo.has(clave)) return
    pidiendo.add(clave)
    cargar(clave)
      .then((v) => valores.set(clave, v))
      // Sin foto si no se pudo leer: la inicial o el ícono de siempre
      .catch(() => {})
      .finally(() => {
        pidiendo.delete(clave)
        avisar()
      })
  }

  function useValor(clave: string | null) {
    const valor = useSyncExternalStore(suscribir, () => (clave ? valores.get(clave) : undefined))
    useEffect(() => {
      if (clave && !valores.has(clave)) pedir(clave)
    }, [clave])
    const refrescar = useCallback(() => {
      if (clave) pedir(clave)
    }, [clave])
    return { valor, refrescar }
  }

  function poner(clave: string, valor: T) {
    valores.set(clave, valor)
    avisar()
  }

  return { useValor, poner }
}

const perfiles = crearAlmacen<DatosMiPerfil>(async () => {
  const { profile } = await profileService.getMe()
  return { nombre: profile.nombre, foto_url: profile.foto_url }
})

const cajas = crearAlmacen<string | null>(async (cajaId) => {
  const { foto_url } = await cajasService.getFoto(cajaId)
  return foto_url
})

/** Nombre y foto de la cuenta con sesión (la clave es su id) */
export function useMiPerfil(userId: string | null) {
  const { valor, refrescar } = perfiles.useValor(userId)
  return { perfil: valor ?? null, refrescar }
}

/** Avisa a toda la app del nombre o la foto nuevos de la cuenta */
export function publicarMiPerfil(userId: string, datos: DatosMiPerfil) {
  perfiles.poner(userId, datos)
}

/** Foto de una caja; undefined mientras carga */
export function useFotoCaja(cajaId: string | null) {
  const { valor, refrescar } = cajas.useValor(cajaId)
  return { fotoUrl: valor ?? null, refrescar }
}

export function publicarFotoCaja(cajaId: string, fotoUrl: string | null) {
  cajas.poner(cajaId, fotoUrl)
}
