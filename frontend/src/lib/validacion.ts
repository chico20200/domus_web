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
