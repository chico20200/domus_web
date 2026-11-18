// backend/routes/admin.routes.js
const express = require("express")
const router = express.Router()
const supabaseAdmin = require("../config/supabaseAdmin")
const verifyToken = require("../middlewares/auth.middleware")
const requiereAdminSistema = require("../middlewares/adminSistema.middleware")
const { ACUERDO_VERSION } = require("../utils/confidencialidad")
const { calcularEstadoCuenta } = require("../utils/cuentaSistema")

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

// Créditos que siguen en curso: por aprobar, al día o en mora
const CREDITO_VIGENTE = ["pendiente", "activo", "mora"]

// GET /api/admin/cajas
// Cada caja con sus conteos: miembros con acceso, fichas de socio activas y créditos vigentes
router.get("/cajas", async (req, res) => {
  try {
    const [cajas, miembros, socios, creditos] = await Promise.all([
      leer(supabaseAdmin.from("cajas").select("id, nombre, created_at").order("nombre")),
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

module.exports = router
