// backend/routes/cajas.routes.js
const express = require("express")
const router = express.Router()
const supabase = require("../config/supabaseAdmin")
const supabaseAdmin = require("../config/supabaseAdmin")
const { POLITICAS_VERSION } = require("../utils/politicas")
const { vincularFichaPorCorreo } = require("../utils/fichas")
const verifyToken = require("../middlewares/auth.middleware")
const { requierePermiso } = require("../middlewares/permisos.middleware")
const { calcularCiclos, validarConfigCiclo } = require("../utils/ciclos")

// Largos máximos de los datos de una caja (los mismos que el formulario)
const LARGO_NOMBRE = 80
const LARGO_DESCRIPCION = 300

router.use(verifyToken)

// ─────────────────────────────────────────────
// GET /api/cajas/mis-cajas
// Devuelve todas las cajas del usuario autenticado con su rol
// ─────────────────────────────────────────────
router.get("/mis-cajas", async (req, res) => {
  const userId = req.user.id

  const { data, error } = await supabaseAdmin
    .from("miembros_caja")
    .select(
      `
      rol,
      cajas (
        id,
        nombre,
        descripcion,
        activa
      )
    `,
    )
    .eq("user_id", userId)
    .eq("activo", true)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Transforma el resultado para aplanar la estructura
  const cajas = data
    .filter((m) => m.cajas && m.cajas.activa)
    .map((m) => ({
      id: m.cajas.id,
      nombre: m.cajas.nombre,
      descripcion: m.cajas.descripcion ?? "",
      rol: m.rol,
    }))

  return res.json({ cajas })
})

// ─────────────────────────────────────────────
// POST /api/cajas
// Crea una caja con su periodo, registra al creador como coordinador y guarda su
// aceptación de las políticas de uso (asistente de §5.1, HU004 y HU022).
// Cuerpo: nombre, descripcion, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo,
// politicas_version (la versión que se le mostró y aceptó).
// ─────────────────────────────────────────────
router.post("/", async (req, res) => {
  const userId = req.user.id
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

  // 1. Crea la caja con su periodo
  const { data: caja, error: errorCaja } = await supabaseAdmin
    .from("cajas")
    .insert({
      nombre: nombreLimpio,
      descripcion: descripcionLimpia,
      creado_por: userId,
      ...config,
    })
    .select("id, nombre, descripcion, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo")
    .single()

  if (errorCaja) {
    return res.status(500).json({ error: errorCaja.message })
  }

  // 2. El creador queda como coordinador. 3. Su aceptación de las políticas.
  // Si algo falla se borra la caja (miembros_caja y aceptaciones se van en cascada)
  // para no dejar una caja sin coordinador o sin aceptación.
  const { error: errorMiembro } = await supabaseAdmin
    .from("miembros_caja")
    .insert({ caja_id: caja.id, user_id: userId, rol: "coordinador" })
  const { error: errorAceptacion } = errorMiembro
    ? { error: null }
    : await supabaseAdmin
        .from("aceptaciones_politicas")
        .insert({ caja_id: caja.id, user_id: userId, version: POLITICAS_VERSION })

  if (errorMiembro || errorAceptacion) {
    await supabaseAdmin.from("cajas").delete().eq("id", caja.id)
    return res.status(500).json({ error: (errorMiembro ?? errorAceptacion).message })
  }

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
    const { data: caja, error: errorCaja } = await supabaseAdmin
      .from("cajas")
      .select("id, nombre, descripcion, created_at")
      .eq("id", cajaId)
      .single()

    const { count: totalMiembros, error: errorMiembros } = await supabaseAdmin
      .from("miembros_caja")
      .select("*", { count: "exact", head: true })
      .eq("caja_id", cajaId)
      .eq("activo", true)

    const { count: totalSocios, error: errorSocios } = await supabaseAdmin
      .from("socios")
      .select("*", { count: "exact", head: true })
      .eq("caja_id", cajaId)
      .eq("activo", true)

    const { data: cuentas, error: errorCuentas } = await supabaseAdmin
      .from("cuentas_ahorro")
      .select("saldo")
      .eq("caja_id", cajaId)
      .eq("estado", "activa")

    const { data: creditos, error: errorCreditos } = await supabaseAdmin
      .from("creditos")
      .select("saldo_pendiente")
      .eq("caja_id", cajaId)
      .eq("estado", "activo")

    const { data: transacciones, error: errorTx } = await supabaseAdmin
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
        saldoPendiente,
      },
      transaccionesRecientes: transacciones ?? [],
    })
  } catch (err) {
    console.error("Error en resumen:", err.message)
    return res.status(500).json({ error: err.message })
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

  const { data, error } = await supabase
    .from("cajas")
    .update(updates)
    .eq("id", cajaId)
    .select()
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.json({ message: "Caja actualizada correctamente", caja: data })
})

// POST /api/cajas/unirse
// El usuario ingresa un código y se une a la caja
router.post("/unirse", async (req, res) => {
  const userId = req.user.id
  const { codigo } = req.body

  if (!codigo) return res.status(400).json({ error: "El código es requerido" })

  // 1. Busca la invitación activa y válida
  const { data: invitacion } = await supabaseAdmin
    .from("invitaciones_caja")
    .select("*, cajas(nombre)")
    .eq("codigo", codigo.toUpperCase().trim())
    .eq("activo", true)
    .is("usado_por", null)
    .gt("expira_at", new Date().toISOString())
    .single()

  if (!invitacion) {
    return res.status(404).json({ error: "Código inválido o expirado" })
  }

  // 2. Verifica que no sea ya miembro. Quien fue removido (activo: false) conserva su
  // fila: con un código nuevo vuelve a entrar con el rol del código.
  const { data: miembroPrevio } = await supabaseAdmin
    .from("miembros_caja")
    .select("id, activo")
    .eq("caja_id", invitacion.caja_id)
    .eq("user_id", userId)
    .maybeSingle()

  if (miembroPrevio?.activo) {
    return res.status(400).json({ error: "Ya perteneces a esta caja" })
  }

  // 3. Agrega como miembro de la caja, o reactiva al que fue removido
  const { error: errorMiembro } = miembroPrevio
    ? await supabaseAdmin
        .from("miembros_caja")
        .update({ activo: true, rol: invitacion.rol })
        .eq("id", miembroPrevio.id)
        .eq("caja_id", invitacion.caja_id)
    : await supabaseAdmin.from("miembros_caja").insert({
        caja_id: invitacion.caja_id,
        user_id: userId,
        rol: invitacion.rol,
      })

  if (errorMiembro) {
    return res.status(500).json({ error: errorMiembro.message })
  }

  // 4. Vincula la ficha de socio que tenga el mismo correo, sin distinguir mayúsculas
  let socioVinculado = false
  try {
    socioVinculado = Boolean(
      await vincularFichaPorCorreo(invitacion.caja_id, userId, req.user.email),
    )
  } catch (err) {
    // Si falla la vinculación no es crítico: el usuario igual entra a la caja, y la
    // ficha se vincula cuando abra "Mis ahorros" (GET /cuentas/mias)
    console.error("Error al vincular socio:", err.message)
  }

  // 5. Marca la invitación como usada
  await supabaseAdmin
    .from("invitaciones_caja")
    .update({
      usado_por: userId,
      usado_at: new Date().toISOString(),
      activo: false,
    })
    .eq("id", invitacion.id)
    .eq("caja_id", invitacion.caja_id)

  return res.json({
    message: `Te uniste a ${invitacion.cajas.nombre} correctamente`,
    socioVinculado, // ← el frontend puede mostrar un mensaje diferente si se vinculó
    caja: {
      id: invitacion.caja_id,
      nombre: invitacion.cajas.nombre,
      rol: invitacion.rol,
    },
  })
})

// ─────────────────────────────────────────────
// GET /api/cajas/:cajaId/ciclos
// Lista todos los ciclos de la caja
// ─────────────────────────────────────────────
router.get("/:cajaId/ciclos", requierePermiso("caja.ver"), async (req, res) => {
  const { cajaId } = req.params

  const { data: caja } = await supabaseAdmin
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

  const { error } = await supabaseAdmin
    .from("cajas")
    .update({
      ...config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cajaId)

  if (error) return res.status(500).json({ error: error.message })

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

module.exports = router
