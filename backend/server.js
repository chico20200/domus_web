// backend/server.js
const express = require("express")
const cors = require("cors")
require("dotenv").config()
const { ZONA_HORARIA } = require("./utils/fechas")

// Antes de cualquier cálculo de fechas: ver utils/fechas.js
process.env.TZ = ZONA_HORARIA

const authRoutes = require("./routes/auth.routes")
const profileRoutes = require("./routes/profile.routes")
const sociosRoutes = require("./routes/socios.routes")
const salidaRoutes = require("./routes/salida.routes")
const cajasRoutes = require("./routes/cajas.routes")
const ahorrosRoutes = require("./routes/ahorros.routes")
const miembrosRoutes = require("./routes/miembros.routes")
const creditosRoutes = require("./routes/creditos.routes")
const pagosRoutes = require("./routes/pagos.routes")
const pendientesRoutes = require("./routes/pendientes.routes")
const reportesRoutes = require("./routes/reportes.routes")
const fondosRoutes = require("./routes/fondos.routes")
const adminRoutes = require("./routes/admin.routes")
const importacionRoutes = require("./routes/importacion.routes")

const app = express()

// ── Middlewares ──────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  }),
)
// La importación desde Excel manda hasta 2.000 filas por hoja: su propio límite, antes del
// general (100 kB)
app.use("/api/cajas/:cajaId/importar", express.json({ limit: "4mb" }), importacionRoutes)
app.use(express.json())

// ── Rutas ────────────────────────────────────
app.use("/api/auth", authRoutes)
app.use("/api/profiles", profileRoutes)
app.use("/api/cajas", cajasRoutes)
app.use("/api/cajas/:cajaId/socios/:socioId/salida", salidaRoutes)
app.use("/api/cajas/:cajaId/socios", sociosRoutes)
app.use("/api/cajas/:cajaId/cuentas", ahorrosRoutes)
app.use("/api/cajas/:cajaId/miembros", miembrosRoutes)
app.use("/api/cajas/:cajaId/creditos", creditosRoutes)
app.use("/api/cajas/:cajaId/creditos/:creditoId/pagos", pagosRoutes)
app.use("/api/cajas/:cajaId/reportes", reportesRoutes)
app.use("/api/cajas/:cajaId/fondos", fondosRoutes)
app.use("/api/cajas/:cajaId/pendientes", pendientesRoutes)
app.use("/api/admin", adminRoutes)
// Errores del lector del cuerpo (una foto que pasa del límite, un JSON roto): en JSON y en
// español, como el resto de la API, en vez de la página HTML de Express
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    const mb = Math.round((err.limit ?? 0) / (1024 * 1024))
    const error = req.originalUrl.includes("/importar/")
      ? `El archivo tiene demasiados datos (más de ${mb} MB). Divídelo en partes.`
      : `La foto pesa más de ${mb} MB. Toma otra o redúcela.`
    return res.status(413).json({ error })
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es válido" })
  }
  return next(err)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
