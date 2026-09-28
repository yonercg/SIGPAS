import { useEffect, useState } from "react";
import { useActividades } from "../context/ActividadesContext";
import "./PM.css";

const CLAVE_PM = "sigpas_plan_mantenimiento";
const CLAVE_CONSECUTIVO_PM = "sigpas_pm_consecutivos";

const semanas = Array.from({ length: 52 }, (_, indice) => indice + 1);

// =================================================
// GENERAR PM ID
// =================================================

const generarPmId = (anio, actividadesExistentes = []) => {
  const anioNumero = Number(anio);

  if (!anioNumero) {
    return "";
  }

  let consecutivosGuardados = {};

  try {
    const guardados = localStorage.getItem(CLAVE_CONSECUTIVO_PM);

    if (guardados) {
      const datos = JSON.parse(guardados);

      if (datos && typeof datos === "object") {
        consecutivosGuardados = datos;
      }
    }
  } catch (error) {
    console.error(
      "Error al cargar los consecutivos del Plan de Mantenimiento:",
      error,
    );
  }

  let mayorConsecutivo = Number(consecutivosGuardados[anioNumero] || 0);

  const prefijo = `PM-${anioNumero}-`;

  actividadesExistentes.forEach((actividad) => {
    if (!actividad?.pmId) {
      return;
    }

    const pmId = String(actividad.pmId);

    if (!pmId.startsWith(prefijo)) {
      return;
    }

    const parteNumerica = pmId.replace(prefijo, "");

    const consecutivo = Number(parteNumerica);

    if (Number.isInteger(consecutivo) && consecutivo > mayorConsecutivo) {
      mayorConsecutivo = consecutivo;
    }
  });

  const siguienteConsecutivo = mayorConsecutivo + 1;

  const nuevosConsecutivos = {
    ...consecutivosGuardados,
    [anioNumero]: siguienteConsecutivo,
  };

  try {
    localStorage.setItem(
      CLAVE_CONSECUTIVO_PM,
      JSON.stringify(nuevosConsecutivos),
    );
  } catch (error) {
    console.error(
      "Error al guardar el consecutivo del Plan de Mantenimiento:",
      error,
    );
  }

  return `${prefijo}${String(siguienteConsecutivo).padStart(6, "0")}`;
};

// =================================================
// NORMALIZAR PM ID
// =================================================

const normalizarPMId = (valor) => {
  return String(valor || "")
    .trim()
    .toUpperCase();
};

// =================================================
// PREPARAR ACTIVIDADES PM EXISTENTES
// =================================================

const prepararActividadesPM = (datos, anioActual) => {
  if (!Array.isArray(datos)) {
    return [];
  }

  let actividadesPreparadas = datos.map((actividad) => ({
    ...actividad,
    anio: actividad.anio || anioActual,
    semanaReprogramada: actividad.semanaReprogramada || "",
    detalles: actividad.detalles || "",
  }));

  let huboCambios = false;

  const actividadesPorAnio = {};

  actividadesPreparadas.forEach((actividad) => {
    const anio = Number(actividad.anio || anioActual);

    if (!actividadesPorAnio[anio]) {
      actividadesPorAnio[anio] = [];
    }

    actividadesPorAnio[anio].push(actividad);
  });

  let consecutivosGuardados = {};

  try {
    const guardados = localStorage.getItem(CLAVE_CONSECUTIVO_PM);

    if (guardados) {
      const datosConsecutivos = JSON.parse(guardados);

      if (datosConsecutivos && typeof datosConsecutivos === "object") {
        consecutivosGuardados = datosConsecutivos;
      }
    }
  } catch (error) {
    console.error("Error al cargar consecutivos PM:", error);
  }

  Object.keys(actividadesPorAnio).forEach((anio) => {
    const anioNumero = Number(anio);

    let mayorConsecutivo = Number(consecutivosGuardados[anioNumero] || 0);

    const prefijo = `PM-${anioNumero}-`;

    actividadesPorAnio[anio].forEach((actividad) => {
      if (!actividad?.pmId) {
        return;
      }

      const pmId = String(actividad.pmId);

      if (!pmId.startsWith(prefijo)) {
        return;
      }

      const parteNumerica = pmId.replace(prefijo, "");

      const consecutivo = Number(parteNumerica);

      if (Number.isInteger(consecutivo) && consecutivo > mayorConsecutivo) {
        mayorConsecutivo = consecutivo;
      }
    });

    actividadesPorAnio[anio].forEach((actividad) => {
      if (actividad.pmId) {
        return;
      }

      mayorConsecutivo += 1;

      actividad.pmId = `${prefijo}${String(mayorConsecutivo).padStart(6, "0")}`;

      huboCambios = true;
    });

    consecutivosGuardados[anioNumero] = mayorConsecutivo;
  });

  try {
    localStorage.setItem(
      CLAVE_CONSECUTIVO_PM,
      JSON.stringify(consecutivosGuardados),
    );
  } catch (error) {
    console.error("Error al guardar consecutivos PM:", error);
  }

  return {
    actividades: actividadesPreparadas,
    huboCambios,
  };
};

function PM() {
  const anioActual = new Date().getFullYear();

  const [actividadesPM, setActividadesPM] = useState(() => {
    try {
      const guardadas = localStorage.getItem(CLAVE_PM);

      if (!guardadas) {
        return [];
      }

      const datos = JSON.parse(guardadas);

      const resultado = prepararActividadesPM(datos, anioActual);

      return resultado.actividades;
    } catch (error) {
      console.error("Error al cargar el Plan de Mantenimiento:", error);

      return [];
    }
  });

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

  const { actividades } = useActividades();

  // =================================================
  // GUARDAR PM EN LOCALSTORAGE
  // =================================================

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_PM, JSON.stringify(actividadesPM));
    } catch (error) {
      console.error("Error al guardar el Plan de Mantenimiento:", error);
    }
  }, [actividadesPM]);

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

  // =================================================
  // ABRIR FORMULARIO
  // =================================================

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

  // =================================================
  // CERRAR FORMULARIO
  // =================================================

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
  };

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
    const pmId = generarPmId(anioActividad, actividadesPM);

    if (!pmId) {
      alert(
        "No fue posible generar el identificador del Plan de Mantenimiento.",
      );
      return;
    }

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

    if (!confirmar) {
      return;
    }

    setActividadesPM((anteriores) =>
      anteriores.filter((actividad) => actividad.id !== id),
    );
  };

  // =================================================
  // NORMALIZACIÓN DE TEXTO
  // =================================================

  const normalizarTexto = (valor) => {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  };

  // =================================================
  // CONVERSIÓN DE FECHAS
  // =================================================

  const convertirFecha = (valor) => {
    if (!valor) {
      return null;
    }

    if (valor instanceof Date) {
      return valor;
    }

    const fecha = new Date(valor);

    if (!Number.isNaN(fecha.getTime())) {
      return fecha;
    }

    if (typeof valor === "string") {
      const partes = valor.split("/");

      if (partes.length === 3) {
        const dia = Number(partes[0]);
        const mes = Number(partes[1]) - 1;
        const anio = Number(partes[2]);

        const fechaManual = new Date(anio, mes, dia);

        if (!Number.isNaN(fechaManual.getTime())) {
          return fechaManual;
        }
      }
    }

    return null;
  };

  // =================================================
  // OBTENER SEMANA ISO
  // =================================================

  const obtenerSemanaISO = (fecha) => {
    if (!fecha) {
      return null;
    }

    const fechaUTC = new Date(
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
    );

    const diaSemana = fechaUTC.getUTCDay() || 7;

    fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

    const inicioAnio = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));

    return Math.ceil(((fechaUTC - inicioAnio) / 86400000 + 1) / 7);
  };

  // =================================================
  // OBTENER AÑO ISO
  // =================================================

  const obtenerAnioISO = (fecha) => {
    if (!fecha) {
      return null;
    }

    const fechaUTC = new Date(
      Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
    );

    const diaSemana = fechaUTC.getUTCDay() || 7;

    fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

    return fechaUTC.getUTCFullYear();
  };

  // =================================================
  // SEMANA ORIGINAL DEL PM
  // =================================================

  const obtenerSemanaOriginalActividad = (actividad) => {
    if (!actividad) {
      return null;
    }

    if (actividad.semanaOriginal) {
      return Number(actividad.semanaOriginal);
    }

    if (actividad.semanaProgramacionOriginal) {
      return Number(actividad.semanaProgramacionOriginal);
    }

    if (actividad.semanaPM) {
      return Number(actividad.semanaPM);
    }

    if (actividad.semana) {
      return Number(actividad.semana);
    }

    const fecha =
      convertirFecha(actividad.fechaProgramacionOriginal) ||
      convertirFecha(actividad.fechaOriginal) ||
      convertirFecha(actividad.fechaProgramacion) ||
      convertirFecha(actividad.fecha);

    return obtenerSemanaISO(fecha);
  };

  // =================================================
  // SEMANA ACTUAL DE LA ACTIVIDAD DE PROGRAMACIÓN
  // =================================================

  const obtenerSemanaActualActividad = (actividad) => {
    if (!actividad) {
      return null;
    }

    // La fecha actual de Programación es la fuente principal.
    if (actividad.fecha) {
      const fecha = convertirFecha(actividad.fecha);
      const semana = obtenerSemanaISO(fecha);

      if (semana !== null) {
        return semana;
      }
    }

    if (actividad.semanaReprogramada) {
      return Number(actividad.semanaReprogramada);
    }

    if (actividad.semanaActual) {
      return Number(actividad.semanaActual);
    }

    const fecha =
      convertirFecha(actividad.fechaProgramacion) ||
      convertirFecha(actividad.fechaActual);

    return obtenerSemanaISO(fecha);
  };

  // =================================================
  // AÑO ACTUAL DE LA ACTIVIDAD DE PROGRAMACIÓN
  // =================================================

  const obtenerAnioActualActividad = (actividad) => {
    if (!actividad) {
      return null;
    }

    // La fecha actual de Programación es la fuente principal.
    if (actividad.fecha) {
      const fecha = convertirFecha(actividad.fecha);
      const anio = obtenerAnioISO(fecha);

      if (anio !== null) {
        return anio;
      }
    }

    if (actividad.anioSemanaReprogramada) {
      return Number(actividad.anioSemanaReprogramada);
    }

    if (actividad.anioActual) {
      return Number(actividad.anioActual);
    }

    const fecha =
      convertirFecha(actividad.fechaProgramacion) ||
      convertirFecha(actividad.fechaActual);

    if (fecha) {
      return obtenerAnioISO(fecha);
    }

    if (actividad.anio) {
      return Number(actividad.anio);
    }

    if (actividad.anioProgramacion) {
      return Number(actividad.anioProgramacion);
    }

    return null;
  };

  // =================================================
  // OBTENER ACTIVIDAD DE PROGRAMACIÓN POR PM ID
  // =================================================
  //
  // IMPORTANTE:
  // El vínculo entre PM y Programación se hace
  // EXCLUSIVAMENTE mediante pmId.
  //
  // Ya NO se utiliza:
  // - Subestación
  // - Tipo
  // - Semana
  // - Año
  //
  // Esto evita que dos actividades parecidas se
  // relacionen incorrectamente.
  // =================================================

  const obtenerActividadProgramacion = (actividadPM) => {
    if (!actividadPM || !Array.isArray(actividades)) {
      return null;
    }

    const pmId = normalizarPMId(actividadPM.pmId);

    if (!pmId) {
      return null;
    }

    const coincidencias = actividades.filter((actividad) => {
      if (!actividad) {
        return false;
      }

      return normalizarPMId(actividad.pmId) === pmId;
    });

    if (coincidencias.length === 0) {
      return null;
    }

    return coincidencias[coincidencias.length - 1];
  };

  // =================================================
  // OBTENER SEMANA PROGRAMADA
  // =================================================

  const obtenerSemanaProgramada = (actividad) => {
    const actividadProgramacion = obtenerActividadProgramacion(actividad);

    if (!actividadProgramacion) {
      return null;
    }

    return obtenerSemanaActualActividad(actividadProgramacion);
  };

  // =================================================
  // OBTENER ESTADO ACTUAL DEL PM
  // =================================================

  const obtenerEstadoPM = (actividad) => {
    if (!actividad) {
      return "P";
    }

    // Si el usuario marcó manualmente el PM como
    // no ejecutado, se conserva ese estado.
    if (actividad.estado === "NE") {
      return "NE";
    }

    const actividadProgramacion = obtenerActividadProgramacion(actividad);

    // Si todavía no existe actividad vinculada en
    // Programación, el PM continúa como programado.
    if (!actividadProgramacion) {
      return "P";
    }

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

    const fueEjecutada = estadosEjecutados.includes(estadoProgramacion);

    // Si la actividad está pendiente o reprogramada
    // pero todavía no se ha ejecutado, continúa como P.
    if (!fueEjecutada) {
      return "P";
    }

    const semanaOriginal = Number(actividad.semana);
    const anioOriginal = Number(actividad.anio || anioActual);

    const semanaActual = obtenerSemanaActualActividad(actividadProgramacion);

    const anioActualActividad = obtenerAnioActualActividad(
      actividadProgramacion,
    );

    // Si se ejecutó en una semana o año diferente
    // al PM original, el estado es ER.
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
  // ACTUALIZAR ESTADO Y SEMANA PROGRAMADA DEL PM
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

          return {
            ...actividad,
            estado: estadoCalculado,
            semanaReprogramada,
          };
        }

        return actividad;
      });

      return huboCambios ? actualizadas : anteriores;
    });
  }, [actividades]);

  // =================================================
  // MARCAR COMO NO EJECUTADA
  // =================================================

  const marcarComoNoEjecutada = (id) => {
    const actividad = actividadesPM.find((item) => item.id === id);

    if (!actividad) {
      return;
    }

    const confirmar = window.confirm(
      "¿Desea marcar esta actividad como NO EJECUTADA?",
    );

    if (!confirmar) {
      return;
    }

    setActividadesPM((anteriores) =>
      anteriores.map((item) =>
        item.id === id
          ? {
              ...item,
              estado: "NE",
              semanaReprogramada: "",
            }
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
    if (!actividadDetalles) {
      return;
    }

    setActividadesPM((anteriores) =>
      anteriores.map((actividad) =>
        actividad.id === actividadDetalles.id
          ? {
              ...actividad,
              detalles: textoDetalles,
            }
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
    new Set(
      actividadesPM.map((actividad) => Number(actividad.anio || anioActual)),
    ),
  ).sort((a, b) => a - b);

  if (!aniosDisponibles.includes(anioActual)) {
    aniosDisponibles.push(anioActual);
    aniosDisponibles.sort((a, b) => a - b);
  }

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

    return coincideAnio && coincideSemana && coincideEstado;
  });

  // =================================================
  // LIMPIAR FILTROS
  // =================================================

  const limpiarFiltros = () => {
    setFiltroAnio("Todos");
    setFiltroSemana("Todas");
    setFiltroEstado("Todos");
  };

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
                filtroEstado !== "Todos") && (
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

        {/* =================================================
            FORMULARIO NUEVA ACTIVIDAD PM
            ================================================= */}

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

        {/* =================================================
            RESUMEN
            ================================================= */}

        <div className="pm-tabla-resumen">
          <span>Actividades registradas</span>
          <strong>{actividadesFiltradas.length}</strong>
        </div>

        {/* =================================================
            TABLA PM
            ================================================= */}

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

      {/* =================================================
          MODAL DETALLES
          ================================================= */}

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
