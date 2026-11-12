# Graph Report - domus_web  (2026-11-11)

## Corpus Check
- Corpus is ~37,237 words - fits in a single context window. You may not need a graph.

## Summary
- 580 nodes · 1192 edges · 29 communities (26 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.84)
- Token cost: 373,892 input · 0 output

## Community Hubs (Navigation)
- App Shell, Auth & Pages
- Backend Routes & Config
- Ciclos & Reportes Services
- Creditos & Pagos Types
- Frontend Dependencies
- Ahorros & API Client
- Backend Dependencies
- TS App Config
- API Route Docs
- TS Node Config
- System Architecture Concepts
- Creditos Page Handlers
- Auth Types & Service
- Notification Context
- Credit Lifecycle Docs
- Configuracion Page Handlers
- Vite Icon Sprites
- Socios Page Handlers
- Entry Page & PayPal
- Vite Template Notes
- Claude Working Rules
- Vite Logo Asset
- Auth Middleware Docs
- Hex Background Asset
- Domus Logo Brand
- Vite Hero Asset
- React Logo Asset
- TS Root Config
- Vite Favicon

## God Nodes (most connected - your core abstractions)
1. `Button()` - 34 edges
2. `react` - 27 edges
3. `Field()` - 26 edges
4. `lucide-react` - 24 edges
5. `CreditosPage()` - 22 edges
6. `useCaja()` - 21 edges
7. `App()` - 20 edges
8. `AppLayout()` - 20 edges
9. `react-router-dom` - 18 edges
10. `AhorrosPage()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `React + TypeScript + Vite Template` --conceptually_related_to--> `Frontend Stack (React 19, TS, Vite, Tailwind 4, React Router 7)`  [INFERRED]
  frontend/README.md → README.md
- `Cajas routes /api/cajas (cajas.routes.js)` --implements--> `Modulo Cajas`  [INFERRED]
  backend/API.md → README.md
- `Cuentas de ahorro routes /api/cajas/:cajaId/cuentas (ahorros.routes.js)` --implements--> `Modulo Ahorros`  [INFERRED]
  backend/API.md → README.md
- `miembros_caja table` --implements--> `Multi-Caja Isolation`  [INFERRED]
  backend/API.md → README.md
- `Role Hierarchy socio(1) < tesorero(2) < admin(3)` --implements--> `Per-Caja Role-Based Access (admin, tesorero, socio)`  [INFERRED]
  backend/API.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Credit Lifecycle: request, approve, pay** — backend_api_post_creditos, backend_api_put_creditos_aprobar, backend_api_post_creditos_pago, backend_api_post_pagos [EXTRACTED 1.00]
- **Caja Invitation and Membership Flow** — backend_api_post_invitaciones, backend_api_post_cajas_unirse, backend_api_miembros_caja_table, backend_api_role_hierarchy [INFERRED 0.85]

## Communities (29 total, 3 thin omitted)

### Community 0 - "App Shell, Auth & Pages"
Cohesion: 0.06
Nodes (53): authService, sociosService, Socio, App(), ProtectedRoute(), Button(), ButtonProps, ButtonVariant (+45 more)

### Community 1 - "Backend Routes & Config"
Cohesion: 0.05
Nodes (46): getAccessToken(), { createClient }, supabase, { createClient }, supabaseAdmin, { createClient }, supabaseAuth, verifyToken() (+38 more)

### Community 2 - "Ciclos & Reportes Services"
Cohesion: 0.06
Nodes (48): ciclosService, Ciclo, CicloResumen, ConfigCiclo, GetCiclosResponse, GuardarCicloResponse, reportesService, DistribucionResponse (+40 more)

### Community 3 - "Creditos & Pagos Types"
Cohesion: 0.07
Nodes (42): AbonoRegistrado, FilaAmortizacion, GetAmortizacionResponse, MovimientoPago, creditosService, ChangeEstadoResponse, CreateCreditoRequest, CreateCreditoResponse (+34 more)

### Community 4 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (52): dependencies, jspdf@^4.2.1, jspdf-autotable@^5.0.8, lucide-react@^1.16.0, react@^19.2.5, react-dom@^19.2.5, react-router-dom@^7.15.1, @tailwindcss/vite@^4.2.4 (+44 more)

### Community 5 - "Ahorros & API Client"
Cohesion: 0.08
Nodes (27): ahorrosService, CuentaAhorro, CuentaCreatedResponse, GetCuentaResponse, GetCuentasResponse, Transaccion, TransaccionResponse, apiClient (+19 more)

### Community 6 - "Backend Dependencies"
Cohesion: 0.09
Nodes (26): author, dependencies, cors@^2.8.6, dotenv@^17.4.2, express@^5.2.1, jsonwebtoken@^9.0.3, jspdf@^4.2.1, jspdf-autotable@^5.0.8 (+18 more)

### Community 7 - "TS App Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 8 - "API Route Docs"
Cohesion: 0.16
Nodes (18): Auth routes /api/auth (auth.routes.js), Cajas routes /api/cajas (cajas.routes.js), Cuentas de ahorro routes /api/cajas/:cajaId/cuentas (ahorros.routes.js), API DOMUS Endpoint Documentation, GET /api/cajas/:cajaId/resumen, Miembros routes /api/cajas/:cajaId/miembros (miembros.routes.js), POST /api/auth/login, POST /api/cajas/unirse (+10 more)

### Community 9 - "TS Node Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 10 - "System Architecture Concepts"
Cohesion: 0.18
Nodes (12): miembros_caja table, Role Hierarchy socio(1) < tesorero(2) < admin(3), Backend Stack (Node.js, Express, JWT), Deployment: Netlify (frontend) + Render (backend), DOMUS Treasury Management System, Modulo Ciclos, Modulo Reportes, Multi-Caja Isolation (+4 more)

### Community 11 - "Creditos Page Handlers"
Cohesion: 0.33
Nodes (10): CreditosPage(), cargarDatos(), ejecutarPago(), handleAbono(), handleAprobar(), handleCrear(), handlePrepago(), recargarDetalle() (+2 more)

### Community 12 - "Auth Types & Service"
Cohesion: 0.27
Nodes (9): AuthUser, ForgotPasswordRequest, LoginRequest, LoginResponse, MessageResponse, RegisterRequest, RegisterResponse, UpdatePasswordRequest (+1 more)

### Community 13 - "Notification Context"
Cohesion: 0.22
Nodes (9): ConfirmOpts, ConfirmState, NotifContext, NotifContextType, NotifRenderer(), Toast, toastConfig, ToastTipo (+1 more)

### Community 14 - "Credit Lifecycle Docs"
Cohesion: 0.24
Nodes (10): Creditos routes /api/cajas/:cajaId/creditos (creditos.routes.js), pagos_credito table, Pagos routes /api/cajas/:cajaId/pagos (pagos.routes.js), POST /api/cajas/:cajaId/creditos, POST creditos/:creditoId/pago, POST /api/cajas/:cajaId/pagos, PUT creditos/:creditoId/aprobar, Modulo Creditos (+2 more)

### Community 15 - "Configuracion Page Handlers"
Cohesion: 0.31
Nodes (5): ConfiguracionPage(), cargarDatos(), handleCambiarRol(), handleGuardarCiclo(), handleRemover()

### Community 16 - "Vite Icon Sprites"
Cohesion: 0.25
Nodes (8): icons.svg (Vite template social/brand SVG sprite sheet), bluesky-icon (Bluesky butterfly logo, dark fill), discord-icon (Discord controller-face logo, dark fill), documentation-icon (document page with code brackets, purple #aa3bff stroke), github-icon (GitHub Octocat logo, dark fill), social-icon (user silhouette with star, purple #aa3bff stroke), Vite React starter template boilerplate asset, x-icon (X / Twitter logo, dark fill)

### Community 17 - "Socios Page Handlers"
Cohesion: 0.36
Nodes (5): SociosPage(), cargarSocios(), cerrarForm(), handleDesactivar(), handleGuardar()

### Community 18 - "Entry Page & PayPal"
Cohesion: 0.29
Nodes (7): Domus index.html entry page, PayPal JS SDK script (USD), #root mount element, Environment Variables (backend/.env, frontend/.env), Frontend Stack (React 19, TS, Vite, Tailwind 4, React Router 7), HuggingFace API Key, PayPal Integration

### Community 19 - "Vite Template Notes"
Cohesion: 0.33
Nodes (6): eslint-plugin-react-x / react-dom, @vitejs/plugin-react (Oxc), @vitejs/plugin-react-swc (SWC), React Compiler (not enabled), Type-aware ESLint configuration, React + TypeScript + Vite Template

### Community 21 - "Vite Logo Asset"
Cohesion: 0.50
Nodes (4): prefers-color-scheme Dark Mode Styling, Vite (Frontend Build Tool), Vite Logo (SVG), Vite Template Boilerplate Asset

### Community 22 - "Auth Middleware Docs"
Cohesion: 0.67
Nodes (3): POST /api/auth/update-password, verifyToken middleware, Modulo Autenticacion

### Community 23 - "Hex Background Asset"
Cohesion: 0.67
Nodes (3): DOMUS Orange Brand Visual Identity, Hex Background (fondo_hex.png), Orange 3D Honeycomb Pattern

### Community 24 - "Domus Logo Brand"
Cohesion: 0.67
Nodes (3): DOMUS Brand Identity (warm orange/yellow/red palette, thick dark outlines), Domus Logo, Hexagon House Emblem (flat geometric icon: orange/yellow hexagon, red-orange card/door panel, chimney-like square)

### Community 25 - "Vite Hero Asset"
Cohesion: 0.67
Nodes (3): Hero Image (Isometric Stacked Layers), Isometric Layered Platform Illustration (purple gradient base, outlined top layer), Vite Starter Template Hero Asset

### Community 26 - "React Logo Asset"
Cohesion: 0.67
Nodes (3): React (UI library), React Logo (SVG asset), Vite React Template Boilerplate

## Knowledge Gaps
- **39 isolated node(s):** `Backend Stack (Node.js, Express, JWT)`, `PostgreSQL on Supabase with Row Level Security`, `Deployment: Netlify (frontend) + Render (backend)`, `HuggingFace API Key`, `Modulo Ciclos` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 211 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App Shell, Auth & Pages` to `Ciclos & Reportes Services`, `Creditos & Pagos Types`, `Frontend Dependencies`, `Ahorros & API Client`, `Notification Context`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `Backend Stack (Node.js, Express, JWT)`, `PostgreSQL on Supabase with Row Level Security`, `Deployment: Netlify (frontend) + Render (backend)` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell, Auth & Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.06481481481481481 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App Shell, Auth & Pages` to `Ciclos & Reportes Services`, `Creditos & Pagos Types`, `Frontend Dependencies`, `Ahorros & API Client`, `Notification Context`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Backend Routes & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `App Shell, Auth & Pages` to `Ciclos & Reportes Services`, `Creditos & Pagos Types`, `Frontend Dependencies`, `Ahorros & API Client`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Ciclos & Reportes Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05780885780885781 - nodes in this community are weakly interconnected._