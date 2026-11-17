import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Pendientes.css";

const COLORES_TORTA = [
  "#ef4444", // Rojo
  "#f97316", // Naranja
  "#eab308", // Amarillo
  "#3b82f6", // Azul
  "#10b981", // Verde
  "#8b5cf6", // Morado
  "#64748b", // Gris
];

export default function Pendientes() {
  const [loading, setLoading] = useState(true);
  const [anomalias, setAnomalias] = useState([]);
  const [retie, setRetie] = useState([]);

  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const [resAnom, resRetie] = await Promise.all([
          supabase
            .from("pendientes_anomalias")
            .select("fecha, accion_2, estado, subestacion"),
          // Se asegura de traer 'fecha_ejecucion' para el gráfico de RETIE
          supabase
            .from("pendientes_retie")
            .select(
              "fecha, fecha_ejecucion, estado, clasificacion, subestacion",
            ),
        ]);

        if (resAnom.data) setAnomalias(resAnom.data);
        if (resRetie.data) setRetie(resRetie.data);
      } catch (err) {
        console.error("Error cargando indicadores:", err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  // ==========================================
  // LÓGICA PARA ANOMALÍAS
  // ==========================================
  const datosAnomPorAnio = useMemo(() => {
    const agrupado = {};
    anomalias.forEach((row) => {
      if (!row.fecha) return;
      const anio = String(row.fecha).substring(0, 4);
      if (!agrupado[anio])
        agrupado[anio] = { anio, pendientes: 0, ejecutados: 0 };

      const accion = String(row.accion_2 || "")
        .toUpperCase()
        .trim();
      if (accion === "PENDIENTE") agrupado[anio].pendientes += 1;
      if (accion === "EJECUTADO") agrupado[anio].ejecutados += 1;
    });
    return Object.values(agrupado).sort((a, b) => a.anio.localeCompare(b.anio));
  }, [anomalias]);

  const totalAnomPendientes = datosAnomPorAnio.reduce(
    (acc, curr) => acc + curr.pendientes,
    0,
  );
  const totalAnomEjecutados = datosAnomPorAnio.reduce(
    (acc, curr) => acc + curr.ejecutados,
    0,
  );
  const maxAnomAnio = Math.max(
    ...datosAnomPorAnio.flatMap((d) => [d.pendientes, d.ejecutados]),
    1,
  );

  const datosAnomEstados = useMemo(() => {
    const conteo = {};
    anomalias.forEach((row) => {
      if (
        String(row.accion_2 || "")
          .toUpperCase()
          .trim() === "PENDIENTE"
      ) {
        const estado = row.estado || "SIN ESTADO";
        conteo[estado] = (conteo[estado] || 0) + 1;
      }
    });
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);
    return Object.keys(conteo)
      .map((nombre, i) => ({
        nombre,
        cantidad: conteo[nombre],
        porcentaje: total > 0 ? (conteo[nombre] / total) * 100 : 0,
        color: COLORES_TORTA[i % COLORES_TORTA.length],
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [anomalias]);

  const datosAnomSubestaciones = useMemo(() => {
    const conteo = {};
    anomalias.forEach((row) => {
      if (
        String(row.accion_2 || "")
          .toUpperCase()
          .trim() === "PENDIENTE"
      ) {
        const sub = row.subestacion || "SIN SUBESTACIÓN";
        conteo[sub] = (conteo[sub] || 0) + 1;
      }
    });
    return Object.keys(conteo)
      .map((nombre) => ({ nombre, cantidad: conteo[nombre] }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [anomalias]);

  const gradienteAnom = useMemo(() => {
    const total = datosAnomEstados.reduce((a, b) => a + b.cantidad, 0);
    if (total === 0) return "#e2e8f0";
    let acc = 0;
    const seg = datosAnomEstados.map((item) => {
      const start = acc;
      acc += item.porcentaje;
      return `${item.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${seg.join(", ")})`;
  }, [datosAnomEstados]);

  // ==========================================
  // LÓGICA PARA RETIE (CORREGIDA)
  // ==========================================
  const datosRetiePorAnio = useMemo(() => {
    const agrupado = {};
    retie.forEach((row) => {
      const estado = String(row.estado || "")
        .toUpperCase()
        .trim();

      // 1. PENDIENTES: Toma la columna 'fecha' si el estado es PENDIENTE
      if (estado === "PENDIENTE" && row.fecha) {
        const anio = String(row.fecha).substring(0, 4);
        if (!agrupado[anio])
          agrupado[anio] = { anio, pendientes: 0, ejecutados: 0 };
        agrupado[anio].pendientes += 1;
      }

      // 2. EJECUTADOS: Toma la columna 'fecha_ejecucion' si el estado es EJECUTADO
      if (estado === "EJECUTADO" && row.fecha_ejecucion) {
        const anio = String(row.fecha_ejecucion).substring(0, 4);
        if (!agrupado[anio])
          agrupado[anio] = { anio, pendientes: 0, ejecutados: 0 };
        agrupado[anio].ejecutados += 1;
      }
    });
    return Object.values(agrupado).sort((a, b) => a.anio.localeCompare(b.anio));
  }, [retie]);

  const totalRetiePendientes = datosRetiePorAnio.reduce(
    (acc, curr) => acc + curr.pendientes,
    0,
  );
  const totalRetieEjecutados = datosRetiePorAnio.reduce(
    (acc, curr) => acc + curr.ejecutados,
    0,
  );
  const maxRetieAnio = Math.max(
    ...datosRetiePorAnio.flatMap((d) => [d.pendientes, d.ejecutados]),
    1,
  );

  const datosRetieRiesgos = useMemo(() => {
    const conteo = {};
    retie.forEach((row) => {
      if (
        String(row.estado || "")
          .toUpperCase()
          .trim() === "PENDIENTE"
      ) {
        const riesgo = row.clasificacion || "SIN CLASIFICACIÓN";
        conteo[riesgo] = (conteo[riesgo] || 0) + 1;
      }
    });
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);
    return Object.keys(conteo)
      .map((nombre, i) => ({
        nombre,
        cantidad: conteo[nombre],
        porcentaje: total > 0 ? (conteo[nombre] / total) * 100 : 0,
        color: COLORES_TORTA[i % COLORES_TORTA.length],
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [retie]);

  const datosRetieSubestaciones = useMemo(() => {
    const conteo = {};
    retie.forEach((row) => {
      if (
        String(row.estado || "")
          .toUpperCase()
          .trim() === "PENDIENTE"
      ) {
        const sub = row.subestacion || "SIN SUBESTACIÓN";
        conteo[sub] = (conteo[sub] || 0) + 1;
      }
    });
    return Object.keys(conteo)
      .map((nombre) => ({ nombre, cantidad: conteo[nombre] }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [retie]);

  const gradienteRetie = useMemo(() => {
    const total = datosRetieRiesgos.reduce((a, b) => a + b.cantidad, 0);
    if (total === 0) return "#e2e8f0";
    let acc = 0;
    const seg = datosRetieRiesgos.map((item) => {
      const start = acc;
      acc += item.porcentaje;
      return `${item.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${seg.join(", ")})`;
  }, [datosRetieRiesgos]);

  // ==========================================
  // COMPONENTES REUTILIZABLES
  // ==========================================
  const renderBarChart = (data, maxVal) => (
    <div className="bar-chart-container">
      {data.map((d) => (
        <div className="bar-group" key={d.anio}>
          <div className="bars-wrapper">
            <div className="bar-item">
              <span className="bar-value">{d.pendientes}</span>
              <div
                className="bar bar-pendiente"
                style={{ height: `${(d.pendientes / maxVal) * 100}%` }}
              />
            </div>
            <div className="bar-item">
              <span className="bar-value">{d.ejecutados}</span>
              <div
                className="bar bar-ejecutado"
                style={{ height: `${(d.ejecutados / maxVal) * 100}%` }}
              />
            </div>
          </div>
          <span className="bar-label">{d.anio}</span>
        </div>
      ))}
      {data.length === 0 && <p className="empty-chart">No hay datos.</p>}
    </div>
  );

  const renderPieChart = (data, gradiente, total) => (
    <div className="pie-chart-layout">
      <div className="pie-chart" style={{ background: gradiente }}>
        <div className="pie-chart-center">
          <strong>{total}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="pie-chart-legend">
        {data.map((item) => (
          <div className="pie-legend-item" key={item.nombre}>
            <span className="legend-dot" style={{ background: item.color }} />
            <div className="pie-legend-info">
              <span className="pie-legend-name">{item.nombre}</span>
              <div className="pie-legend-stats">
                <strong>{item.porcentaje.toFixed(0)}%</strong>
                <small>({item.cantidad})</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTable = (data) => (
    <div className="table-scroll-container">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>SUBESTACIÓN</th>
            <th style={{ textAlign: "right" }}>PENDIENTES</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.nombre}>
              <td>{row.nombre}</td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>
                {row.cantidad}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="empty-chart">No hay pendientes.</p>}
    </div>
  );

  return (
    <div className="pendientes-landing">
      {/* HEADER PROFESIONAL BLANCO */}
      <header className="pendientes-header-card">
        <h1>Gestión de Pendientes</h1>
        <p>Selecciona el formato que deseas consultar o administrar.</p>
      </header>

      {/* BOTONES DE ACCESO */}
      <div className="pendientes-cards">
        <Link to="/pendientes/anomalias" className="pendientes-card">
          <span className="pendientes-card-icon">⚠️</span>
          <span className="pendientes-card-title">ANOMALIAS</span>
          <span className="pendientes-card-desc">
            Reportes de anomalías por subestación, cuadrilla y equipo.
          </span>
          <span className="pendientes-card-cta">Abrir →</span>
        </Link>

        <Link to="/pendientes/retie" className="pendientes-card">
          <span className="pendientes-card-icon">📋</span>
          <span className="pendientes-card-title">RETIE</span>
          <span className="pendientes-card-desc">
            Hallazgos y cumplimiento RETIE por subestación y bahía.
          </span>
          <span className="pendientes-card-cta">Abrir →</span>
        </Link>
      </div>

      {loading ? (
        <div className="loading-state">Cargando tablero de indicadores...</div>
      ) : (
        <>
          {/* ================================================= */}
          {/* TABLERO DE ANOMALÍAS */}
          {/* ================================================= */}
          <div className="module-dashboard">
            <div className="module-header">
              <span className="module-label">INDICADORES</span>
              <h2>Tablero de ANOMALÍAS</h2>
            </div>

            <div className="module-grid">
              <div className="charts-col">
                <div className="chart-card">
                  <div className="chart-header">
                    <h3>Histórico: Pendientes vs Ejecutados</h3>
                    <div className="chart-totals">
                      <span className="total-pill total-pendiente">
                        Pendientes: {totalAnomPendientes}
                      </span>
                      <span className="total-pill total-ejecutado">
                        Ejecutados: {totalAnomEjecutados}
                      </span>
                    </div>
                  </div>
                  {renderBarChart(datosAnomPorAnio, maxAnomAnio)}
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span
                        className="legend-dot"
                        style={{ background: "#ef4444" }}
                      />
                      <span>Pendientes</span>
                    </div>
                    <div className="legend-item">
                      <span
                        className="legend-dot"
                        style={{ background: "#10b981" }}
                      />
                      <span>Ejecutados</span>
                    </div>
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-header">
                    <h3>Acciones Pendientes (Por Estado)</h3>
                    <strong className="chart-total-number">
                      {totalAnomPendientes}
                    </strong>
                  </div>
                  {totalAnomPendientes === 0 ? (
                    <p className="empty-chart">No hay datos.</p>
                  ) : (
                    renderPieChart(
                      datosAnomEstados,
                      gradienteAnom,
                      totalAnomPendientes,
                    )
                  )}
                </div>
              </div>

              <div className="table-col">
                <div className="chart-card table-card">
                  <div className="chart-header">
                    <h3>Anomalías Pendientes por Subestación</h3>
                  </div>
                  {renderTable(datosAnomSubestaciones)}
                </div>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* TABLERO DE RETIE */}
          {/* ================================================= */}
          <div className="module-dashboard">
            <div className="module-header">
              <span className="module-label">INDICADORES</span>
              <h2>Tablero RETIE</h2>
            </div>

            <div className="module-grid">
              <div className="charts-col">
                <div className="chart-card">
                  <div className="chart-header">
                    <h3>Histórico: Pendientes vs Ejecutados</h3>
                    <div className="chart-totals">
                      <span className="total-pill total-pendiente">
                        Pendientes: {totalRetiePendientes}
                      </span>
                      <span className="total-pill total-ejecutado">
                        Ejecutados: {totalRetieEjecutados}
                      </span>
                    </div>
                  </div>
                  {renderBarChart(datosRetiePorAnio, maxRetieAnio)}
                  <div className="chart-legend">
                    <div className="legend-item">
                      <span
                        className="legend-dot"
                        style={{ background: "#ef4444" }}
                      />
                      <span>Pendientes</span>
                    </div>
                    <div className="legend-item">
                      <span
                        className="legend-dot"
                        style={{ background: "#10b981" }}
                      />
                      <span>Ejecutados</span>
                    </div>
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-header">
                    <h3>Riesgos Pendientes (Por Clasificación)</h3>
                    <strong className="chart-total-number">
                      {totalRetiePendientes}
                    </strong>
                  </div>
                  {totalRetiePendientes === 0 ? (
                    <p className="empty-chart">No hay datos.</p>
                  ) : (
                    renderPieChart(
                      datosRetieRiesgos,
                      gradienteRetie,
                      totalRetiePendientes,
                    )
                  )}
                </div>
              </div>

              <div className="table-col">
                <div className="chart-card table-card">
                  <div className="chart-header">
                    <h3>Retie Pendientes por Subestación</h3>
                  </div>
                  {renderTable(datosRetieSubestaciones)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
