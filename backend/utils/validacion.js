/**
 * Validaciones del backend que la base no puede hacer (Etapa 6, T8).
 *
 * Las reglas de los datos (cédula, teléfono, correo, perfil, límites del crédito) están en
 * la base, migración 005, y responden DM400 con su mensaje. Aquí queda lo que se pierde
 * antes de llegar a la base: una columna numeric(12,2) redondea 100,555 a 100,56 sin
 * avisar, y una columna integer rechaza "4.7" con un error del servidor.
 */

/** Monto con hasta dos decimales y mayor que 0; devuelve el mensaje de error o "" */
function errorMonto(valor, nombre = "El monto") {
  const n = Number(valor)
  if (valor === "" || valor === null || valor === undefined || !Number.isFinite(n) || n <= 0) {
    return `${nombre} debe ser mayor a 0`
  }
  if (Math.round(n * 100) / 100 !== n) return `${nombre} admite hasta dos decimales`
  return ""
}

/** Número entero dentro de un rango; devuelve el mensaje de error o "" */
function errorEntero(valor, min, max, mensaje) {
  const n = Number(valor)
  return Number.isInteger(n) && n >= min && n <= max ? "" : mensaje
}

/** "170 111-2223" → "1701112223", la misma limpieza que hace la base */
function soloDigitos(valor) {
  return String(valor ?? "").replace(/[\s-]/g, "")
}

module.exports = { errorMonto, errorEntero, soloDigitos }
