// backend/routes/fondos.routes.js
//
// Fondos de caja (Etapa 6, T18; migración 014): dinero de la organización aparte del que
// se presta. Cada fondo tiene nombre, saldo, depósitos y retiros. No toca a los socios ni
// a los intereses, y no cuenta en el disponible para prestar. Los saldos y movimientos
// solo cambian con las funciones de la base, que comprueban el rol y la caja.
const express = require("express")
const router = express.Router({ mergeParams: true })
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { responderError } = require("../utils/errores")
const { errorMonto } = require("../utils/validacion")

router.use(verifyToken)

const texto = (v) => (typeof v === "string" ? v.trim() : "")

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/fondos
// Los fondos de la caja (abiertos primero) y el total (un fondo cerrado está en 0)
// ─────────────────────────────────────────────
router.get("/", requierePermiso("datos.ver"), async (req, res) => {
  const { data, error } = await req.db
    .from("fondos_caja")
    .select("id, nombre, descripcion, saldo, activo, created_at")
    .eq("caja_id", req.params.cajaId)
    .order("activo", { ascending: false })
    .order("nombre", { ascending: true })
  if (error) return responderError(res, error)

  const fondos = (data ?? []).map((f) => ({ ...f, saldo: Number(f.saldo) }))
  const centavos = fondos.reduce((s, f) => s + Math.round(f.saldo * 100), 0)
  return res.json({ fondos, total: centavos / 100 })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/fondos   { nombre, descripcion? }
// ─────────────────────────────────────────────
router.post("/", requierePermiso("fondos.gestionar"), async (req, res) => {
  const { data, error } = await req.db.rpc("crear_fondo", {
    p_caja: req.params.cajaId,
    p_nombre: texto(req.body?.nombre),
    p_descripcion: texto(req.body?.descripcion),
  })
  if (error) return responderError(res, error)
  return res
    .status(201)
    .json({ message: "Fondo creado", fondo: { ...data, saldo: Number(data.saldo) } })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/fondos/:fondoId   { nombre, descripcion? }
// ─────────────────────────────────────────────
router.put("/:fondoId", requierePermiso("fondos.gestionar"), async (req, res) => {
  const { data, error } = await req.db.rpc("editar_fondo", {
    p_caja: req.params.cajaId,
    p_fondo: req.params.fondoId,
    p_nombre: texto(req.body?.nombre),
    p_descripcion: texto(req.body?.descripcion),
  })
  if (error) return responderError(res, error)
  return res.json({ message: "Fondo actualizado", fondo: { ...data, saldo: Number(data.saldo) } })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/fondos/:fondoId/estado   { activo }
// Cerrar pide saldo 0; un fondo cerrado se puede volver a abrir
// ─────────────────────────────────────────────
router.put("/:fondoId/estado", requierePermiso("fondos.gestionar"), async (req, res) => {
  const { activo } = req.body ?? {}
  if (typeof activo !== "boolean") return res.status(400).json({ error: "Estado inválido" })
  const { data, error } = await req.db.rpc("cambiar_estado_fondo", {
    p_caja: req.params.cajaId,
    p_fondo: req.params.fondoId,
    p_activo: activo,
  })
  if (error) return responderError(res, error)
  return res.json({
    message: activo ? "Fondo abierto" : "Fondo cerrado",
    fondo: { ...data, saldo: Number(data.saldo) },
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/fondos/:fondoId/movimientos
// El fondo y sus movimientos, el más reciente primero
// ─────────────────────────────────────────────
router.get("/:fondoId/movimientos", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId, fondoId } = req.params
  const { data: fondo, error: errorFondo } = await req.db
    .from("fondos_caja")
    .select("id, nombre, descripcion, saldo, activo, created_at")
    .eq("id", fondoId)
    .eq("caja_id", cajaId)
    .maybeSingle()
  if (errorFondo) return responderError(res, errorFondo)
  if (!fondo) return res.status(404).json({ error: "Fondo no encontrado" })

  const { data, error } = await req.db
    .from("movimientos_fondo")
    .select("id, tipo, monto, saldo_anterior, saldo_posterior, descripcion, fecha, created_at")
    .eq("fondo_id", fondoId)
    .eq("caja_id", cajaId)
    .order("created_at", { ascending: false })
  if (error) return responderError(res, error)

  return res.json({
    fondo: { ...fondo, saldo: Number(fondo.saldo) },
    movimientos: (data ?? []).map((m) => ({
      ...m,
      monto: Number(m.monto),
      saldo_anterior: Number(m.saldo_anterior),
      saldo_posterior: Number(m.saldo_posterior),
    })),
  })
})

// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/fondos/:fondoId/deposito   { monto, descripcion }
// POST /api/cajas/:cajaId/fondos/:fondoId/retiro     { monto, descripcion }
// ─────────────────────────────────────────────
function registrar(tipo) {
  const exito = tipo === "deposito" ? "Depósito registrado" : "Retiro registrado"
  return async (req, res) => {
    const problema = errorMonto(req.body?.monto)
    if (problema) return res.status(400).json({ error: problema })

    const { data, error } = await req.db.rpc("registrar_movimiento_fondo", {
      p_caja: req.params.cajaId,
      p_fondo: req.params.fondoId,
      p_tipo: tipo,
      p_monto: Number(req.body.monto),
      p_descripcion: texto(req.body?.descripcion),
    })
    if (error) return responderError(res, error)

    return res.status(201).json({
      message: exito,
      movimiento: data.movimiento,
      saldo_anterior: Number(data.saldo_anterior),
      saldo_posterior: Number(data.saldo_posterior),
    })
  }
}

router.post("/:fondoId/deposito", requierePermiso("movimientos.registrar"), registrar("deposito"))
router.post("/:fondoId/retiro", requierePermiso("movimientos.registrar"), registrar("retiro"))

module.exports = router
