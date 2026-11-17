import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Auditoria.css";

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroPagina, setFiltroPagina] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");

  // 🆕 Función que permite recargas silenciosas (sin spinner)
  const cargarLogs = async (silencioso = false) => {
    if (!silencioso) setCargando(true);

    try {
      const { data, error } = await supabase
        .from("auditoria")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(100); // Límite para que sea rápido

      if (!error) setLogs(data || []);
    } catch (e) {
      console.error("Error cargando auditoría:", e);
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  // 🆕 useEffect con el intervalo de 5 segundos
  useEffect(() => {
    cargarLogs(); // Carga inicial

    const intervalo = setInterval(() => {
      cargarLogs(true); // Recarga silenciosa cada 5s
    }, 5000);

    return () => clearInterval(intervalo); // Limpieza al salir de la página
  }, []);

  const logsFiltrados = logs.filter((log) => {
    const coincidePagina =
      filtroPagina === "Todas" || log.pagina === filtroPagina;
    const texto = busqueda.toLowerCase();
    const coincideBusqueda =
      !texto ||
      log.usuario_nombre?.toLowerCase().includes(texto) ||
      log.accion?.toLowerCase().includes(texto) ||
      JSON.stringify(log.detalles).toLowerCase().includes(texto);
    return coincidePagina && coincideBusqueda;
  });

  return (
    <div className="auditoria-page">
      <div className="auditoria-header-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1>Auditoría del Sistema</h1>
            <p>
              Registro histórico en tiempo real (Actualización automática cada
              5s).
            </p>
          </div>
          <span
            style={{
              fontSize: "12px",
              color: "#10b981",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                background: "#10b981",
                borderRadius: "50%",
                display: "inline-block",
                animation: "pulse 1.5s infinite",
              }}
            ></span>
            En vivo
          </span>
        </div>
      </div>

      <div className="auditoria-filtros">
        <input
          type="text"
          placeholder="Buscar por usuario, acción o detalle..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          value={filtroPagina}
          onChange={(e) => setFiltroPagina(e.target.value)}
        >
          <option value="Todas">Todas las páginas</option>
          <option value="Programación">Programación</option>
          <option value="Plan de Mantenimiento">Plan de Mantenimiento</option>
          <option value="Actividades">Actividades</option>
          <option value="Informes">Informes</option>
          <option value="Órdenes de Trabajo">Órdenes de Trabajo</option>
        </select>
        <button onClick={() => cargarLogs(false)}>Actualizar Ahora</button>
      </div>

      <div className="auditoria-tabla-contenedor">
        {cargando ? (
          <p style={{ padding: "20px", textAlign: "center" }}>
            Cargando registros...
          </p>
        ) : logsFiltrados.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center" }}>
            No hay registros de auditoría.
          </p>
        ) : (
          <table className="auditoria-tabla">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Página</th>
                <th>Acción</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logsFiltrados.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {new Date(log.fecha).toLocaleString("es-CO")}
                  </td>
                  <td>
                    <strong>{log.usuario_nombre}</strong>
                  </td>
                  <td>{log.pagina}</td>
                  <td>
                    <span
                      className={`badge-auditoria badge-${log.accion.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {log.accion}
                    </span>
                  </td>
                  <td>
                    <pre className="auditoria-detalles">
                      {JSON.stringify(log.detalles, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
