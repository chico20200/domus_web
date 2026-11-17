// backend/middlewares/adminSistema.middleware.js
const { esAdminSistema } = require("../utils/cuentaSistema")

/**
 * Deja pasar solo a quien administra DOMUS (tabla administradores_sistema, HU019).
 * Va después de verifyToken. No tiene que ver con los roles de una caja: el coordinador
 * de una caja no es administrador del sistema, y el administrador no entra a las cajas.
 *
 *   router.use(verifyToken, requiereAdminSistema)
 */
async function requiereAdminSistema(req, res, next) {
  try {
    if (!(await esAdminSistema(req.user.id))) {
      return res.status(403).json({ error: "Solo la administración de DOMUS puede hacer esto" })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  next()
}

module.exports = requiereAdminSistema
