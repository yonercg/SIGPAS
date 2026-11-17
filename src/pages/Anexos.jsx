import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActividades } from "../context/ActividadesContext";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import "./Anexos.css";

const STORAGE_BUCKET = "sigpas-documentos";
const TABLA_ANEXOS = "anexos";
const MAX_DIMENSION_IMG = 1600;
const CALIDAD_JPEG = 0.75;
const TAMANO_ADVERTENCIA_MB = 200;

// ============================================================
// HELPERS
// ============================================================

function generarIdAnexo() {
  return `ANX-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function formatearTamaño(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  const d = new Date(fechaISO);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obtenerExtension(nombre) {
  const partes = String(nombre || "").split(".");
  return partes.length > 1 ? partes.pop().toLowerCase() : "bin";
}

function quitarExtension(nombre) {
  return String(nombre || "").replace(/\.[^.]+$/, "");
}

function obtenerInfoTipo(tipo, nombre) {
  const t = String(tipo || "").toLowerCase();
  const ext = obtenerExtension(nombre);

  if (
    t.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)
  ) {
    return { icono: "🖼️", clase: "anexo-icono-img", etiqueta: "Imagen" };
  }
  if (t === "application/pdf" || ext === "pdf") {
    return { icono: "📕", clase: "anexo-icono-pdf", etiqueta: "PDF" };
  }
  if (
    t.includes("sheet") ||
    t.includes("excel") ||
    ["xls", "xlsx", "csv"].includes(ext)
  ) {
    return { icono: "📊", clase: "anexo-icono-excel", etiqueta: "Excel" };
  }
  if (
    t.includes("word") ||
    t.includes("document") ||
    ["doc", "docx"].includes(ext)
  ) {
    return { icono: "📘", clase: "anexo-icono-word", etiqueta: "Word" };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return { icono: "🗜️", clase: "anexo-icono-zip", etiqueta: "Comprimido" };
  }
  if (t.startsWith("video/")) {
    return { icono: "🎬", clase: "anexo-icono-video", etiqueta: "Video" };
  }
  if (t.startsWith("audio/")) {
    return { icono: "🎵", clase: "anexo-icono-audio", etiqueta: "Audio" };
  }
  if (["txt", "md", "log", "json", "xml"].includes(ext)) {
    return { icono: "📝", clase: "anexo-icono-txt", etiqueta: "Texto" };
  }
  return { icono: "📎", clase: "anexo-icono-file", etiqueta: "Archivo" };
}

// ============================================================
// COMPRESIÓN DE IMÁGENES → JPEG
// ============================================================

function comprimirImagenAnexo(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION_IMG || height > MAX_DIMENSION_IMG) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION_IMG) / width);
            width = MAX_DIMENSION_IMG;
          } else {
            width = Math.round((width * MAX_DIMENSION_IMG) / height);
            height = MAX_DIMENSION_IMG;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            // Si el JPEG comprimido pesa MÁS que el original (raro en PNG
            // muy optimizados), conservamos el original.
            if (blob.size >= file.size) return resolve(file);
            resolve(blob);
          },
          "image/jpeg",
          CALIDAD_JPEG,
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ============================================================
// SUPABASE: STORAGE + TABLA
// ============================================================

async function subirArchivoAStorage(anexoId, actividadId, archivo, nombre) {
  const ext = obtenerExtension(nombre);
  const path = `anexos/${actividadId}/${anexoId}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, archivo, {
      contentType: archivo.type || "application/octet-stream",
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) throw error;
  return path;
}

async function eliminarArchivoDeStorage(path) {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.warn("No se pudo eliminar el archivo:", error);
}

async function cargarAnexosDeActividad(actividadId) {
  const { data, error } = await supabase
    .from(TABLA_ANEXOS)
    .select("*")
    .eq("actividad_id", actividadId)
    .order("fecha_subida", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function guardarMetadataAnexo(anexo) {
  const { error } = await supabase.from(TABLA_ANEXOS).insert(anexo);
  if (error) throw error;
}

async function eliminarMetadataAnexo(id) {
  const { error } = await supabase.from(TABLA_ANEXOS).delete().eq("id", id);
  if (error) throw error;
}

function obtenerUrlPublica(path) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function descargarDesdeUrl(url, nombre) {
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.target = "_blank";
  enlace.rel = "noopener";
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
}

// ============================================================
// COMPONENTE
// ============================================================

function Anexos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { esCuadrilla, cuadrillaUsuario } = useAuth();
  const { actividades } = useActividades();

  const actividadId = searchParams.get("actividadId");

  const [anexos, setAnexos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState({
    actual: 0,
    total: 0,
    nombre: "",
  });
  const [error, setError] = useState("");
  const [anexoAEliminar, setAnexoAEliminar] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);

  const inputRef = useRef(null);

  const actividad = useMemo(
    () => actividades.find((a) => String(a.id) === String(actividadId)) || null,
    [actividades, actividadId],
  );

  // ---------- Validación de acceso ----------
  useEffect(() => {
    if (!actividadId) {
      navigate("/actividades");
      return;
    }
    if (esCuadrilla && actividad) {
      const cid = actividad.cuadrillaId || actividad.cuadrilla || "";
      if (String(cid) !== String(cuadrillaUsuario)) {
        navigate("/actividades");
      }
    }
  }, [actividadId, actividad, esCuadrilla, cuadrillaUsuario, navigate]);

  // ---------- Cargar anexos ----------
  useEffect(() => {
    if (!actividadId) return;
    let activo = true;

    (async () => {
      try {
        setCargando(true);
        setError("");
        const lista = await cargarAnexosDeActividad(actividadId);
        if (activo) setAnexos(lista);
      } catch (err) {
        console.error("Error cargando anexos:", err);
        if (activo) {
          setError("No se pudieron cargar los anexos. Verifica tu conexión.");
        }
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [actividadId]);

  // ---------- Subir archivos ----------
  async function subirArchivos(files) {
    if (!files || files.length === 0) return;
    if (!actividadId) return;
    if (subiendo) return;

    setSubiendo(true);
    setError("");
    setProgreso({ actual: 0, total: files.length, nombre: "" });

    const nuevos = [];
    const errores = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgreso({
        actual: i + 1,
        total: files.length,
        nombre: file.name,
      });

      try {
        let archivoFinal = file;
        let nombreFinal = file.name;
        let tipoFinal = file.type || "application/octet-stream";

        // Comprimir imágenes → JPEG
        if (file.type.startsWith("image/")) {
          const comprimido = await comprimirImagenAnexo(file);
          if (comprimido && comprimido !== file) {
            archivoFinal = comprimido;
            nombreFinal = `${quitarExtension(file.name)}.jpg`;
            tipoFinal = "image/jpeg";
          }
        }

        const anexoId = generarIdAnexo();
        const storagePath = await subirArchivoAStorage(
          anexoId,
          actividadId,
          archivoFinal,
          nombreFinal,
        );

        const nuevoAnexo = {
          id: anexoId,
          actividad_id: actividadId,
          nombre: nombreFinal,
          tipo: tipoFinal,
          tamaño: archivoFinal.size,
          storage_path: storagePath,
          fecha_subida: new Date().toISOString(),
        };

        await guardarMetadataAnexo(nuevoAnexo);
        nuevos.push(nuevoAnexo);
      } catch (err) {
        console.error(`Error subiendo "${file.name}":`, err);
        errores.push(file.name);
      }
    }

    setAnexos((prev) => [...nuevos, ...prev]);
    setSubiendo(false);
    setProgreso({ actual: 0, total: 0, nombre: "" });

    if (errores.length > 0) {
      setError(
        `No se pudieron subir: ${errores.join(", ")}. Intenta de nuevo.`,
      );
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  // ---------- Handlers ----------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    subirArchivos(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setArrastrando(false);
    const files = Array.from(e.dataTransfer.files || []);
    subirArchivos(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!arrastrando) setArrastrando(true);
  };

  const handleDragLeave = () => setArrastrando(false);

  const handleDescargar = (anexo) => {
    const url = obtenerUrlPublica(anexo.storage_path);
    descargarDesdeUrl(url, anexo.nombre);
  };

  const handleEliminarConfirmado = async () => {
    if (!anexoAEliminar) return;
    try {
      await eliminarArchivoDeStorage(anexoAEliminar.storage_path);
      await eliminarMetadataAnexo(anexoAEliminar.id);
      setAnexos((prev) => prev.filter((a) => a.id !== anexoAEliminar.id));
      setAnexoAEliminar(null);
    } catch (err) {
      console.error("Error eliminando anexo:", err);
      setError("No se pudo eliminar el anexo. Intenta de nuevo.");
    }
  };

  const volver = () => navigate("/actividades");

  // ---------- Render ----------
  if (!actividadId) return null;

  return (
    <div className="anexos-page">
      {/* ENCABEZADO */}
      <div className="anexos-title-card">
        <div className="anexos-header">
          <div>
            <span className="anexos-etiqueta">SIGPAS · ANEXOS</span>
            <h1>Anexos de la Actividad</h1>
            <p>
              Documentos, imágenes, hojas de cálculo y cualquier archivo adjunto
              a la actividad.
            </p>
          </div>
          <button
            type="button"
            className="btn-volver-actividades"
            onClick={volver}
          >
            ← Volver a Actividades
          </button>
        </div>
      </div>

      {/* INFORMACIÓN DE LA ACTIVIDAD */}
      {actividad && (
        <div className="anexos-actividad-card">
          <span className="anexos-actividad-titulo">
            Información de la Actividad
          </span>
          <div className="anexos-actividad-grid">
            <div className="anexos-actividad-item">
              <span>Actividad</span>
              <strong>{actividad.nombre || actividad.actividad || "—"}</strong>
            </div>
            <div className="anexos-actividad-item">
              <span>Código OT</span>
              <strong>{actividad.codigoOT || "—"}</strong>
            </div>
            <div className="anexos-actividad-item">
              <span>Subestación</span>
              <strong>{actividad.subestacion || "—"}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ZONA DE SUBIDA */}
      <div className="anexos-upload-card">
        <div
          className={`anexos-dropzone ${
            arrastrando ? "anexos-dropzone-activo" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !subiendo && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!subiendo) inputRef.current?.click();
            }
          }}
          aria-disabled={subiendo}
        >
          <div className="anexos-dropzone-icono">{subiendo ? "⏳" : "📎"}</div>
          <div className="anexos-dropzone-titulo">
            {subiendo
              ? `Subiendo ${progreso.actual} de ${progreso.total}...`
              : "Arrastra archivos aquí o haz clic para seleccionar"}
          </div>
          <div className="anexos-dropzone-descripcion">
            {subiendo
              ? progreso.nombre
              : "Imágenes (se convierten a JPEG y se optimizan), PDF, Excel, Word, ZIP, video y más. Sin límite de tamaño."}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileChange}
            disabled={subiendo}
            aria-label="Seleccionar archivos para anexar"
          />
        </div>

        {subiendo && progreso.total > 0 && (
          <div className="anexos-progreso-contenedor">
            <div
              className="anexos-progreso"
              role="progressbar"
              aria-valuenow={progreso.actual}
              aria-valuemin={0}
              aria-valuemax={progreso.total}
            >
              <div
                className="anexos-progreso-fill"
                style={{
                  width: `${(progreso.actual / progreso.total) * 100}%`,
                }}
              />
            </div>
            <div className="anexos-progreso-texto">
              {progreso.actual} / {progreso.total} · {progreso.nombre}
            </div>
          </div>
        )}

        {error && (
          <div className="anexos-error" role="alert">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* LISTA DE ANEXOS */}
      <div className="anexos-lista-card">
        <div className="anexos-lista-header">
          <h2>
            Archivos adjuntos{" "}
            <span className="anexos-contador">
              ({anexos.length} {anexos.length === 1 ? "archivo" : "archivos"})
            </span>
          </h2>
        </div>

        {cargando ? (
          <div className="anexos-vacio">
            <div className="anexos-vacio-icono">⏳</div>
            <h3>Cargando anexos...</h3>
          </div>
        ) : anexos.length === 0 ? (
          <div className="anexos-vacio">
            <div className="anexos-vacio-icono">📂</div>
            <h3>No hay anexos todavía</h3>
            <p>
              Sube el primer archivo usando la zona de arriba. Acepta imágenes,
              documentos, hojas de cálculo y más.
            </p>
          </div>
        ) : (
          <div className="anexos-tabla-contenedor">
            <table className="anexos-tabla">
              <thead>
                <tr>
                  <th className="anexos-col-icono"></th>
                  <th className="anexos-col-nombre">Nombre</th>
                  <th className="anexos-col-tipo">Tipo</th>
                  <th className="anexos-col-tamaño">Tamaño</th>
                  <th className="anexos-col-fecha">Subido</th>
                  <th className="anexos-col-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {anexos.map((anexo) => {
                  const info = obtenerInfoTipo(anexo.tipo, anexo.nombre);
                  const grande =
                    anexo.tamaño > TAMANO_ADVERTENCIA_MB * 1024 * 1024;

                  return (
                    <tr key={anexo.id}>
                      <td className="anexos-col-icono">
                        <span className={`anexo-icono ${info.clase}`}>
                          {info.icono}
                        </span>
                      </td>
                      <td className="anexos-col-nombre">
                        <span className="anexo-nombre" title={anexo.nombre}>
                          {anexo.nombre}
                        </span>
                      </td>
                      <td className="anexos-col-tipo">
                        <span className="anexo-tipo">{info.etiqueta}</span>
                      </td>
                      <td
                        className={`anexos-col-tamaño ${
                          grande ? "anexo-tamaño-grande" : ""
                        }`}
                      >
                        {formatearTamaño(anexo.tamaño)}
                      </td>
                      <td className="anexos-col-fecha">
                        {formatearFecha(anexo.fecha_subida)}
                      </td>
                      <td className="anexos-col-acciones">
                        <button
                          type="button"
                          className="btn-anexo btn-anexo-descargar"
                          onClick={() => handleDescargar(anexo)}
                          title="Descargar"
                        >
                          ⬇ Descargar
                        </button>
                        <button
                          type="button"
                          className="btn-anexo btn-anexo-eliminar"
                          onClick={() => setAnexoAEliminar(anexo)}
                          title="Eliminar"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE ELIMINACIÓN */}
      {anexoAEliminar && (
        <div
          className="anexos-modal-overlay"
          onClick={() => setAnexoAEliminar(null)}
        >
          <div className="anexos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="anexos-modal-icono">⚠️</div>
            <h3>¿Eliminar este anexo?</h3>
            <p>
              Se eliminará <strong>{anexoAEliminar.nombre}</strong> de forma
              permanente. Esta acción no se puede deshacer.
            </p>
            <div className="anexos-modal-botones">
              <button
                type="button"
                className="btn-anexo-cancelar"
                onClick={() => setAnexoAEliminar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-anexo-confirmar"
                onClick={handleEliminarConfirmado}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Anexos;
