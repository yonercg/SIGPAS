import { useEffect, useRef, useState } from "react";
import { useActividades } from "../context/ActividadesContext";
import { supabase } from "../lib/supabase";
import "./PM.css";

const PM_ROW_PLAN = "plan";
const PM_ROW_CONSECUTIVOS = "consecutivos";

const semanas = Array.from({ length: 52 }, (_, indice) => indice + 1);

// =================================================
// GENERAR PM ID
// =================================================

const generarPmId = (anio, actividadesExistentes = [], consecutivos = {}) => {
  const anioNumero = Number(anio);

  if (!anioNumero) {
    return { pmId: "", consecutivos };
  }

  let mayorConsecutivo = Number(consecutivos[anioNumero] || 0);
  const prefijo = `PM-${anioNumero}-`;

  actividadesExistentes.forEach((actividad) => {
    if (!actividad?.pmId) return;

    const pmId = String(actividad.pmId);
    if (!pmId.startsWith(prefijo)) return;

    const parteNumerica = pmId.replace(prefijo, "");
    const consecutivo = Number(parteNumerica);

    if (Number.isInteger(consecutivo) && consecutivo > mayorConsecutivo) {
      mayorConsecutivo = consecutivo;
    }
  });

  const siguienteConsecutivo = mayorConsecutivo + 1;

  return {
    pmId: `${prefijo}${String(siguienteConsecutivo).padStart(6, "0")}`,
    consecutivos: {
      ...consecutivos,
      [anioNumero]: siguienteConsecutivo,
    },
  };
};

// =================================================
// NORMALIZAR PM ID
// =================================================

const normalizarPMId = (valor) =>
  String(valor || "")
    .trim()
    .toUpperCase();

// =================================================
// PREPARAR ACTIVIDADES PM EXISTENTES
// =================================================

const prepararActividadesPM = (datos, anioActual, consecutivos = {}) => {
  if (!Array.isArray(datos)) {
    return { actividades: [], huboCambios: false, consecutivos };
  }

  const actividadesPreparadas = datos.map((actividad) => ({
    ...actividad,
    anio: actividad.anio || anioActual,
    semanaReprogramada: actividad.semanaReprogramada || "",
    detalles: actividad.detalles || "",
  }));

  let huboCambios = false;
  const actividadesPorAnio = {};

  actividadesPreparadas.forEach((actividad) => {
    const anio = Number(actividad.anio || anioActual);
    if (!actividadesPorAnio[anio]) actividadesPorAnio[anio] = [];
    actividadesPorAnio[anio].push(actividad);
  });

  const consecutivosActualizados = { ...consecutivos };

  Object.keys(actividadesPorAnio).forEach((anio) => {
    const anioNumero = Number(anio);
    let mayorConsecutivo = Number(consecutivosActualizados[anioNumero] || 0);
    const prefijo = `PM-${anioNumero}-`;

    actividadesPorAnio[anio].forEach((actividad) => {
      if (!actividad?.pmId) return;
      const pmId = String(actividad.pmId);
      if (!pmId.startsWith(prefijo)) return;

      const consecutivo = Number(pmId.replace(prefijo, ""));
      if (Number.isInteger(consecutivo) && consecutivo > mayorConsecutivo) {
        mayorConsecutivo = consecutivo;
      }
    });

    actividadesPorAnio[anio].forEach((actividad) => {
      if (actividad.pmId) return;

      mayorConsecutivo += 1;
      actividad.pmId = `${prefijo}${String(mayorConsecutivo).padStart(6, "0")}`;
      huboCambios = true;
    });

    consecutivosActualizados[anioNumero] = mayorConsecutivo;
  });

  return {
    actividades: actividadesPreparadas,
    huboCambios,
    consecutivos: consecutivosActualizados,
  };
};

// =================================================
// PERSISTENCIA EN SUPABASE
// =================================================

async function persistirPlan(actividades) {
  const { error } = await supabase.from("pm").upsert(
    {
      id: PM_ROW_PLAN,
      datos: actividades,
      fecha_actualizacion: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Error guardando el Plan de Mantenimiento:", error);
  }
}

async function persistirConsecutivos(consecutivos) {
  const { error } = await supabase.from("pm").upsert(
    {
      id: PM_ROW_CONSECUTIVOS,
      datos: consecutivos,
      fecha_actualizacion: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Error guardando los consecutivos del PM:", error);
  }
}

// =================================================
// COMPONENTE
// =================================================

function PM() {
  const anioActual = new Date().getFullYear();

  const [actividadesPM, setActividadesPM] = useState([]);
  const [cargando, setCargando] = useState(true);

  const consecutivosRef = useRef({});

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [actividadDetalles, setActividadDetalles] = useState(null);
  const [textoDetalles, setTextoDetalles] = useState("");

  const [formulario, setFormulario] = useState({
    subestacion: "",
    zona: "",
    nt: "",
    tipo: "",
    anio: anioActual,
    semana: "",
    estado: "P",
    semanaReprogramada: "",
  });

  const [filtroAnio, setFiltroAnio] = useState("Todos");
  const [filtroSemana, setFiltroSemana] = useState("Todas");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  // 🔹 NUEVO — filtro por tipo
  const [filtroTipo, setFiltroTipo] = useState("Todos");

  const { actividades } = useActividades();

  // =================================================
  // CARGA INICIAL DESDE SUPABASE
  // =================================================

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const [resActividades, resConsecutivos] = await Promise.all([
          supabase
            .from("pm")
            .select("datos")
            .eq("id", PM_ROW_PLAN)
            .maybeSingle(),
          supabase
            .from("pm")
            .select("datos")
            .eq("id", PM_ROW_CONSECUTIVOS)
            .maybeSingle(),
        ]);

        if (!activo) return;

        if (resActividades.error) {
          console.error("Error cargando PM:", resActividades.error);
        }
        if (resConsecutivos.error) {
          console.error(
            "Error cargando consecutivos PM:",
            resConsecutivos.error,
          );
        }

        const datos = Array.isArray(resActividades.data?.datos)
          ? resActividades.data.datos
          : [];

        const consecutivosGuardados =
          resConsecutivos.data?.datos &&
          typeof resConsecutivos.data.datos === "object"
            ? resConsecutivos.data.datos
            : {};

        const resultado = prepararActividadesPM(
          datos,
          anioActual,
          consecutivosGuardados,
        );

        consecutivosRef.current = resultado.consecutivos;
        setActividadesPM(resultado.actividades);

        if (resultado.huboCambios) {
          await persistirConsecutivos(resultado.consecutivos);
        }
      } catch (error) {
        console.error("Error cargando el Plan de Mantenimiento:", error);
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =================================================
  // GUARDAR PM EN SUPABASE (con debounce)
  // =================================================

  useEffect(() => {
    if (cargando) return undefined;

    const timeoutId = setTimeout(() => {
      persistirPlan(actividadesPM);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [actividadesPM, cargando]);

  // =================================================
  // CAMBIOS DEL FORMULARIO
  // =================================================

  const manejarCambio = (e) => {
    const { name, value } = e.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
      ...(name === "estado" && value !== "ER"
        ? { semanaReprogramada: "" }
        : {}),
    }));
  };

  const abrirFormulario = () => {
    setFormulario({
      subestacion: "",
      zona: "",
      nt: "",
      tipo: "",
      anio: anioActual,
      semana: "",
      estado: "P",
      semanaReprogramada: "",
    });
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => setMostrarFormulario(false);

  // =================================================
  // GUARDAR NUEVA ACTIVIDAD PM
  // =================================================

  const guardarActividad = (e) => {
    e.preventDefault();

    if (
      !formulario.subestacion.trim() ||
      !formulario.zona ||
      !formulario.nt ||
      !formulario.tipo ||
      !formulario.anio ||
      !formulario.semana
    ) {
      alert("Por favor complete todos los campos obligatorios.");
      return;
    }

    const anioActividad = Number(formulario.anio);

    const { pmId, consecutivos } = generarPmId(
      anioActividad,
      actividadesPM,
      consecutivosRef.current,
    );

    if (!pmId) {
      alert(
        "No fue posible generar el identificador del Plan de Mantenimiento.",
      );
      return;
    }

    consecutivosRef.current = consecutivos;
    persistirConsecutivos(consecutivos);

    const nuevaActividad = {
      id: Date.now(),
      pmId,
      subestacion: formulario.subestacion.trim(),
      zona: formulario.zona,
      nt: formulario.nt,
      tipo: formulario.tipo,
      anio: anioActividad,
      semana: formulario.semana,
      estado: formulario.estado,
      semanaReprogramada:
        formulario.estado === "ER" ? formulario.semanaReprogramada : "",
      detalles: "",
    };

    setActividadesPM((anteriores) => [...anteriores, nuevaActividad]);
    setMostrarFormulario(false);

    setFormulario({
      subestacion: "",
      zona: "",
      nt: "",
      tipo: "",
      anio: anioActual,
      semana: "",
      estado: "P",
      semanaReprogramada: "",
    });
  };

  // =================================================
  // ELIMINAR ACTIVIDAD PM
  // =================================================

  const eliminarActividad = (id) => {
    const confirmar = window.confirm(
      "¿Está seguro de eliminar esta actividad del Plan de Mantenimiento?",
    );
    if (!confirmar) return;

    setActividadesPM((anteriores) =>
      anteriores.filter((actividad) => actividad.id !== id),
    );
  };

  // =================================================
  // NORMALIZACIÓN / FECHAS
  // =================================================

  const normalizarTexto = (valor) =>
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const convertirFecha = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) return valor;

    if (typeof valor === "string") {
      // 🔹 FIX: Formato ISO "YYYY-MM-DD" → parsear como LOCAL, no UTC.
      // Sin esto, new Date("2026-10-05") se interpreta como medianoche UTC
      // y en Colombia (UTC-5) se corre al domingo anterior, desplazando
      // la semana ISO una unidad hacia atrás.
      const matchISO = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchISO) {
        const anio = Number(matchISO[1]);
        const mes = Number(matchISO[2]) - 1;
        const dia = Number(matchISO[3]);
        const fechaLocal = new Date(anio, mes, dia);
        if (!Number.isNaN(fechaLocal.getTime())) return fechaLocal;
      }

      // Formato "DD/MM/YYYY" (por si llega algún dato heredado)
      const partes = valor.split("/");
      if (partes.length === 3) {
        const dia = Number(partes[0]);
        const mes = Number(partes[1]) - 1;
        const anio = Number(partes[2]);
        const fechaManual = new Date(anio, mes, dia);
        if (!Number.isNaN(fechaManual.getTime())) return fechaManual;
      }
    }

    // Fallback (raro, pero por seguridad)
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  };

  const obtenerSemanaISO = (fecha) => {
    if (!fecha) return null;

    const fechaUTC = new Date(
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
    );
    const diaSemana = fechaUTC.getUTCDay() || 7;
    fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

    const inicioAnio = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));
    return Math.ceil(((fechaUTC - inicioAnio) / 86400000 + 1) / 7);
  };

  const obtenerAnioISO = (fecha) => {
    if (!fecha) return null;

    const fechaUTC = new Date(
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
    );
    const diaSemana = fechaUTC.getUTCDay() || 7;
    fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);
    return fechaUTC.getUTCFullYear();
  };

  const obtenerSemanaOriginalActividad = (actividad) => {
    if (!actividad) return null;

    if (actividad.semanaOriginal) return Number(actividad.semanaOriginal);
    if (actividad.semanaProgramacionOriginal)
      return Number(actividad.semanaProgramacionOriginal);
    if (actividad.semanaPM) return Number(actividad.semanaPM);
    if (actividad.semana) return Number(actividad.semana);

    const fecha =
      convertirFecha(actividad.fechaProgramacionOriginal) ||
      convertirFecha(actividad.fechaOriginal) ||
      convertirFecha(actividad.fechaProgramacion) ||
      convertirFecha(actividad.fecha);

    return obtenerSemanaISO(fecha);
  };

  const obtenerSemanaActualActividad = (actividad) => {
    if (!actividad) return null;

    if (actividad.fecha) {
      const semana = obtenerSemanaISO(convertirFecha(actividad.fecha));
      if (semana !== null) return semana;
    }
    if (actividad.semanaReprogramada)
      return Number(actividad.semanaReprogramada);
    if (actividad.semanaActual) return Number(actividad.semanaActual);

    const fecha =
      convertirFecha(actividad.fechaProgramacion) ||
      convertirFecha(actividad.fechaActual);
    return obtenerSemanaISO(fecha);
  };

  const obtenerAnioActualActividad = (actividad) => {
    if (!actividad) return null;

    if (actividad.fecha) {
      const anio = obtenerAnioISO(convertirFecha(actividad.fecha));
      if (anio !== null) return anio;
    }
    if (actividad.anioSemanaReprogramada)
      return Number(actividad.anioSemanaReprogramada);
    if (actividad.anioActual) return Number(actividad.anioActual);

    const fecha =
      convertirFecha(actividad.fechaProgramacion) ||
      convertirFecha(actividad.fechaActual);
    if (fecha) return obtenerAnioISO(fecha);

    if (actividad.anio) return Number(actividad.anio);
    if (actividad.anioProgramacion) return Number(actividad.anioProgramacion);

    return null;
  };

  const obtenerActividadProgramacion = (actividadPM) => {
    if (!actividadPM || !Array.isArray(actividades)) return null;

    const pmId = normalizarPMId(actividadPM.pmId);
    if (!pmId) return null;

    const coincidencias = actividades.filter(
      (actividad) => actividad && normalizarPMId(actividad.pmId) === pmId,
    );

    if (coincidencias.length === 0) return null;
    return coincidencias[coincidencias.length - 1];
  };

  const obtenerSemanaProgramada = (actividad) => {
    const actividadProgramacion = obtenerActividadProgramacion(actividad);
    if (!actividadProgramacion) return null;
    return obtenerSemanaActualActividad(actividadProgramacion);
  };

  const obtenerEstadoPM = (actividad) => {
    if (!actividad) return "P";
    if (actividad.estado === "NE") return "NE";

    const actividadProgramacion = obtenerActividadProgramacion(actividad);
    if (!actividadProgramacion) return "P";

    const estadoProgramacion = normalizarTexto(actividadProgramacion.estado);
    const estadosEjecutados = [
      "ejecutada",
      "ejecutado",
      "completada",
      "completado",
      "finalizada",
      "finalizado",
      "e",
    ];

    if (!estadosEjecutados.includes(estadoProgramacion)) return "P";

    const semanaOriginal = Number(actividad.semana);
    const anioOriginal = Number(actividad.anio || anioActual);
    const semanaActual = obtenerSemanaActualActividad(actividadProgramacion);
    const anioActualActividad = obtenerAnioActualActividad(
      actividadProgramacion,
    );

    if (
      semanaActual !== null &&
      anioActualActividad !== null &&
      (Number(semanaActual) !== semanaOriginal ||
        Number(anioActualActividad) !== anioOriginal)
    ) {
      return "ER";
    }

    return "E";
  };

  // =================================================
  // SINCRONIZAR ESTADO CON PROGRAMACIÓN
  // =================================================

  useEffect(() => {
    setActividadesPM((anteriores) => {
      let huboCambios = false;

      const actualizadas = anteriores.map((actividad) => {
        const estadoCalculado = obtenerEstadoPM(actividad);

        let semanaReprogramada = actividad.semanaReprogramada || "";

        if (estadoCalculado === "ER") {
          const semanaProgramada = obtenerSemanaProgramada(actividad);
          if (
            semanaProgramada !== null &&
            String(semanaReprogramada) !== String(semanaProgramada)
          ) {
            semanaReprogramada = String(semanaProgramada);
            huboCambios = true;
          }
        } else if (semanaReprogramada) {
          semanaReprogramada = "";
          huboCambios = true;
        }

        if (
          actividad.estado !== estadoCalculado ||
          String(actividad.semanaReprogramada || "") !==
            String(semanaReprogramada)
        ) {
          huboCambios = true;
          return { ...actividad, estado: estadoCalculado, semanaReprogramada };
        }

        return actividad;
      });

      return huboCambios ? actualizadas : anteriores;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividades]);

  // =================================================
  // MARCAR COMO NO EJECUTADA
  // =================================================

  const marcarComoNoEjecutada = (id) => {
    const actividad = actividadesPM.find((item) => item.id === id);
    if (!actividad) return;

    const confirmar = window.confirm(
      "¿Desea marcar esta actividad como NO EJECUTADA?",
    );
    if (!confirmar) return;

    setActividadesPM((anteriores) =>
      anteriores.map((item) =>
        item.id === id
          ? { ...item, estado: "NE", semanaReprogramada: "" }
          : item,
      ),
    );
  };

  // =================================================
  // DETALLES
  // =================================================

  const abrirDetalles = (actividad) => {
    setActividadDetalles(actividad);
    setTextoDetalles(actividad.detalles || "");
    setMostrarDetalles(true);
  };

  const cerrarDetalles = () => {
    setMostrarDetalles(false);
    setActividadDetalles(null);
    setTextoDetalles("");
  };

  const guardarDetalles = () => {
    if (!actividadDetalles) return;

    setActividadesPM((anteriores) =>
      anteriores.map((actividad) =>
        actividad.id === actividadDetalles.id
          ? { ...actividad, detalles: textoDetalles }
          : actividad,
      ),
    );

    cerrarDetalles();
  };

  // =================================================
  // ETIQUETAS DE ESTADO
  // =================================================

  const obtenerEstadoLabel = (estado) => {
    const etiquetas = {
      P: "Programada",
      E: "Ejecutada",
      ER: "Ejecutada Reprogramada",
      NE: "No ejecutada",
    };
    return etiquetas[estado] || estado;
  };

  // =================================================
  // AÑOS DISPONIBLES
  // =================================================

  const aniosDisponibles = Array.from(
    new Set(actividadesPM.map((a) => Number(a.anio || anioActual))),
  ).sort((a, b) => a - b);

  if (!aniosDisponibles.includes(anioActual)) {
    aniosDisponibles.push(anioActual);
    aniosDisponibles.sort((a, b) => a - b);
  }

  // =================================================
  // TIPOS DISPONIBLES (🔹 NUEVO)
  // =================================================

  const tiposDisponibles = Array.from(
    new Set(actividadesPM.map((a) => a.tipo).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));

  // =================================================
  // FILTROS
  // =================================================

  const actividadesFiltradas = actividadesPM.filter((actividad) => {
    const coincideAnio =
      filtroAnio === "Todos" ||
      Number(actividad.anio || anioActual) === Number(filtroAnio);

    const coincideSemana =
      filtroSemana === "Todas" ||
      Number(actividad.semana) === Number(filtroSemana);

    const estadoActual = obtenerEstadoPM(actividad);

    const coincideEstado =
      filtroEstado === "Todos" || estadoActual === filtroEstado;

    // 🔹 NUEVO — coincidencia por tipo
    const coincideTipo =
      filtroTipo === "Todos" || actividad.tipo === filtroTipo;

    return coincideAnio && coincideSemana && coincideEstado && coincideTipo;
  });

  const limpiarFiltros = () => {
    setFiltroAnio("Todos");
    setFiltroSemana("Todas");
    setFiltroEstado("Todos");
    // 🔹 NUEVO
    setFiltroTipo("Todos");
  };

  // =================================================
  // RENDER — CARGANDO
  // =================================================

  if (cargando) {
    return (
      <div className="pm">
        <section className="pm-section">
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#555",
              fontSize: "15px",
            }}
          >
            Cargando Plan de Mantenimiento...
          </div>
        </section>
      </div>
    );
  }

  // =================================================
  // RENDER — NORMAL
  // =================================================

  return (
    <div className="pm">
      <section className="pm-section">
        <div className="pm-section-header">
          <div>
            <span className="pm-section-label">PLAN DE MANTENIMIENTO</span>
            <h2>Programación PM</h2>
          </div>

          <div className="pm-header-controles">
            <div className="pm-filtros">
              <div className="pm-filtro">
                <label htmlFor="filtroAnio">Año</label>
                <select
                  id="filtroAnio"
                  value={filtroAnio}
                  onChange={(e) => setFiltroAnio(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {aniosDisponibles.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pm-filtro">
                <label htmlFor="filtroSemana">Semana PM</label>
                <select
                  id="filtroSemana"
                  value={filtroSemana}
                  onChange={(e) => setFiltroSemana(e.target.value)}
                >
                  <option value="Todas">Todas</option>
                  {semanas.map((semana) => (
                    <option key={semana} value={semana}>
                      Semana {semana}
                    </option>
                  ))}
                </select>
              </div>

              {/* 🔹 NUEVO — Filtro por Tipo */}
              <div className="pm-filtro">
                <label htmlFor="filtroTipo">Tipo</label>
                <select
                  id="filtroTipo"
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {tiposDisponibles.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pm-filtro">
                <label htmlFor="filtroEstado">Estado</label>
                <select
                  id="filtroEstado"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="P">Programada</option>
                  <option value="E">Ejecutada</option>
                  <option value="ER">Ejecutada Reprogramada</option>
                  <option value="NE">No ejecutada</option>
                </select>
              </div>

              {(filtroAnio !== "Todos" ||
                filtroSemana !== "Todas" ||
                filtroEstado !== "Todos" ||
                filtroTipo !== "Todos") && (
                <button
                  type="button"
                  className="pm-btn-limpiar-filtros"
                  onClick={limpiarFiltros}
                  title="Limpiar filtros"
                >
                  Limpiar
                </button>
              )}
            </div>

            <button
              type="button"
              className="pm-btn-nueva"
              onClick={abrirFormulario}
            >
              + Nueva actividad
            </button>
          </div>
        </div>

        {mostrarFormulario && (
          <div className="pm-formulario-contenedor">
            <div className="pm-formulario-header">
              <span>PLAN DE MANTENIMIENTO</span>
              <h3>Nueva actividad PM</h3>
            </div>

            <form className="pm-formulario" onSubmit={guardarActividad}>
              <div className="pm-formulario-campo">
                <label htmlFor="subestacion">Subestación *</label>
                <input
                  id="subestacion"
                  name="subestacion"
                  type="text"
                  value={formulario.subestacion}
                  onChange={manejarCambio}
                  placeholder="Ingrese la subestación"
                />
              </div>

              <div className="pm-formulario-campo">
                <label htmlFor="zona">Zona *</label>
                <select
                  id="zona"
                  name="zona"
                  value={formulario.zona}
                  onChange={manejarCambio}
                >
                  <option value="">Seleccionar</option>
                  <option value="Rio meta">Rio meta</option>
                  <option value="Centro">Centro</option>
                  <option value="Ariari">Ariari</option>
                </select>
              </div>

              <div className="pm-formulario-campo">
                <label htmlFor="nt">NT *</label>
                <select
                  id="nt"
                  name="nt"
                  value={formulario.nt}
                  onChange={manejarCambio}
                >
                  <option value="">Seleccionar</option>
                  <option value="NIV III">NIV III</option>
                  <option value="NIV IV">NIV IV</option>
                </select>
              </div>

              <div className="pm-formulario-campo">
                <label htmlFor="tipo">Tipo *</label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formulario.tipo}
                  onChange={manejarCambio}
                >
                  <option value="">Seleccionar</option>
                  <option value="Inspeccion">Inspeccion</option>
                  <option value="Termografia/coronografia">
                    Termografia/coronografia
                  </option>
                  <option value="Baterias">Baterias</option>
                  <option value="Aceites">Aceites</option>
                  <option value="Paso y contacto">Paso y contacto</option>
                  <option value="Podas">Podas</option>
                  <option value="Aires">Aires</option>
                  <option value="Maniobras">Maniobras</option>
                  <option value="Consignas">Consignas</option>
                </select>
              </div>

              <div className="pm-formulario-campo">
                <label htmlFor="anio">Año PM *</label>
                <input
                  id="anio"
                  name="anio"
                  type="number"
                  min="2020"
                  max="2100"
                  value={formulario.anio}
                  onChange={manejarCambio}
                />
              </div>

              <div className="pm-formulario-campo">
                <label htmlFor="semana">Semana PM *</label>
                <select
                  id="semana"
                  name="semana"
                  value={formulario.semana}
                  onChange={manejarCambio}
                >
                  <option value="">Seleccionar</option>
                  {semanas.map((semana) => (
                    <option key={semana} value={semana}>
                      Semana {semana}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pm-formulario-campo">
                <label htmlFor="estado">Estado</label>
                <select
                  id="estado"
                  name="estado"
                  value={formulario.estado}
                  onChange={manejarCambio}
                >
                  <option value="P">Programada</option>
                  <option value="NE">No ejecutada</option>
                  <option value="ER">Ejecutada Reprogramada</option>
                </select>
              </div>

              {formulario.estado === "ER" && (
                <div className="pm-formulario-campo">
                  <label htmlFor="semanaReprogramada">
                    Semana reprogramada
                  </label>
                  <select
                    id="semanaReprogramada"
                    name="semanaReprogramada"
                    value={formulario.semanaReprogramada}
                    onChange={manejarCambio}
                  >
                    <option value="">Seleccionar</option>
                    {semanas.map((semana) => (
                      <option key={semana} value={semana}>
                        Semana {semana}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pm-formulario-acciones">
                <button
                  type="button"
                  className="pm-btn-cancelar"
                  onClick={cerrarFormulario}
                >
                  Cancelar
                </button>
                <button type="submit" className="pm-btn-guardar">
                  Guardar actividad
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="pm-tabla-resumen">
          <span>Actividades registradas</span>
          <strong>{actividadesFiltradas.length}</strong>
        </div>

        <div className="pm-tabla-contenedor">
          <div className="pm-tabla-scroll">
            <table className="pm-tabla">
              <thead>
                <tr>
                  <th>Subestación</th>
                  <th>ZONA</th>
                  <th>NT</th>
                  <th>Tipo</th>
                  <th>Año PM</th>
                  <th>Semana PM</th>
                  <th>Semana programada</th>
                  <th>Estado</th>
                  <th>ID</th>
                  <th>Detalles</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {actividadesFiltradas.length > 0 ? (
                  actividadesFiltradas.map((actividad) => {
                    const estadoActual = obtenerEstadoPM(actividad);
                    const semanaProgramada = obtenerSemanaProgramada(actividad);

                    return (
                      <tr key={actividad.id}>
                        <td>{actividad.subestacion}</td>
                        <td>{actividad.zona}</td>
                        <td>{actividad.nt}</td>
                        <td>{actividad.tipo}</td>
                        <td>{actividad.anio}</td>
                        <td>
                          {actividad.semana
                            ? `Semana ${actividad.semana}`
                            : "—"}
                        </td>
                        <td>
                          {semanaProgramada
                            ? `Semana ${semanaProgramada}`
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`pm-estado pm-estado-${estadoActual.toLowerCase()}`}
                          >
                            {estadoActual} - {obtenerEstadoLabel(estadoActual)}
                          </span>
                        </td>
                        <td>
                          <span className="pm-id">{actividad.pmId || "—"}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`pm-btn-detalles ${
                              actividad.detalles ? "pm-btn-detalles-activo" : ""
                            }`}
                            onClick={() => abrirDetalles(actividad)}
                          >
                            Ver detalles
                          </button>
                        </td>
                        <td>
                          <div className="pm-acciones">
                            {estadoActual === "P" && (
                              <button
                                type="button"
                                className="pm-btn-no-ejecutada"
                                onClick={() =>
                                  marcarComoNoEjecutada(actividad.id)
                                }
                                title="Marcar como no ejecutada"
                              >
                                NE
                              </button>
                            )}
                            <button
                              type="button"
                              className="pm-btn-eliminar"
                              onClick={() => eliminarActividad(actividad.id)}
                              title="Eliminar actividad"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : actividadesPM.length > 0 ? (
                  <tr>
                    <td colSpan="11" className="pm-sin-resultados">
                      No hay actividades que coincidan con los filtros
                      seleccionados.
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan="11" className="pm-empty">
                      <div className="pm-empty-icon">📋</div>
                      <h3>No hay actividades registradas</h3>
                      <p>
                        Agregue una actividad al Plan de Mantenimiento para
                        comenzar.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {mostrarDetalles && (
        <div className="pm-detalles-overlay">
          <div className="pm-detalles-modal">
            <div className="pm-detalles-header">
              <div>
                <span>PLAN DE MANTENIMIENTO</span>
                <h3>Detalles de actividad</h3>
                {actividadDetalles && (
                  <p>
                    {actividadDetalles.subestacion} · Semana{" "}
                    {actividadDetalles.semana}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="pm-detalles-cerrar"
                onClick={cerrarDetalles}
              >
                ×
              </button>
            </div>

            <div className="pm-detalles-contenido">
              <label htmlFor="textoDetalles">Detalles</label>
              <textarea
                id="textoDetalles"
                value={textoDetalles}
                onChange={(e) => setTextoDetalles(e.target.value)}
                placeholder="Ingrese observaciones, trabajos realizados, novedades o información adicional..."
              />
              <div className="pm-detalles-acciones">
                <button
                  type="button"
                  className="pm-btn-cancelar"
                  onClick={cerrarDetalles}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pm-btn-guardar"
                  onClick={guardarDetalles}
                >
                  Guardar detalles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PM;
