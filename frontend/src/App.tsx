// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import { AuthProvider } from "./context/AuthProvider"
import { ThemeProvider } from "./context/ThemeProvider"
import Login from "./pages/Login"
import ProfilePage from "./pages/ProfilePage"
import ForgotPasswordPage from "./pages/ForgotPasswordPage"
import ResetPasswordPage from "./pages/ResetPasswordPage"
import Register from "./pages/Register"
import { CajaProvider } from "./context/CajaProvider"
import CajasPage from "./pages/CajasPage"
import DashboardPage from "./pages/DashboardPage"
import SociosPage from "./pages/SociosPage"
import AhorrosPage from "./pages/AhorrosPage"
import ConfiguracionPage from "./pages/ConfiguracionPage"
import CreditosPage from "./pages/CreditosPage"
import PagosPage from "./pages/PagosPage"
import { RolRoute } from "./components/RolRoute"
import { NotifProvider } from "./context/NotifProvider"
import ReportesPage from "./pages/ReportesPage"
import { lazy, Suspense } from "react"
import { LoadingState } from "./components/LoadingState"

// Página de muestra de componentes: solo en desarrollo. En el build de producción
// import.meta.env.DEV es false, la rama se elimina y el módulo no se empaqueta.
const ComponentesPage = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/ComponentesPage"))
  : null

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace /> // sin sesión → login

  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CajaProvider>
          {" "}
          {/* ← envuelve todo para que useAuth funcione */}
          <NotifProvider>
            <BrowserRouter>
              <Routes>
                {/* Rutas públicas */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Selección de caja — protegida pero sin layout */}
                <Route
                  path="/cajas"
                  element={
                    <ProtectedRoute>
                      <CajasPage />
                    </ProtectedRoute>
                  }
                />

                {/* Rutas dentro de una caja */}
                <Route
                  path="/perfil"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <RolRoute rolMinimo="tesorero">
                        <DashboardPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/socios"
                  element={
                    <ProtectedRoute>
                      <RolRoute rolMinimo="tesorero">
                        <SociosPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ahorros"
                  element={
                    <ProtectedRoute>
                      <RolRoute>
                        <AhorrosPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/creditos"
                  element={
                    <ProtectedRoute>
                      <RolRoute rolMinimo="tesorero">
                        <CreditosPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pagos"
                  element={
                    <ProtectedRoute>
                      <RolRoute rolMinimo="tesorero">
                        <PagosPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reportes"
                  element={
                    <ProtectedRoute>
                      <RolRoute rolMinimo="tesorero">
                        <ReportesPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion"
                  element={
                    <ProtectedRoute>
                      <RolRoute rolMinimo="tesorero">
                        <ConfiguracionPage />
                      </RolRoute>
                    </ProtectedRoute>
                  }
                />

                {ComponentesPage && (
                  <Route
                    path="/dev/componentes"
                    element={
                      <Suspense fallback={<LoadingState pantallaCompleta />}>
                        <ComponentesPage />
                      </Suspense>
                    }
                  />
                )}

                {/* Redirige la raíz a /cajas */}
                <Route path="/" element={<Navigate to="/cajas" replace />} />
              </Routes>
            </BrowserRouter>
          </NotifProvider>
        </CajaProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
