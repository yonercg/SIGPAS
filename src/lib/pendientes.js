import * as XLSX from "xlsx";
import { supabase } from "./supabase"; // ajusta la ruta si tu cliente está en otro lado

// ---------- Configuración de columnas ----------
export const RETIE_COLUMNS = [
  { key: "item", label: "ITEM", excel: "ITEM" },
  { key: "fecha", label: "FECHA", excel: "FECHA", date: true },
  { key: "actividad", label: "ACTIVIDAD", excel: "ACTIVIDAD" },
  { key: "responsable", label: "RESPONSABLE", excel: "RESPONSABLE" },
  { key: "subestacion", label: "SUBESTACIÓN", excel: "SUBESTACIÓN" },
  { key: "zona", label: "ZONA", excel: "ZONA" },
  { key: "bahia", label: "BAHÍA", excel: "BAHÍA" },
  { key: "equipo", label: "EQUIPO", excel: "EQUIPO" },
  { key: "comentario", label: "COMENTARIO", excel: "COMENTARIO" },
  { key: "tipo", label: "TIPO", excel: "TIPO" },
  { key: "clasificacion", label: "CLASIFICACIÓN", excel: "CLASIFICACIÓN" },
  {
    key: "propuesta_solucion",
    label: "PROPUESTA SOLUCIÓN",
    excel: "PROPUESTA SOLUCIÓN",
  },
  { key: "estado", label: "ESTADO", excel: "ESTADO" },
  {
    key: "fecha_ejecucion",
    label: "FECHA EJECUCIÓN",
    excel: "FECHA EJECUCIÓN",
    date: true,
  },
  {
    key: "comentario_ejecucion",
    label: "COMENTARIO EJECUCIÓN",
    excel: "COMENTARIO EJECUCIÓN",
  },
  {
    key: "responsable_ejecucion",
    label: "RESPONSABLE EJECUCIÓN",
    excel: "RESPONSABLE EJECUCIÓN",
  },
  {
    key: "reporte_ejecucion",
    label: "REPORTE EJECUCIÓN",
    excel: "REPORTE EJECUCIÓN",
  },
];

export const ANOMALIAS_COLUMNS = [
  { key: "num", label: "#", excel: "#" },
  { key: "fecha", label: "FECHA", excel: "FECHA", date: true },
  { key: "cuadrilla", label: "CUADRILLA", excel: "CUADRILLA" },
  { key: "actividad", label: "ACTIVIDAD", excel: "ACTIVIDAD" },
  { key: "subestacion", label: "SUBESTACIÓN", excel: "SUBESTACIÓN" },
  { key: "zona", label: "ZONA", excel: "ZONA" },
  { key: "equipo", label: "EQUIPO", excel: "EQUIPO" },
  { key: "estado", label: "ESTADO", excel: "ESTADO" },
  { key: "accion", label: "ACCIÓN", excel: "ACCIÓN" },
  { key: "comentario_1", label: "COMENTARIO 1", excel: "COMENTARIO 1" },
  { key: "tipo", label: "TIPO", excel: "TIPO" },
  {
    key: "reporte_anomalia",
    label: "REPORTE DE ANOMALIA",
    excel: "REPORTE DE ANOMALIA",
  },
  {
    key: "propuesta_solucion_1",
    label: "PROPUESTA DE SOLUCION 1",
    excel: "PROPUESTA DE SOLUCION 1",
  },
  { key: "accion_2", label: "ACCIÓN (2)", excel: "ACCIÓN" },
  {
    key: "fecha_ejecucion",
    label: "FECHA DE EJECUCION",
    excel: "FECHA DE EJECUCION",
    date: true,
  },
  {
    key: "comentario_ejecucion",
    label: "COMENTARIO EJECUCIÓN",
    excel: "COMENTARIO EJECUCIÓN",
  },
  {
    key: "reporte_ejecucion",
    label: "REPORTE DE EJECUCIÓN",
    excel: "REPORTE DE EJECUCIÓN",
  },
];

export function getColumns(tipo) {
  return tipo === "retie" ? RETIE_COLUMNS : ANOMALIAS_COLUMNS;
}

export function getTableName(tipo) {
  return tipo === "retie" ? "pendientes_retie" : "pendientes_anomalias";
}

// ---------- Utilidades ----------
function excelSerialToISO(serial) {
  // Epoch de Excel (con corrección por bug de 1900)
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 86400000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return excelSerialToISO(value);
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m1 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  return null;
}

// ---------- Importar Excel ----------
export async function importarExcel(file, tipo) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: false,
  });
  if (rows.length < 2)
    throw new Error("El archivo no contiene filas de datos.");

  const columns = getColumns(tipo);
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const hasData = row.some(
      (cell) =>
        cell !== null && cell !== undefined && String(cell).trim() !== "",
    );
    if (!hasData) continue; // salta filas vacías (incluye las de relleno al final)

    const rec = {};
    columns.forEach((col, i) => {
      let val = row[i];
      if (col.date) {
        val = parseDate(val);
      } else if (val === null || val === undefined) {
        val = null;
      } else if (typeof val === "string") {
        const t = val.trim();
        val = t === "" ? null : t;
      } else {
        val = String(val);
      }
      rec[col.key] = val;
    });
    records.push(rec);
  }

  return records;
}

// ---------- Insertar en bloques ----------
export async function insertarPendientes(tipo, records, userId) {
  const table = getTableName(tipo);
  const payload = records.map((r) => ({ ...r, created_by: userId ?? null }));
  const BATCH = 500;
  let insertados = 0;

  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
    insertados += batch.length;
  }
  return insertados;
}

// ---------- Descargar Excel ----------
export function exportarPendientes(tipo, data) {
  const columns = getColumns(tipo);
  const headers = columns.map((c) => c.label);
  const rows = [headers];

  data.forEach((row) => {
    rows.push(
      columns.map((col) => {
        const v = row[col.key];
        return v === null || v === undefined ? "" : v;
      }),
    );
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    tipo === "retie" ? "RETIE" : "ANOMALIAS",
  );

  const filename = `pendientes_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
