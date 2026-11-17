import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./MainLayout.css";

function MainLayout() {
  const location = useLocation();
  const {
    usuarioActual,
    cerrarSesion,
    tienePermiso,
    esCuadrilla,
    cuadrillaUsuario,
  } = useAuth();

  return (
    <div className="main-layout">
      {/* MENÚ LATERAL */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo-emsa.png" alt="Logo EMSA" className="sidebar-logo" />
        </div>

        <nav className="sidebar-menu">
          {/* INICIO */}
          {!esCuadrilla && (
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>
              <span>🏠</span>
              Inicio
            </Link>
          )}

          {/* DASHBOARD */}
          {tienePermiso("dashboard") && (
            <Link
              to="/dashboard"
              className={location.pathname === "/dashboard" ? "active" : ""}
            >
              <span>📊</span>
              Dashboard
            </Link>
          )}

          {/* PROGRAMACIÓN */}
          {tienePermiso("programacion") && (
            <Link
              to="/programacion"
              className={location.pathname === "/programacion" ? "active" : ""}
            >
              <span>📅</span>
              Programación
            </Link>
          )}

          {/* PM */}
          {tienePermiso("pm") && (
            <Link
              to="/pm"
              className={location.pathname === "/pm" ? "active" : ""}
            >
              <span>🛠️</span>
              PM
            </Link>
          )}

          {/* ACTIVIDADES */}
          {tienePermiso("actividades") && (
            <Link
              to="/actividades"
              className={location.pathname === "/actividades" ? "active" : ""}
            >
              <span>📋</span>
              Actividades
            </Link>
          )}

          {/* INFORMES */}
          {tienePermiso("informes") && (
            <Link
              to="/informes"
              className={location.pathname === "/informes" ? "active" : ""}
            >
              <span>📄</span>
              Informes
            </Link>
          )}

          {/* ÓRDENES DE TRABAJO */}
          {tienePermiso("ot") && (
            <Link
              to="/ot"
              className={location.pathname === "/ot" ? "active" : ""}
            >
              <span>📝</span>
              Órdenes de Trabajo
            </Link>
          )}

          {/* 🆕 PENDIENTES (debajo de Órdenes de Trabajo) */}
          {tienePermiso("pendientes") && (
            <Link
              to="/pendientes"
              className={location.pathname === "/pendientes" ? "active" : ""}
            >
              <span>📌</span>
              Pendientes
            </Link>
          )}

          {/* AUDITORÍA (debajo de Pendientes) */}
          {tienePermiso("auditoria") && (
            <Link
              to="/auditoria"
              className={location.pathname === "/auditoria" ? "active" : ""}
            >
              <span>📋</span>
              Auditoría
            </Link>
          )}

          {/* USUARIOS */}
          {tienePermiso("usuarios") && (
            <Link
              to="/usuarios"
              className={location.pathname === "/usuarios" ? "active" : ""}
            >
              <span>👥</span>
              Usuarios
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          SIGPAS
          <div> ---------------------ING. Yoner Caicedo</div>
          <span>v1.1</span>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="content-area">
        <header className="topbar">
          <div>
            <span className="topbar-section">Sistema Integral de Gestión</span>
          </div>

          <div className="user-area">
            <span className="user-area-icono">👤</span>

            <div className="user-area-info">
              <span className="user-area-nombre">
                {usuarioActual?.nombre || "Usuario"}
              </span>

              <span className="user-area-rol">
                {usuarioActual?.rol || ""}
                {cuadrillaUsuario ? ` · ${cuadrillaUsuario}` : ""}
              </span>
            </div>

            <button
              type="button"
              className="user-area-cerrar"
              onClick={cerrarSesion}
              title="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
