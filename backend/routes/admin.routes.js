// backend/routes/admin.routes.js
const express = require("express")
const router = express.Router()
const supabaseAdmin = require("../config/supabaseAdmin")
const verifyToken = require("../middlewares/auth.middleware")
const requiereAdminSistema = require("../middlewares/adminSistema.middleware")
const { ACUERDO_VERSION } = require("../utils/confidencialidad")
const { calcularEstadoCuenta, esAdminSistema, leerBloqueo } = require("../utils/cuentaSistema")
const { calcularCiclos } = require("../utils/ciclos")
const { responderError } = require("../utils/errores")

// Panel de administración del sistema (HU019 a HU021). Solo para las cuentas de
// administradores_sistema; nada de aquí depende de una caja ni de sus roles.
router.use(verifyToken, requiereAdminSistema)

/** La aceptación de la versión vigente del acuerdo, o null. Lanza si la consulta falla */
async function leerAceptacion(userId) {
  const { data, error } = await supabaseAdmin
    .from("aceptaciones_confidencialidad")
    .select("aceptada_en")
    .eq("user_id", userId)
    .eq("version", ACUERDO_VERSION)
    .maybeSingle()
  if (error) throw error
  return data
}

// GET /api/admin/acuerdo
// Versión vigente del acuerdo de confidencialidad y si esta cuenta ya la aceptó
router.get("/acuerdo", async (req, res) => {
  try {
    const aceptacion = await leerAceptacion(req.user.id)
    return res.json({
      version: ACUERDO_VERSION,
      aceptado: Boolean(aceptacion),
      aceptado_en: aceptacion?.aceptada_en ?? null,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/acuerdo  { version }
// Registra la aceptación (HU-S03). La versión tiene que ser la vigente: así no se acepta
// un texto viejo que el navegador tenía en caché. Aceptar dos veces no duplica la fila.
router.post("/acuerdo", async (req, res) => {
  if (req.body?.version !== ACUERDO_VERSION) {
    return res.status(400).json({
      error: "El acuerdo cambió. Recarga la página para leer la versión vigente.",
      version: ACUERDO_VERSION,
    })
  }
  try {
    const previa = await leerAceptacion(req.user.id)
    if (previa) return res.json({ version: ACUERDO_VERSION, aceptado_en: previa.aceptada_en })

    const { data, error } = await supabaseAdmin
      .from("aceptaciones_confidencialidad")
      .insert({ user_id: req.user.id, version: ACUERDO_VERSION })
      .select("aceptada_en")
      .single()
    if (error) throw error
    return res.status(201).json({ version: ACUERDO_VERSION, aceptado_en: data.aceptada_en })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// Todo lo que sigue exige el acuerdo vigente aceptado (HU-S03): sin él, el panel no
// entrega ningún dato
router.use(async (req, res, next) => {
  try {
    if (!(await leerAceptacion(req.user.id))) {
      return res.status(403).json({
        error: "Acepta el acuerdo de confidencialidad para abrir el panel",
        codigo: "acuerdo_pendiente",
        version: ACUERDO_VERSION,
      })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  next()
})

// ── Panel (HU019, HU-S01) ─────────────────────────────────────────────────────
// Solo nombres, cuentas, estados y conteos. Ningún monto, saldo ni dato personal de un
// socio sale de estas rutas (acuerdo de confidencialidad, políticas de uso §3).

/** Lee todas las filas de una consulta; lanza si falla */
async function leer(consulta) {
  const { data, error } = await consulta
  if (error) throw error
  return data ?? []
}

/** Cuenta filas por caja_id */
function contarPorCaja(filas) {
  const conteo = {}
  for (const f of filas) conteo[f.caja_id] = (conteo[f.caja_id] ?? 0) + 1
  return conteo
}

// Créditos que siguen en curso: por aprobar, al día o vencidos. Son los valores del enum
// estado_credito de la base (pendiente, activo, pagado, vencido): un valor que no está en
// el enum, como "mora", hace fallar toda la consulta.
const CREDITO_VIGENTE = ["pendiente", "activo", "vencido"]

/** El ciclo en curso de una caja, como "Abril 2025 – Marzo 2026", o null sin fundación */
function cicloVigente(c) {
  if (!c.fecha_fundacion || !c.mes_inicio_ciclo || !c.duracion_ciclo) return null
  return (
    calcularCiclos(c.fecha_fundacion, c.mes_inicio_ciclo, c.duracion_ciclo).cicloActual?.label ??
    null
  )
}

// GET /api/admin/cajas
// Cada caja con su estado, fundación y ciclo vigente (HU019), y sus conteos: miembros con
// acceso, fichas de socio activas y créditos vigentes. Las eliminadas no se listan.
router.get("/cajas", async (req, res) => {
  try {
    const [cajas, miembros, socios, creditos] = await Promise.all([
      leer(
        supabaseAdmin
          .from("cajas")
          .select(
            "id, nombre, created_at, fecha_fundacion, mes_inicio_ciclo, duracion_ciclo, estado, estado_motivo, estado_cambiado_en",
          )
          .neq("estado", "eliminada")
          .order("nombre"),
      ),
      leer(supabaseAdmin.from("miembros_caja").select("caja_id").eq("activo", true)),
      leer(supabaseAdmin.from("socios").select("caja_id").eq("activo", true)),
      leer(supabaseAdmin.from("creditos").select("caja_id").in("estado", CREDITO_VIGENTE)),
    ])
    const nMiembros = contarPorCaja(miembros)
    const nSocios = contarPorCaja(socios)
    const nCreditos = contarPorCaja(creditos)
    return res.json({
      cajas: cajas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        creada_en: c.created_at,
        fecha_fundacion: c.fecha_fundacion ?? null,
        ciclo_vigente: cicloVigente(c),
        estado: c.estado,
        estado_motivo: c.estado_motivo ?? null,
        estado_cambiado_en: c.estado_cambiado_en ?? null,
        miembros: nMiembros[c.id] ?? 0,
        socios: nSocios[c.id] ?? 0,
        creditos_vigentes: nCreditos[c.id] ?? 0,
      })),
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

/** Todas las cuentas de Supabase Auth, página por página */
async function listarUsuarios() {
  const porPagina = 1000
  const usuarios = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: porPagina })
    if (error) throw error
    usuarios.push(...data.users)
    if (data.users.length < porPagina) return usuarios
  }
}

// GET /api/admin/cuentas
// Cada cuenta de usuario con su estado (Figura 1.2), sus cajas con el rol, y si administra
router.get("/cuentas", async (req, res) => {
  try {
    const [usuarios, perfiles, bloqueos, admins, miembros, cajas] = await Promise.all([
      listarUsuarios(),
      leer(supabaseAdmin.from("profiles").select("id, nombre")),
      leer(supabaseAdmin.from("bloqueos_cuenta").select("user_id, motivo, bloqueada_en")),
      leer(supabaseAdmin.from("administradores_sistema").select("user_id")),
      leer(supabaseAdmin.from("miembros_caja").select("user_id, caja_id, rol").eq("activo", true)),
      leer(supabaseAdmin.from("cajas").select("id, nombre")),
    ])
    const nombre = Object.fromEntries(perfiles.map((p) => [p.id, p.nombre]))
    const bloqueo = Object.fromEntries(bloqueos.map((b) => [b.user_id, b]))
    const esAdmin = new Set(admins.map((a) => a.user_id))
    const nombreCaja = Object.fromEntries(cajas.map((c) => [c.id, c.nombre]))
    const cajasDe = {}
    for (const m of miembros) {
      ;(cajasDe[m.user_id] ??= []).push({
        caja_id: m.caja_id,
        nombre: nombreCaja[m.caja_id] ?? "Caja sin nombre",
        rol: m.rol,
      })
    }

    const cuentas = usuarios.map((u) => {
      const susCajas = (cajasDe[u.id] ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre))
      return {
        id: u.id,
        correo: u.email,
        nombre: nombre[u.id] || null,
        creada_en: u.created_at,
        ultimo_ingreso: u.last_sign_in_at ?? null,
        es_admin_sistema: esAdmin.has(u.id),
        cajas: susCajas,
        ...calcularEstadoCuenta({
          confirmada: Boolean(u.email_confirmed_at),
          bloqueo: bloqueo[u.id] ?? null,
          cajasActivas: susCajas.length,
        }),
      }
    })
    cuentas.sort((a, b) => (a.correo ?? "").localeCompare(b.correo ?? ""))
    return res.json({ cuentas })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ── Bloquear y restablecer (HU020, HU-S02) ──────────────────────────────────────
// Motivo obligatorio y una fila en la bitácora por cada acción. La base de datos exige al
// menos 10 caracteres; aquí se valida antes para dar un mensaje claro.

const LARGO_MOTIVO = { min: 10, max: 500 }

function leerMotivo(body) {
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : ""
  if (motivo.length < LARGO_MOTIVO.min) {
    return { error: `Escribe el motivo, con al menos ${LARGO_MOTIVO.min} caracteres` }
  }
  if (motivo.length > LARGO_MOTIVO.max) {
    return { error: `El motivo no puede pasar de ${LARGO_MOTIVO.max} caracteres` }
  }
  return { motivo }
}

/** La cuenta de Auth a la que apunta :id, o null si no existe */
async function leerCuenta(id) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
  if (error || !data?.user) return null
  return data.user
}

async function anotarBitacora({ adminId, accion, cuenta, motivo }) {
  const { error } = await supabaseAdmin.from("bitacora_administracion").insert({
    admin_id: adminId,
    accion,
    usuario_id: cuenta.id,
    usuario_correo: cuenta.email ?? "",
    motivo,
  })
  if (error) throw error
}

// POST /api/admin/cuentas/:id/bloqueo  { motivo }
// No se bloquea la propia cuenta ni la de otro administrador (primero hay que quitarlo de
// administradores_sistema): así el panel nunca se queda sin quien lo use.
router.post("/cuentas/:id/bloqueo", async (req, res) => {
  const { motivo, error: errorMotivo } = leerMotivo(req.body)
  if (errorMotivo) return res.status(400).json({ error: errorMotivo, campo: "motivo" })
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "No puedes bloquear tu propia cuenta" })
  }
  try {
    const cuenta = await leerCuenta(req.params.id)
    if (!cuenta) return res.status(404).json({ error: "La cuenta no existe" })
    if (await esAdminSistema(cuenta.id)) {
      return res.status(400).json({ error: "No se puede bloquear a otro administrador de DOMUS" })
    }
    if (await leerBloqueo(cuenta.id)) {
      return res.status(409).json({ error: "La cuenta ya está bloqueada" })
    }

    const { data: bloqueo, error } = await supabaseAdmin
      .from("bloqueos_cuenta")
      .insert({ user_id: cuenta.id, motivo, bloqueada_por: req.user.id })
      .select("motivo, bloqueada_en")
      .single()
    if (error) throw error

    try {
      await anotarBitacora({ adminId: req.user.id, accion: "bloquear", cuenta, motivo })
    } catch (err) {
      // Sin registro en la bitácora no hay bloqueo (HU-S02)
      await supabaseAdmin.from("bloqueos_cuenta").delete().eq("user_id", cuenta.id)
      throw err
    }
    return res.status(201).json({ bloqueo })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/cuentas/:id/restablecimiento  { motivo }
// Quita el bloqueo. La cuenta vuelve al estado que le corresponda (activa, inactiva o
// pendiente); la historia queda en la bitácora.
router.post("/cuentas/:id/restablecimiento", async (req, res) => {
  const { motivo, error: errorMotivo } = leerMotivo(req.body)
  if (errorMotivo) return res.status(400).json({ error: errorMotivo, campo: "motivo" })
  try {
    const cuenta = await leerCuenta(req.params.id)
    if (!cuenta) return res.status(404).json({ error: "La cuenta no existe" })
    const bloqueo = await leerBloqueo(cuenta.id)
    if (!bloqueo) return res.status(409).json({ error: "La cuenta no está bloqueada" })

    const { error } = await supabaseAdmin.from("bloqueos_cuenta").delete().eq("user_id", cuenta.id)
    if (error) throw error

    try {
      await anotarBitacora({ adminId: req.user.id, accion: "restablecer", cuenta, motivo })
    } catch (err) {
      // Sin registro en la bitácora no hay restablecimiento: se devuelve el bloqueo
      await supabaseAdmin.from("bloqueos_cuenta").insert({ user_id: cuenta.id, ...bloqueo })
      throw err
    }
    return res.json({ message: "Cuenta restablecida" })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/cajas/:id/bloqueo  { motivo }
// POST /api/admin/cajas/:id/restablecimiento  { motivo }
// Una caja bloqueada se sigue leyendo, pero nadie registra nada en ella (migración 004).
// El cambio de estado y la fila de la bitácora van juntos en admin_estado_caja (006).
function cambiarEstadoCaja(bloquear) {
  return async (req, res) => {
    const { motivo, error: errorMotivo } = leerMotivo(req.body)
    if (errorMotivo) return res.status(400).json({ error: errorMotivo, campo: "motivo" })
    const { data, error } = await supabaseAdmin.rpc("admin_estado_caja", {
      p_caja: req.params.id,
      p_bloquear: bloquear,
      p_motivo: motivo,
      p_admin: req.user.id,
    })
    if (error) return responderError(res, error)
    return res.status(bloquear ? 201 : 200).json({ caja: data })
  }
}
router.post("/cajas/:id/bloqueo", cambiarEstadoCaja(true))
router.post("/cajas/:id/restablecimiento", cambiarEstadoCaja(false))

// GET /api/admin/bitacora
// Las últimas 200 acciones, la más reciente primero, con el correo de quien las hizo.
// Junta los bloqueos y restablecimientos con las aceptaciones del acuerdo de
// confidencialidad (HU021: "consultable en la bitácora", T28). Las aceptaciones se leen de
// su propia tabla, así no hay dos copias del mismo dato y salen también las de antes.
const LIMITE_BITACORA = 200

router.get("/bitacora", async (req, res) => {
  try {
    const aceptaciones = await leer(
      supabaseAdmin
        .from("aceptaciones_confidencialidad")
        .select("id, user_id, version, aceptada_en")
        .order("aceptada_en", { ascending: false })
        .limit(LIMITE_BITACORA),
    )
    const filas = await leer(
      supabaseAdmin
        .from("bitacora_administracion")
        .select(
          "id, admin_id, accion, usuario_id, usuario_correo, caja_id, caja_nombre, motivo, creado_en",
        )
        .order("creado_en", { ascending: false })
        .limit(LIMITE_BITACORA),
    )
    const ids = [
      ...new Set([...filas.map((f) => f.admin_id), ...aceptaciones.map((a) => a.user_id)]),
    ].filter(Boolean)
    const correos = Object.fromEntries(
      await Promise.all(ids.map(async (id) => [id, (await leerCuenta(id))?.email ?? null])),
    )
    const registros = [
      ...filas.map((f) => ({
        id: f.id,
        accion: f.accion,
        cuenta_id: f.usuario_id,
        cuenta_correo: f.usuario_correo || null,
        caja_id: f.caja_id ?? null,
        caja_nombre: f.caja_nombre ?? null,
        motivo: f.motivo,
        version: null,
        fecha: f.creado_en,
        admin_correo: f.admin_id ? correos[f.admin_id] : null,
      })),
      ...aceptaciones.map((a) => ({
        id: `acuerdo-${a.id}`,
        accion: "aceptar_acuerdo",
        cuenta_id: a.user_id,
        cuenta_correo: null,
        caja_id: null,
        caja_nombre: null,
        motivo: null,
        version: a.version,
        fecha: a.aceptada_en,
        admin_correo: correos[a.user_id] ?? null,
      })),
    ]
      .sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0))
      .slice(0, LIMITE_BITACORA)
    return res.json({ registros })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
