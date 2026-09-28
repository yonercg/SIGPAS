import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { obtenerPrimeraRutaPermitida } from "../data/permisos";

export default function RutaProtegida({ pagina, children }) {
  const { usuarioActual, cargando, tienePermiso } = useAuth();

  if (cargando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: 14,
          fontFamily: "inherit",
        }}
      >
        Cargando…
      </div>
    );
  }

  if (!usuarioActual) {
    return <Navigate to="/login" replace />;
  }

  if (pagina && !tienePermiso(pagina)) {
    // Si no tiene permiso para esa página, se envía a la primera que sí pueda ver.
    const alternativa = obtenerPrimeraRutaPermitida(usuarioActual.permisos);
    return <Navigate to={alternativa} replace />;
  }

  return children;
}
