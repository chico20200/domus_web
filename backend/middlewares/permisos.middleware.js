// backend/middlewares/permisos.middleware.js
const supabaseAdmin = require("../config/supabaseAdmin")

// Escalera de roles dentro de una caja. Cada rol puede todo lo que pueden los de
// abajo, y no al revés (especificaciones §6.2).
const NIVEL = { socio: 1, tesorero: 2, coordinador: 3 }

// Tabla única de permisos: el rol mínimo que pide cada acción.
// Es la única fuente de verdad; las rutas solo nombran el permiso.
const PERMISOS = {
  // Entrar a la caja: el periodo y lo propio del socio (sus cuentas, con /cuentas/mias)
  "caja.ver": "socio",
  // Consultar los datos de todos: resumen, miembros, fichas, cuentas, créditos y pagos.
  // El socio no ve los datos de los demás socios (HU022, "lo que no sale de la caja")
  "datos.ver": "tesorero",

  // Registrar socios y editar sus datos
  "socios.gestionar": "tesorero",
  // Registrar ahorros, créditos y pagos: abrir cuentas, depósitos, retiros,
  // solicitudes de crédito, pagos de cuota, prepagos y abonos
  "movimientos.registrar": "tesorero",
  "creditos.aprobar": "tesorero",
  // Generar la distribución de intereses y el estado de la caja
  "reportes.generar": "tesorero",

  // Configurar la caja: nombre, descripción y ciclos
  "caja.configurar": "coordinador",
  // Cambiar roles, quitar miembros e invitar
  "miembros.gestionar": "coordinador",
  "socios.eliminar": "coordinador",
  "cuentas.cambiar_estado": "coordinador",
  "creditos.cambiar_estado": "coordinador",
}

/**
 * Middleware de ruta: deja pasar solo a los miembros activos de la caja
 * (req.params.cajaId) cuyo rol alcance el permiso. Deja el rol en req.rol.
 *
 *   router.post("/", requierePermiso("movimientos.registrar"), async (req, res) => { … })
 */
function requierePermiso(permiso) {
  const rolMinimo = PERMISOS[permiso]
  // Falla al arrancar el servidor, no en la primera petición
  if (!rolMinimo) throw new Error(`Permiso desconocido: ${permiso}`)

  return async (req, res, next) => {
    const { data: miembro, error } = await supabaseAdmin
      .from("miembros_caja")
      .select("rol")
      .eq("caja_id", req.params.cajaId)
      .eq("user_id", req.user.id)
      .eq("activo", true)
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    if (!miembro) return res.status(403).json({ error: "Sin acceso a esta caja" })

    // Escrito así para que un rol que no está en NIVEL quede fuera
    // (undefined >= n es false) en vez de pasar
    if (!(NIVEL[miembro.rol] >= NIVEL[rolMinimo])) {
      return res.status(403).json({ error: "Tu rol no permite esta acción" })
    }

    req.rol = miembro.rol
    next()
  }
}

module.exports = { requierePermiso, PERMISOS, NIVEL }
