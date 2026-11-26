/**
 * Traduce un error de Supabase a la respuesta HTTP.
 *
 * Las funciones de la migración 004 lanzan SQLSTATE 'DM' + el código HTTP (DM400, DM403,
 * DM404, DM409) con un mensaje ya escrito para la persona; la 005 hace lo mismo en los
 * triggers que validan los datos. 42501 es una escritura que el RLS o los permisos por
 * columna rechazaron. 23505 es un dato repetido. Cualquier otro error es del servidor.
 */
function estadoHttp(error) {
  const codigo = error?.code ?? ""
  const propio = /^DM(\d{3})$/.exec(codigo)
  if (propio) return Number(propio[1])
  if (codigo === "42501") return 403
  // Una clave única repetida (por ejemplo, la cédula en la caja)
  if (codigo === "23505") return 409
  // .single() sin filas: no existe o el RLS no la deja ver (otra caja), que se responde igual
  if (codigo === "PGRST116") return 404
  return 500
}

function responderError(res, error) {
  const estado = estadoHttp(error)
  const mensaje =
    estado === 403 && error?.code === "42501"
      ? "Tu rol no permite esta acción en esta caja"
      : estado === 404 && error?.code === "PGRST116"
        ? "No encontrado"
        : error?.code === "23505"
          ? "Ya existe un registro con esos datos en esta caja"
          : (error?.message ?? "Error del servidor")
  return res.status(estado).json({ error: mensaje })
}

module.exports = { estadoHttp, responderError }
