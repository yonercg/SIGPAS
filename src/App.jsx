import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/login";
import Dashboard from "./pages/Dashboard";
import Programacion from "./pages/Programacion";
import PM from "./pages/PM";
import Actividades from "./pages/Actividades";
import Informes from "./pages/Informes";
import OT from "./pages/OT";
import Anexos from "./pages/Anexos";
import Usuarios from "./pages/Usuarios";
import MainLayout from "./layouts/MainLayout";
import { ActividadesProvider } from "./context/ActividadesContext";
import { AuthProvider } from "./context/AuthContext";
import RutaProtegida from "./components/RutaProtegida.jsx";
import Auditoria from "./pages/Auditoria";
import Pendientes from "./pages/Pendientes";
import PendientesTabla from "./pages/PendientesTabla";

function App() {
  return (
    <AuthProvider>
      <ActividadesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            <Route
              element={
                <RutaProtegida>
                  <MainLayout />
                </RutaProtegida>
              }
            >
              <Route
                path="/auditoria"
                element={
                  <RutaProtegida pagina="auditoria">
                    <Auditoria />
                  </RutaProtegida>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RutaProtegida pagina="dashboard">
                    <Dashboard />
                  </RutaProtegida>
                }
              />

              <Route
                path="/programacion"
                element={
                  <RutaProtegida pagina="programacion">
                    <Programacion />
                  </RutaProtegida>
                }
              />

              <Route
                path="/pm"
                element={
                  <RutaProtegida pagina="pm">
                    <PM />
                  </RutaProtegida>
                }
              />

              <Route
                path="/actividades"
                element={
                  <RutaProtegida pagina="actividades">
                    <Actividades />
                  </RutaProtegida>
                }
              />

              <Route
                path="/informes"
                element={
                  <RutaProtegida pagina="informes">
                    <Informes />
                  </RutaProtegida>
                }
              />

              <Route
                path="/ot"
                element={
                  <RutaProtegida pagina="ot">
                    <OT />
                  </RutaProtegida>
                }
              />

              {/* 🆕 ANEXOS — usa el mismo permiso que Actividades */}
              <Route
                path="/anexos"
                element={
                  <RutaProtegida pagina="actividades">
                    <Anexos />
                  </RutaProtegida>
                }
              />

              {/* 🆕 PENDIENTES — landing con los dos formatos */}
              <Route
                path="/pendientes"
                element={
                  <RutaProtegida pagina="pendientes">
                    <Pendientes />
                  </RutaProtegida>
                }
              />

              {/* 🆕 PENDIENTES · ANOMALIAS */}
              <Route
                path="/pendientes/anomalias"
                element={
                  <RutaProtegida pagina="pendientes">
                    <PendientesTabla tipo="anomalias" />
                  </RutaProtegida>
                }
              />

              {/* 🆕 PENDIENTES · RETIE */}
              <Route
                path="/pendientes/retie"
                element={
                  <RutaProtegida pagina="pendientes">
                    <PendientesTabla tipo="retie" />
                  </RutaProtegida>
                }
              />

              <Route
                path="/usuarios"
                element={
                  <RutaProtegida pagina="usuarios">
                    <Usuarios />
                  </RutaProtegida>
                }
              />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ActividadesProvider>
    </AuthProvider>
  );
}

export default App;
