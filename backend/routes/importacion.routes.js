// backend/routes/importacion.routes.js
//
// Importación desde Excel (Etapa 6, T22; migración 016). El frontend lee y revisa el
// archivo (T21) y manda aquí las filas ya convertidas. La base las revisa otra vez y las
// guarda todas o ninguna con importar_excel. Con { simular: true } hace lo mismo y lo
// deshace: es la vista previa, con los saldos y números que quedarían de verdad.
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { responderError } = require("../utils/errores")

router.use(verifyToken)

// El mismo permiso que pide registrar cada cosa a mano
const PERMISO = {
  socios: "socios.gestionar",
  ahorros: "movimientos.registrar",
  creditos: "movimientos.registrar",
  fondos: "fondos.gestionar",
}

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/importar/:modulo   { filas: [...], simular?: boolean }
// ─────────────────────────────────────────────
router.post(
  "/:modulo",
  (req, res, next) => {
    const permiso = PERMISO[req.params.modulo]
    if (!permiso) return res.status(404).json({ error: "No se importa ese módulo" })
    return requierePermiso(permiso)(req, res, next)
  },
  async (req, res) => {
    const { filas, simular } = req.body ?? {}
    if (!Array.isArray(filas) || filas.length === 0) {
      return res.status(400).json({ error: "El archivo no tiene filas para importar" })
    }
    const { data, error } = await req.db.rpc("importar_excel", {
      p_caja: req.params.cajaId,
      p_modulo: req.params.modulo,
      p_filas: filas,
      p_simular: simular === true,
    })
    if (error) return responderError(res, error)
    return res.status(data.simulado ? 200 : 201).json(data)
  },
)

module.exports = router
