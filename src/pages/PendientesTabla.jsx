import { useCallback, useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { registrarAuditoria } from "../lib/auditoria";
import { puedeEditarPendientes } from "../data/permisos";
import {
  getColumns,
  getTableName,
  importarExcel,
  insertarPendientes,
  exportarPendientes,
} from "../lib/pendientes";
import "./Pendientes.css";

const TITULOS = {
  anomalias: "Pendientes · ANOMALIAS",
  retie: "Pendientes · RETIE",
};

// Columnas que tendrán la función de expandir con doble clic
const COLUMNAS_EXPANDIBLES = {
  anomalias: ["comentario_1", "propuesta_solucion_1", "comentario_ejecucion"],
  retie: ["comentario", "propuesta_solucion", "comentario_ejecucion"],
};

function fmtCell(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function PendientesTabla({ tipo }) {
  const { usuarioActual } = useAuth();
  const rol =
    usuarioActual?.rol ??
    usuarioActual?.role ??
    usuarioActual?.user_metadata?.rol ??
    "";
  const puedeEditar = puedeEditarPendientes(rol);

  const columnas = getColumns(tipo);
  const table = getTableName(tipo);
  const titulo = TITULOS[tipo] ?? "Pendientes";
  const expandibles = COLUMNAS_EXPANDIBLES[tipo] || [];

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [filtros, setFiltros] = useState({});

  // 👇 Estado para el recuadro de doble clic
  const [modalCell, setModalCell] = useState(null);

  const columnasFiltrables =
    tipo === "anomalias"
      ? ["accion_2", "zona", "subestacion", "equipo", "estado"]
      : ["estado", "subestacion", "zona", "equipo"];

  useEffect(() => {
    setFiltros({});
  }, [tipo]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: rows, error: err } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: true });
      if (err) throw err;
      setData(rows || []);
    } catch (e) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [table]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const opcionesFiltro = useMemo(() => {
    const opciones = {};
    columnasFiltrables.forEach((colKey) => {
      const values = new Set(
        data.map((row) => row[colKey]).filter((v) => v !== null && v !== ""),
      );
      opciones[colKey] = Array.from(values).sort();
    });
    return opciones;
  }, [data, columnasFiltrables]);

  const dataFiltrada = useMemo(() => {
    return data.filter((row) => {
      return Object.entries(filtros).every(([key, val]) => {
        if (!val) return true;
        return String(row[key]).toLowerCase() === String(val).toLowerCase();
      });
    });
  }, [data, filtros]);

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;

    const ok = window.confirm(
      `⚠️ ATENCIÓN: Vas a REEMPLAZAR todos los datos de ${tipo.toUpperCase()}.\n\n` +
        `Se eliminarán los ${data.length} registros actuales y se cargarán los nuevos del Excel.\n\n` +
        `¿Deseas continuar?`,
    );
    if (!ok) return;

    setImporting(true);
    setError("");
    try {
      const records = await importarExcel(file, tipo);
      if (records.length === 0) {
        setError("No se detectaron filas con datos en el archivo.");
        return;
      }

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) throw deleteError;

      const n = await insertarPendientes(tipo, records, usuarioActual?.id);

      await registrarAuditoria(usuarioActual, "pendientes", "REEMPLAZAR", {
        tipo,
        filas_nuevas: n,
        archivo: file.name,
      });

      await cargar();
      alert(`Reemplazo completo: ${n} filas cargadas exitosamente.`);
    } catch (e) {
      setError(e.message || "Error en la importación");
    } finally {
      setImporting(false);
    }
  };

  const onDownload = () => {
    if (!data.length) return;
    exportarPendientes(tipo, data);
  };

  const abrirForm = () => {
    const base = {};
    columnas.forEach((c) => {
      base[c.key] = "";
    });
    setFormValues(base);
    setShowForm(true);
  };

  const onField = (key, value) =>
    setFormValues((prev) => ({ ...prev, [key]: value }));

  const guardarFila = async () => {
    try {
      const payload = { ...formValues, created_by: usuarioActual?.id ?? null };
      columnas.forEach((c) => {
        if (c.date && !payload[c.key]) payload[c.key] = null;
        if (!c.date && payload[c.key] === "") payload[c.key] = null;
      });
      const { error: err } = await supabase.from(table).insert(payload);
      if (err) throw err;
      await registrarAuditoria(usuarioActual, "pendientes", "CREAR", {
        tipo,
        data: payload,
      });
      setShowForm(false);
      await cargar();
    } catch (e) {
      setError(e.message || "Error al guardar");
    }
  };

  // 👇 Manejo del doble clic en celdas
  const handleCellDoubleClick = (colKey, value, label) => {
    if (expandibles.includes(colKey) && value) {
      setModalCell({ title: label, content: value });
    }
  };

  return (
    <div className="pendientes-page">
      <div className="pendientes-control-panel">
        <header className="pendientes-header">
          <div className="pendientes-title-left">
            <Link to="/pendientes" className="pendientes-back" title="Volver">
              ← Volver
            </Link>
          </div>

          <div className="pendientes-title-center">
            <h1>{titulo}</h1>
          </div>

          <div className="pendientes-actions">
            {puedeEditar && !importing && (
              <label className="btn btn-primary btn-sm">
                Subir Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onImport}
                  hidden
                />
              </label>
            )}
            {importing && (
              <span className="btn btn-primary btn-sm disabled">
                Importando…
              </span>
            )}
            {puedeEditar && (
              <button className="btn btn-sm" onClick={abrirForm}>
                Agregar fila
              </button>
            )}
            <button
              className="btn btn-sm"
              onClick={onDownload}
              disabled={!data.length}
            >
              Descargar Excel
            </button>
            <button className="btn btn-sm" onClick={cargar} disabled={loading}>
              {loading ? "Actualizando…" : "Refrescar"}
            </button>
          </div>
        </header>

        <div className="pendientes-filters-bar">
          {columnasFiltrables.map((colKey) => {
            const colDef = columnas.find((c) => c.key === colKey);
            return (
              <div className="filter-group" key={colKey}>
                <label>{colDef?.label || colKey}</label>
                <select
                  value={filtros[colKey] || ""}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      [colKey]: e.target.value,
                    }))
                  }
                >
                  <option value="">Todos</option>
                  {opcionesFiltro[colKey]?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {Object.values(filtros).some((v) => v !== "") && (
            <button
              className="btn-clear-filters"
              onClick={() => setFiltros({})}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {error && <div className="pendientes-error">{error}</div>}

      <div className="pendientes-table-wrapper">
        <table className="pendientes-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="empty">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && dataFiltrada.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="empty">
                  {data.length === 0
                    ? "No hay registros. Sube un Excel para comenzar."
                    : "No hay resultados para los filtros seleccionados."}
                </td>
              </tr>
            )}
            {dataFiltrada.map((row) => (
              <tr key={row.id}>
                {columnas.map((c) => {
                  const isExpandible = expandibles.includes(c.key);
                  return (
                    <td
                      key={c.key}
                      title={
                        isExpandible
                          ? "Doble clic para ver todo el texto"
                          : fmtCell(row[c.key])
                      }
                      onDoubleClick={() =>
                        handleCellDoubleClick(c.key, row[c.key], c.label)
                      }
                      className={isExpandible ? "cell-expandible" : ""}
                    >
                      {fmtCell(row[c.key])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 👇 MODAL PARA VER EL TEXTO COMPLETO (Doble Clic) */}
      {modalCell && (
        <div className="modal-backdrop" onClick={() => setModalCell(null)}>
          <div className="modal-text-view" onClick={(e) => e.stopPropagation()}>
            <h3>{modalCell.title}</h3>
            <div className="text-content">{modalCell.content}</div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => setModalCell(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Agregar pendiente — {tipo.toUpperCase()}</h2>
            <div className="form-grid">
              {columnas.map((c) => (
                <label key={c.key}>
                  <span>{c.label}</span>
                  <input
                    type={c.date ? "date" : "text"}
                    value={formValues[c.key] ?? ""}
                    onChange={(e) => onField(c.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardarFila}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
