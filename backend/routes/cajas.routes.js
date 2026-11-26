// backend/routes/cajas.routes.js
const express = require("express")
const router = express.Router()
const { POLITICAS_VERSION } = require("../utils/politicas")
const { responderError } = require("../utils/errores")
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { calcularCiclos, validarConfigCiclo } = require("../utils/ciclos")
const { EN_CURSO, agregarMora } = require("../utils/mora")
const { errorMonto } = require("../utils/validacion")

// Largos máximos de los datos de una caja (los mismos que el formulario)
const LARGO_NOMBRE = 80
const LARGO_DESCRIPCION = 300

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/mis-cajas
// Devuelve todas las cajas del usuario autenticado con su rol, y si aceptó la versión
// vigente de sus políticas de uso (HU-S04): sin ella el frontend las pide antes de entrar
// ─────────────────────────────────────────────
router.get("/mis-cajas", async (req, res) => {
  const userId = req.user.id

  const { data, error } = await req.db
    .from("miembros_caja")
    .select(
      `
      rol,
      cajas (
        id,
        nombre,
        descripcion,
        activa,
        estado,
        estado_motivo
      )
    `,
    )
    .eq("user_id", userId)
    .eq("activo", true)

  if (error) {
    return responderError(res, error)
  }

  const { data: aceptaciones, error: errorAceptaciones } = await req.db
    .from("aceptaciones_politicas")
    .select("caja_id")
    .eq("user_id", userId)
    .eq("version", POLITICAS_VERSION)
  if (errorAceptaciones) {
    return responderError(res, errorAceptaciones)
  }
  const aceptadas = new Set((aceptaciones ?? []).map((a) => a.caja_id))

  // Transforma el resultado para aplanar la estructura
  const cajas = data
    // Las bloqueadas por el administrador se listan con su motivo: sus miembros siguen
    // viendo sus datos (T10). Las eliminadas quedan para la Etapa 7.
    .filter((m) => m.cajas && m.cajas.activa && m.cajas.estado !== "eliminada")
    .map((m) => ({
      id: m.cajas.id,
      nombre: m.cajas.nombre,
      descripcion: m.cajas.descripcion ?? "",
      rol: m.rol,
      politicas_aceptadas: aceptadas.has(m.cajas.id),
      estado: m.cajas.estado ?? "activa",
      estado_motivo: m.cajas.estado_motivo ?? null,
    }))

  // Cuántas cajas creó y el máximo (T9), para avisar antes del asistente. Si falla, la
  // lista se entrega igual: crear_caja vuelve a comprobar el límite al crear.
  const { data: creacion } = await req.db.rpc("cajas_creadas")

  return res.json({ cajas, creacion: creacion ?? null })
})

// ─────────────────────────────────────────────
// POST /api/cajas
// Crea una caja con su periodo, registra al creador como coordinador y guarda su
// aceptación de las políticas de uso (asistente de §5.1, HU004 y HU022).
// Cuerpo: nombre, descripcion, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo,
// politicas_version (la versión que se le mostró y aceptó).
// ─────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { nombre, descripcion, politicas_version } = req.body

  const nombreLimpio = typeof nombre === "string" ? nombre.trim().replace(/\s+/g, " ") : ""
  const descripcionLimpia = typeof descripcion === "string" ? descripcion.trim() : ""
  if (!nombreLimpio) {
    return res.status(400).json({ error: "El nombre de la caja es requerido", campo: "nombre" })
  }
  if (nombreLimpio.length > LARGO_NOMBRE) {
    return res
      .status(400)
      .json({ error: `El nombre admite hasta ${LARGO_NOMBRE} caracteres`, campo: "nombre" })
  }
  if (!descripcionLimpia) {
    return res
      .status(400)
      .json({ error: "La descripción de la caja es requerida", campo: "descripcion" })
  }
  if (descripcionLimpia.length > LARGO_DESCRIPCION) {
    return res.status(400).json({
      error: `La descripción admite hasta ${LARGO_DESCRIPCION} caracteres`,
      campo: "descripcion",
    })
  }
  const { error: errorCiclo, config } = validarConfigCiclo(req.body)
  if (errorCiclo) return res.status(400).json({ error: errorCiclo })
  if (politicas_version !== POLITICAS_VERSION) {
    return res.status(400).json({
      error: "Hay que aceptar la versión vigente de las políticas de uso",
      politicas_version: POLITICAS_VERSION,
    })
  }

  // Caja, coordinador y aceptación de políticas en una sola operación (crear_caja,
  // migración 004). Ahí también se cumple el límite de tres cajas creadas por cuenta.
  const { data: caja, error: errorCaja } = await req.db.rpc("crear_caja", {
    p_nombre: nombreLimpio,
    p_descripcion: descripcionLimpia,
    p_fecha_fundacion: config.fecha_fundacion,
    p_mes_inicio: config.mes_inicio_ciclo,
    p_duracion: config.duracion_ciclo,
    p_politicas_version: POLITICAS_VERSION,
  })
  if (errorCaja) return responderError(res, errorCaja)

  const { cicloActual } = calcularCiclos(
    caja.fecha_fundacion,
    caja.mes_inicio_ciclo,
    caja.duracion_ciclo,
  )

  return res.status(201).json({
    message: "Caja creada correctamente",
    caja: { ...caja, rol: "coordinador" },
    ciclo_actual: cicloActual,
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/resumen
// Datos de la caja, totales y movimientos recientes — solo miembros
// ─────────────────────────────────────────────
router.get("/:cajaId/resumen", requierePermiso("datos.ver"), async (req, res) => {
  const { cajaId } = req.params

  try {
    const { data: caja, error: errorCaja } = await req.db
      .from("cajas")
      .select("id, nombre, descripcion, created_at")
      .eq("id", cajaId)
      .single()

    const { count: totalMiembros, error: errorMiembros } = await req.db
      .from("miembros_caja")
      .select("*", { count: "exact", head: true })
      .eq("caja_id", cajaId)
      .eq("activo", true)

    const { count: totalSocios, error: errorSocios } = await req.db
      .from("socios")
      .select("*", { count: "exact", head: true })
      .eq("caja_id", cajaId)
      .eq("activo", true)

    const { data: cuentas, error: errorCuentas } = await req.db
      .from("cuentas_ahorro")
      .select("saldo")
      .eq("caja_id", cajaId)
      .eq("estado", "activa")

    const { data: creditos, error: errorCreditos } = await req.db
      .from("creditos")
      .select(
        "id, estado, monto_solicitado, tasa_interes, plazo_meses, fecha_desembolso, saldo_pendiente",
      )
      .eq("caja_id", cajaId)
      .in("estado", EN_CURSO)

    const { data: transacciones, error: errorTx } = await req.db
      .from("transacciones")
      .select(
        `
        id,
        tipo,
        monto,
        descripcion,
        created_at,
        cuentas_ahorro (
          socios ( nombre, apellido )
        )
      `,
      )
      .eq("caja_id", cajaId)
      .order("created_at", { ascending: false })
      .limit(5)

    const errorConsulta =
      errorCaja || errorMiembros || errorSocios || errorCuentas || errorCreditos || errorTx
    if (errorConsulta) throw errorConsulta

    // Activos y vencidos están desembolsados y sin pagar; la mora se calcula al leer (T13)
    const conMora = await agregarMora(req.db, creditos)
    if (conMora.error) throw conMora.error

    const saldoTotal = (cuentas ?? []).reduce((sum, c) => sum + parseFloat(c.saldo ?? 0), 0)
    const saldoPendiente = (creditos ?? []).reduce(
      (sum, c) => sum + parseFloat(c.saldo_pendiente ?? 0),
      0,
    )

    return res.json({
      caja,
      rol: req.rol,
      resumen: {
        totalMiembros: totalMiembros ?? 0,
        totalSocios: totalSocios ?? 0,
        saldoTotal,
        creditosActivos: creditos?.length ?? 0,
        creditosEnMora: conMora.creditos.filter((c) => c.mora).length,
        saldoPendiente,
      },
      transaccionesRecientes: transacciones ?? [],
    })
  } catch (err) {
    console.error("Error en resumen:", err.message)
    return responderError(res, err)
  }
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId
// Edita nombre/descripción — solo coordinador
// ─────────────────────────────────────────────
router.put("/:cajaId", requierePermiso("caja.configurar"), async (req, res) => {
  const { cajaId } = req.params
  const { nombre, descripcion } = req.body

  const updates = {}
  if (nombre) updates.nombre = nombre.trim()
  if (descripcion !== undefined) updates.descripcion = descripcion.trim()

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No se enviaron campos para actualizar" })
  }

  const { data, error } = await req.db
    .from("cajas")
    .update(updates)
    .eq("id", cajaId)
    .select()
    .single()

  if (error) {
    return responderError(res, error)
  }

  return res.json({ message: "Caja actualizada correctamente", caja: data })
})

// POST /api/cajas/unirse
// El usuario ingresa un código y se une a la caja
router.post("/unirse", async (req, res) => {
  const { codigo } = req.body
  if (!codigo || typeof codigo !== "string") {
    return res.status(400).json({ error: "El código es requerido" })
  }

  // unirse_con_codigo (migración 004) busca el código vigente, agrega o reactiva la
  // membresía con el rol del código, lo marca como usado y vincula la ficha con el mismo
  // correo, todo junto. Quien fue removido conserva su fila y vuelve con el rol del código.
  const { data, error } = await req.db.rpc("unirse_con_codigo", { p_codigo: codigo })
  if (error) return responderError(res, error)

  return res.json({
    message: `Te uniste a ${data.caja.nombre} correctamente`,
    socioVinculado: data.socio_vinculado, // el frontend muestra otro mensaje si se vinculó
    caja: data.caja,
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/ciclos
// Lista todos los ciclos de la caja
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// POST /api/cajas/:cajaId/politicas  { version }
// Registra que el miembro aceptó las políticas de uso de la caja (HU-S04), al entrar por
// primera vez o después de un cambio de versión. Aceptar dos veces no duplica la fila.
// ─────────────────────────────────────────────
router.post("/:cajaId/politicas", requierePermiso("caja.ver"), async (req, res) => {
  if (req.body?.version !== POLITICAS_VERSION) {
    return res.status(400).json({
      error: "Las políticas cambiaron. Recarga la página para leer la versión vigente.",
      version: POLITICAS_VERSION,
    })
  }
  const fila = { user_id: req.user.id, caja_id: req.params.cajaId, version: POLITICAS_VERSION }
  const { data: previa, error: errorPrevia } = await req.db
    .from("aceptaciones_politicas")
    .select("aceptada_en")
    .match(fila)
    .maybeSingle()
  if (errorPrevia) return responderError(res, errorPrevia)
  if (previa) return res.json({ version: POLITICAS_VERSION, aceptada_en: previa.aceptada_en })

  const { data, error } = await req.db
    .from("aceptaciones_politicas")
    .insert(fila)
    .select("aceptada_en")
    .single()
  if (error) return responderError(res, error)
  return res.status(201).json({ version: POLITICAS_VERSION, aceptada_en: data.aceptada_en })
})

router.get("/:cajaId/ciclos", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId } = req.params

  const { data: caja } = await req.db
    .from("cajas")
    .select("fecha_fundacion, mes_inicio_ciclo, duracion_ciclo, created_at")
    .eq("id", cajaId)
    .single()
  if (!caja) return res.status(404).json({ error: "Caja no encontrada" })

  // Si no está configurado, no hay ciclos que mostrar
  if (!caja.fecha_fundacion) {
    return res.json({
      configurado: false,
      ciclos: [],
      ciclo_actual: null,
      mensaje: "El periodo de la caja aún no está configurado",
    })
  }

  const { ciclos, cicloActual } = calcularCiclos(
    caja.fecha_fundacion,
    caja.mes_inicio_ciclo,
    caja.duracion_ciclo,
  )

  return res.json({
    configurado: true,
    config: {
      fecha_fundacion: caja.fecha_fundacion,
      mes_inicio_ciclo: caja.mes_inicio_ciclo,
      duracion_ciclo: caja.duracion_ciclo,
    },
    ciclos,
    ciclo_actual: cicloActual,
  })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/configuracion-ciclo
// Configura el periodo de la caja — solo coordinador
// ─────────────────────────────────────────────
router.put("/:cajaId/configuracion-ciclo", requierePermiso("caja.configurar"), async (req, res) => {
  const { cajaId } = req.params

  const { error: errorCiclo, config } = validarConfigCiclo(req.body)
  if (errorCiclo) return res.status(400).json({ error: errorCiclo })

  const { error } = await req.db
    .from("cajas")
    .update({
      ...config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cajaId)

  if (error) return responderError(res, error)

  const { ciclos, cicloActual } = calcularCiclos(
    config.fecha_fundacion,
    config.mes_inicio_ciclo,
    config.duracion_ciclo,
  )

  return res.json({
    message: "Configuración guardada correctamente",
    ciclos,
    ciclo_actual: cicloActual,
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/configuracion-credito
// Reglas de crédito de la caja (T12). Las ven todos los miembros: el socio también
// tiene que saber cuánto puede pedir.
// ─────────────────────────────────────────────
router.get("/:cajaId/configuracion-credito", requierePermiso("caja.ver"), async (req, res) => {
  const { data, error } = await req.db
    .from("cajas")
    .select("monto_maximo_credito")
    .eq("id", req.params.cajaId)
    .single()

  if (error) return responderError(res, error)

  return res.json({
    monto_maximo_credito:
      data.monto_maximo_credito === null ? null : Number(data.monto_maximo_credito),
  })
})

// ─────────────────────────────────────────────
// PUT /api/cajas/:cajaId/configuracion-credito  { monto_maximo_credito: number | null }
// null quita el límite. Solo coordinador. La base lo aplica en cada solicitud (008).
// ─────────────────────────────────────────────
router.put(
  "/:cajaId/configuracion-credito",
  requierePermiso("caja.configurar"),
  async (req, res) => {
    const valor = req.body?.monto_maximo_credito
    if (valor === undefined) {
      return res.status(400).json({ error: "Indica el monto máximo, o null para no tener límite" })
    }
    if (valor !== null) {
      const problema = errorMonto(valor, "El monto máximo")
      if (problema) return res.status(400).json({ error: problema })
    }

    const { data, error } = await req.db
      .from("cajas")
      .update({
        monto_maximo_credito: valor === null ? null : Number(valor),
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.cajaId)
      .select("monto_maximo_credito")
      .single()

    if (error) return responderError(res, error)

    return res.json({
      message: valor === null ? "La caja ya no tiene monto máximo" : "Monto máximo guardado",
      monto_maximo_credito:
        data.monto_maximo_credito === null ? null : Number(data.monto_maximo_credito),
    })
  },
)

module.exports = router
