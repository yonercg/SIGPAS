import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/login";
import Dashboard from "./pages/Dashboard";
import Programacion from "./pages/Programacion";
import PM from "./pages/PM";
import Actividades from "./pages/Actividades";
import Informes from "./pages/Informes";
import OT from "./pages/OT";
import Usuarios from "./pages/Usuarios";
import MainLayout from "./layouts/MainLayout";
import { ActividadesProvider } from "./context/ActividadesContext";
import { AuthProvider } from "./context/AuthContext";
import RutaProtegida from "./components/RutaProtegida.jsx";

function App() {
  return (
    <AuthProvider>
      <ActividadesProvider>
        <BrowserRouter>
          <Routes>
            {/* ========================================= */}
            {/* PÁGINA PÚBLICA                            */}
            {/* ========================================= */}

            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            {/* ========================================= */}
            {/* APLICACIÓN PROTEGIDA                      */}
            {/* ========================================= */}

            <Route
              element={
                <RutaProtegida>
                  <MainLayout />
                </RutaProtegida>
              }
            >
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

              <Route
                path="/usuarios"
                element={
                  <RutaProtegida pagina="usuarios">
                    <Usuarios />
                  </RutaProtegida>
                }
              />

              {/* Cualquier ruta desconocida dentro del layout → dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ActividadesProvider>
    </AuthProvider>
  );
}

export default App;
