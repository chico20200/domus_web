/**
 * Validaciones de datos de personas en Ecuador (HU-O01). Devuelven el mensaje de error
 * o "" si el valor es válido, para ponerlo directo en el `error` del campo.
 */

/** Quita espacios y guiones: "170 111-2223" → "1701112223" */
export function soloDigitos(valor: string) {
  return valor.replace(/[\s-]/g, "")
}

/**
 * Cédula ecuatoriana: 10 dígitos, provincia 01–24 o 30 (registrados en el exterior),
 * tercer dígito menor que 6 (persona natural) y dígito verificador del módulo 10.
 */
export function validarCedula(valor: string): string {
  const c = soloDigitos(valor)
  if (!c) return "Escribe la cédula"
  if (!/^\d{10}$/.test(c)) return "La cédula tiene 10 dígitos"
  const provincia = Number(c.slice(0, 2))
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) {
    return "Los dos primeros dígitos no corresponden a una provincia"
  }
  if (Number(c[2]) >= 6) return "El tercer dígito de una cédula va de 0 a 5"
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let p = Number(c[i]) * (i % 2 === 0 ? 2 : 1)
    if (p > 9) p -= 9
    suma += p
  }
  const verificador = (10 - (suma % 10)) % 10
  return verificador === Number(c[9]) ? "" : "La cédula no es válida: revisa los dígitos"
}

/**
 * Teléfono opcional: celular de 10 dígitos (09…), fijo de 9 dígitos con código de
 * provincia (02…07), o el mismo número con +593 y sin el 0 inicial.
 */
export function validarTelefono(valor: string): string {
  const t = soloDigitos(valor)
  if (!t) return ""
  if (/^09\d{8}$/.test(t) || /^0[2-7]\d{7}$/.test(t)) return ""
  if (/^\+5939\d{8}$/.test(t) || /^\+593[2-7]\d{7}$/.test(t)) return ""
  return "Usa un celular de 10 dígitos (09…) o un fijo de 9 con el código de provincia"
}

/** Correo opcional, con la forma básica nombre@dominio.algo */
export function validarCorreo(valor: string): string {
  const e = valor.trim()
  if (!e) return ""
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? "" : "Revisa el correo: falta la @ o el dominio"
}

/**
 * Nombre completo del perfil (HU016): al menos 6 caracteres y solo letras, con espacios,
 * tildes, ñ, apóstrofo y guion ("María José", "O'Neil", "Ruiz-Tagle").
 */
export function validarNombrePerfil(valor: string): string {
  const n = valor.trim().replace(/\s+/g, " ")
  if (!n) return "Escribe tu nombre"
  if (!/^[\p{L}][\p{L}' -]*$/u.test(n)) return "Usa solo letras y espacios"
  if (n.length < 6) return "Escribe al menos 6 caracteres"
  return ""
}

/** Teléfono del perfil (HU016): opcional, y si se escribe, exactamente 10 dígitos */
export function validarTelefonoPerfil(valor: string): string {
  const t = soloDigitos(valor)
  if (!t) return ""
  return /^\d{10}$/.test(t) ? "" : "El teléfono tiene exactamente 10 dígitos"
}

/**
 * Política de contraseña (HU-A01): al menos 8 caracteres, con letras y números. La misma
 * regla valida el backend (backend/utils/contrasena.js) al registrar y al restablecer.
 */
export const REQUISITOS_CONTRASENA: { texto: string; cumple: (p: string) => boolean }[] = [
  { texto: "Al menos 8 caracteres", cumple: (p) => p.length >= 8 },
  { texto: "Una letra", cumple: (p) => /\p{L}/u.test(p) },
  { texto: "Un número", cumple: (p) => /\d/.test(p) },
]

export function validarContrasena(valor: string): string {
  if (!valor) return "Escribe una contraseña"
  if (valor.length < 8) return "Usa al menos 8 caracteres"
  if (!REQUISITOS_CONTRASENA.every((r) => r.cumple(valor))) {
    return "Combina letras y números"
  }
  return ""
}

export type FuerzaContrasena = "vacia" | "debil" | "aceptable" | "fuerte"

/**
 * Qué tan difícil de adivinar es la contraseña, para el indicador. Débil: no cumple la
 * política. Aceptable: la cumple. Fuerte: además tiene 12 caracteres o más y mezcla
 * mayúsculas con minúsculas o lleva algún símbolo.
 */
export function fuerzaContrasena(valor: string): FuerzaContrasena {
  if (!valor) return "vacia"
  if (validarContrasena(valor)) return "debil"
  const mezcla = /\p{Lu}/u.test(valor) && /\p{Ll}/u.test(valor)
  const simbolo = /[^\p{L}\d]/u.test(valor)
  return valor.length >= 12 && (mezcla || simbolo) ? "fuerte" : "aceptable"
}
