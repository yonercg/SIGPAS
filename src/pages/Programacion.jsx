import { useState } from "react";
import { cuadrillas } from "../data/cuadrillas";
import { camionetas } from "../data/camionetas";
import { useActividades } from "../context/ActividadesContext";
import "./Programacion.css";

// =========================================
// CONFIGURACIÓN BASE DE PROGRAMACIÓN
// =========================================

const FECHA_LUNES_SEMANA_BASE = new Date(2026, 7, 17);

const SEMANA_BASE = 34;

const ANIO_BASE = 2026;

// =========================================
// CLAVE PLAN DE MANTENIMIENTO
// =========================================

const CLAVE_PM = "sigpas_plan_mantenimiento";

// =========================================
// TIPOS DE ACTIVIDAD
// =========================================

const TIPOS_ACTIVIDAD = [
  "Inspeccion",
  "Baterias",
  "Termografica/Coronometria",
  "Aceites",
  "Paso y contacto",
  "Podas",
  "Aires",
  "Maniobras",
  "Consignas",
  "Fuera de PM",
  "Reconectadores 34,5kV",
  "Reconectadores 13,8kV",
];

// =========================================
// TIPOS DE ACTIVIDAD FUERA DE PM
// =========================================

const TIPOS_FUERA_PM = [
  "Fuera de PM",
  "Reconectadores 34,5kV",
  "Reconectadores 13,8kV",
];

// =========================================
// ZONAS
// =========================================

const ZONAS = ["Río Meta", "Centro", "Ariari"];

// =========================================
// TIPOS DE MANTENIMIENTO
// =========================================

const TIPOS_MANTENIMIENTO = [
  "Preventivo",
  "Correctivo",
  "Predictivo",
  "No especificado",
];

// =========================================
// CUADRILLAS QUE PARTICIPAN EN LA
// ROTACIÓN DE DISPONIBILIDAD
// =========================================

const CUADRILLAS_ROTACION = ["C1", "C2", "C3", "C4"];

// =========================================
// AGREGAR DÍAS
// =========================================

const agregarDias = (fecha, dias) => {
  const nuevaFecha = new Date(fecha);

  nuevaFecha.setDate(nuevaFecha.getDate() + dias);

  return nuevaFecha;
};

// =========================================
// OBTENER NÚMERO DE SEMANA ISO
// =========================================

const obtenerNumeroSemanaISO = (fecha) => {
  const fechaUTC = new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
  );

  const diaSemana = fechaUTC.getUTCDay() || 7;

  fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

  const inicioAnio = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));

  return Math.ceil(((fechaUTC - inicioAnio) / 86400000 + 1) / 7);
};

// =========================================
// OBTENER AÑO ISO
// =========================================

const obtenerAnioISO = (fecha) => {
  const fechaUTC = new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
  );

  const diaSemana = fechaUTC.getUTCDay() || 7;

  fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

  return fechaUTC.getUTCFullYear();
};

// =========================================
// OBTENER LUNES ISO
// =========================================

const obtenerLunesISO = (semana, anio) => {
  const enero4 = new Date(anio, 0, 4);

  const diaSemana = enero4.getDay() || 7;

  const lunesPrimeraSemana = new Date(enero4);

  lunesPrimeraSemana.setDate(enero4.getDate() - diaSemana + 1);

  return agregarDias(lunesPrimeraSemana, (semana - 1) * 7);
};

// =========================================
// OBTENER CANTIDAD DE SEMANAS
// =========================================

const obtenerCantidadSemanas = (anio) => {
  const diciembre31 = new Date(anio, 11, 31);

  return obtenerNumeroSemanaISO(diciembre31);
};

// =========================================
// DIFERENCIA ENTRE SEMANAS
// =========================================

const obtenerDiferenciaSemanas = (
  semanaBase,
  anioBase,
  semanaObjetivo,
  anioObjetivo,
) => {
  const lunesBase = obtenerLunesISO(semanaBase, anioBase);

  const lunesObjetivo = obtenerLunesISO(semanaObjetivo, anioObjetivo);

  const diferencia = lunesObjetivo.getTime() - lunesBase.getTime();

  return Math.round(diferencia / (1000 * 60 * 60 * 24 * 7));
};

// =========================================
// COMPONENTE PROGRAMACIÓN
// =========================================

function Programacion() {
  // =========================================
  // CONTEXT DE ACTIVIDADES
  // =========================================

  const {
    actividades,
    agregarActividad,
    modificarActividad: modificarActividadContext,
    eliminarActividad: eliminarActividadContext,
    cambiarEstadoActividad: cambiarEstadoContext,
  } = useActividades();

  // =========================================
  // CONFIGURACIÓN GENERAL
  // =========================================

  const FECHA_ACTUAL = new Date();

  const SEMANA_ACTUAL_REAL = obtenerNumeroSemanaISO(FECHA_ACTUAL);

  const ANIO_ACTUAL_REAL = obtenerAnioISO(FECHA_ACTUAL);

  // =========================================
  // ESTADOS
  // =========================================

  const [semanaActual, setSemanaActual] = useState(SEMANA_ACTUAL_REAL);

  const [anioActual, setAnioActual] = useState(ANIO_ACTUAL_REAL);

  const [filtroEstado, setFiltroEstado] = useState("Todos");

  const [filtroSubestacion, setFiltroSubestacion] = useState("Todas");

  const [filtroCuadrilla, setFiltroCuadrilla] = useState("Todas");

  const [filtroMantenimiento, setFiltroMantenimiento] = useState("Todos");

  // =========================================
  // NUEVOS FILTROS
  // =========================================

  const [busqueda, setBusqueda] = useState("");

  const [filtroPM, setFiltroPM] = useState("Todos");

  // =========================================
  // FORMULARIO DISPONIBILIDAD
  // =========================================

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [cuadrillaSeleccionada, setCuadrillaSeleccionada] = useState("");

  const [motivoCambio, setMotivoCambio] = useState("");

  // =========================================
  // CAMBIOS MANUALES PERSISTENTES
  // =========================================

  const [cambiosManuales, setCambiosManuales] = useState(() => {
    try {
      const cambiosGuardados = localStorage.getItem("sigpas_cambios_manuales");

      return cambiosGuardados ? JSON.parse(cambiosGuardados) : {};
    } catch (error) {
      console.error("Error al cargar cambios de disponibilidad:", error);

      return {};
    }
  });

  // =========================================
  // NUEVA / MODIFICAR ACTIVIDAD
  // =========================================

  const [mostrarFormularioActividad, setMostrarFormularioActividad] =
    useState(false);

  const [modoEdicion, setModoEdicion] = useState(false);

  const [actividadEditandoId, setActividadEditandoId] = useState(null);

  const [nuevaActividad, setNuevaActividad] = useState({
    fecha: "",
    codigoOT: "",
    nombre: "",
    tipo: "",
    nt: "",
    subestacion: "",
    zona: "",
    cuadrillaId: "",
    responsable: "",
    camioneta: "",
    mantenimiento: "",
    estado: "Pendiente",
    pmId: "",
  });

  // =========================================
  // VALIDACIÓN DEL ID PM
  // =========================================

  const [pmEncontrado, setPmEncontrado] = useState(null);

  const [pmValidacion, setPmValidacion] = useState("vacio");

  // =========================================
  // FORMULARIO DE REPROGRAMACIÓN
  // =========================================

  const [mostrarFormularioReprogramacion, setMostrarFormularioReprogramacion] =
    useState(false);

  const [actividadReprogramando, setActividadReprogramando] = useState(null);

  const [datosReprogramacion, setDatosReprogramacion] = useState({
    fechaActual: "",
    motivo: "",
    observacion: "",
  });

  // =========================================
  // DETALLE DE ACTIVIDAD
  // =========================================

  const [actividadDetalle, setActividadDetalle] = useState(null);

  // =========================================
  // FECHAS DE LA SEMANA
  // =========================================

  const obtenerFechasSemana = (semana, anio) => {
    const diferenciaSemanas = obtenerDiferenciaSemanas(
      SEMANA_BASE,
      ANIO_BASE,
      semana,
      anio,
    );

    const diasDesdeSemanaBase = diferenciaSemanas * 7;

    const lunes = agregarDias(FECHA_LUNES_SEMANA_BASE, diasDesdeSemanaBase);

    const domingo = agregarDias(lunes, 6);

    return {
      lunes,
      domingo,
    };
  };

  // =========================================
  // FECHAS DISPONIBILIDAD
  // =========================================

  const obtenerFechasDisponibilidad = (semana, anio) => {
    const { lunes } = obtenerFechasSemana(semana, anio);

    const viernesInicio = agregarDias(lunes, -3);

    viernesInicio.setHours(16, 30, 0, 0);

    const viernesFin = agregarDias(viernesInicio, 7);

    return {
      inicio: viernesInicio,
      fin: viernesFin,
    };
  };

  // =========================================
  // FORMATEAR FECHA
  // =========================================

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "No disponible";
    }

    return fecha.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // =========================================
  // FORMATEAR FECHA ACTIVIDAD
  // =========================================

  const formatearFechaActividad = (fecha) => {
    if (!fecha) {
      return "No disponible";
    }

    const diasSemana = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];

    const diaSemana = diasSemana[fecha.getDay()];

    return `${diaSemana} ${fecha.getDate().toString().padStart(2, "0")}/${(
      fecha.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${fecha.getFullYear()}`;
  };

  // =========================================
  // FORMATEAR FECHA CORTA
  // =========================================

  const formatearFechaCorta = (fecha) => {
    if (!fecha) {
      return "No disponible";
    }

    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    const diaSemana = diasSemana[fecha.getDay()];

    return `${diaSemana} ${fecha.getDate().toString().padStart(2, "0")}/${(
      fecha.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${fecha.getFullYear()}`;
  };

  // =========================================
  // FORMATEAR DISPONIBILIDAD
  // =========================================

  const formatearDisponibilidad = (fecha) => {
    if (!fecha) {
      return "No disponible";
    }

    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    const diaSemana = diasSemana[fecha.getDay()];

    const fechaFormateada = `${diaSemana} ${fecha
      .getDate()
      .toString()
      .padStart(2, "0")}/${(fecha.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${fecha.getFullYear()}`;

    const horaFormateada = fecha.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return `${fechaFormateada} — ${horaFormateada}`;
  };

  // =========================================
  // FECHAS ACTUALES
  // =========================================

  const fechasSemana = obtenerFechasSemana(semanaActual, anioActual);

  const fechasDisponibilidad = obtenerFechasDisponibilidad(
    semanaActual,
    anioActual,
  );

  // =========================================
  // CUADRILLAS DE ROTACIÓN
  // =========================================

  const obtenerCuadrillasActivas = () => {
    return cuadrillas.filter(
      (cuadrilla) =>
        cuadrilla.activa && CUADRILLAS_ROTACION.includes(cuadrilla.id),
    );
  };

  // =========================================
  // TODAS LAS CUADRILLAS ACTIVAS
  // =========================================

  const obtenerTodasCuadrillasActivas = () => {
    return cuadrillas.filter((cuadrilla) => cuadrilla.activa);
  };

  // =========================================
  // SIGUIENTE CUADRILLA
  // =========================================

  const obtenerSiguienteCuadrilla = (cuadrillaId) => {
    const cuadrillasActivas = obtenerCuadrillasActivas();

    if (cuadrillasActivas.length === 0) {
      return null;
    }

    const indiceActual = cuadrillasActivas.findIndex(
      (cuadrilla) => cuadrilla.id === cuadrillaId,
    );

    if (indiceActual === -1) {
      return cuadrillasActivas[0];
    }

    const siguienteIndice = (indiceActual + 1) % cuadrillasActivas.length;

    return cuadrillasActivas[siguienteIndice] || null;
  };

  // =========================================
  // CUADRILLA DE UNA SEMANA
  // =========================================

  const obtenerCuadrillaSemana = (semana) => {
    const cuadrillasActivas = obtenerCuadrillasActivas();

    if (cuadrillasActivas.length === 0) {
      return null;
    }

    const claveSemana = `${anioActual}-${semana}`;

    if (cambiosManuales[claveSemana]) {
      const cuadrillaManual = cambiosManuales[claveSemana].cuadrillaId;

      if (CUADRILLAS_ROTACION.includes(cuadrillaManual)) {
        return cuadrillaManual;
      }
    }

    const semanasConCambio = Object.keys(cambiosManuales)
      .filter((clave) => {
        const [anio, numero] = clave.split("-").map(Number);

        const cuadrillaCambio = cambiosManuales[clave]?.cuadrillaId;

        return (
          CUADRILLAS_ROTACION.includes(cuadrillaCambio) &&
          (anio < anioActual || (anio === anioActual && numero < semana))
        );
      })
      .sort((a, b) => {
        const [anioA, semanaA] = a.split("-").map(Number);

        const [anioB, semanaB] = b.split("-").map(Number);

        if (anioA !== anioB) {
          return anioB - anioA;
        }

        return semanaB - semanaA;
      });

    if (semanasConCambio.length === 0) {
      const diferencia = obtenerDiferenciaSemanas(
        SEMANA_BASE,
        ANIO_BASE,
        semana,
        anioActual,
      );

      const posicion =
        ((diferencia % cuadrillasActivas.length) + cuadrillasActivas.length) %
        cuadrillasActivas.length;

      return cuadrillasActivas[posicion]?.id || null;
    }

    const ultimaSemanaManual = semanasConCambio[0];

    const [anioManual, semanaManual] = ultimaSemanaManual
      .split("-")
      .map(Number);

    let cuadrillaActual = cambiosManuales[ultimaSemanaManual]?.cuadrillaId;

    if (!cuadrillaActual || !CUADRILLAS_ROTACION.includes(cuadrillaActual)) {
      return null;
    }

    const semanasTranscurridas = obtenerDiferenciaSemanas(
      semanaManual,
      anioManual,
      semana,
      anioActual,
    );

    if (semanasTranscurridas > 0) {
      for (let i = 0; i < semanasTranscurridas; i++) {
        const siguiente = obtenerSiguienteCuadrilla(cuadrillaActual);

        if (!siguiente) {
          return null;
        }

        cuadrillaActual = siguiente.id;
      }
    }

    return cuadrillaActual;
  };

  // =========================================
  // CUADRILLA ACTUAL
  // =========================================

  const cuadrillaIdActual = obtenerCuadrillaSemana(semanaActual);

  const cuadrillaActual =
    cuadrillas.find((cuadrilla) => cuadrilla.id === cuadrillaIdActual) || null;

  const siguienteCuadrilla = obtenerSiguienteCuadrilla(cuadrillaIdActual);

  // =========================================
  // CAMBIO MANUAL ACTUAL
  // =========================================

  const cambioManualActual =
    cambiosManuales[`${anioActual}-${semanaActual}`] || null;

  // =========================================
  // CAMBIAR SEMANA
  // =========================================

  const semanaAnterior = () => {
    if (semanaActual > 1) {
      setSemanaActual(semanaActual - 1);
    } else {
      const anioAnterior = anioActual - 1;

      setAnioActual(anioAnterior);

      setSemanaActual(obtenerCantidadSemanas(anioAnterior));
    }

    setMostrarFormulario(false);
    setMostrarFormularioActividad(false);
  };

  const semanaSiguiente = () => {
    const cantidadSemanas = obtenerCantidadSemanas(anioActual);

    if (semanaActual < cantidadSemanas) {
      setSemanaActual(semanaActual + 1);
    } else {
      setAnioActual(anioActual + 1);

      setSemanaActual(1);
    }

    setMostrarFormulario(false);
    setMostrarFormularioActividad(false);
  };

  // =========================================
  // FORMULARIO DISPONIBILIDAD
  // =========================================

  const abrirFormulario = () => {
    setCuadrillaSeleccionada(cuadrillaIdActual || "");

    setMotivoCambio(cambioManualActual?.motivo || "");

    setMostrarFormulario(true);
  };

  const cancelarFormulario = () => {
    setMostrarFormulario(false);

    setMotivoCambio("");
  };

  const guardarCambio = (event) => {
    event.preventDefault();

    if (!cuadrillaSeleccionada) {
      alert("Seleccione una cuadrilla.");

      return;
    }

    if (!CUADRILLAS_ROTACION.includes(cuadrillaSeleccionada)) {
      alert(
        "Solo C1, C2, C3 y C4 pueden participar en la rotación de disponibilidad.",
      );

      return;
    }

    if (!motivoCambio.trim()) {
      alert("Debe indicar el motivo del cambio.");

      return;
    }

    const claveSemana = `${anioActual}-${semanaActual}`;

    setCambiosManuales((anteriores) => {
      const nuevosCambios = {
        ...anteriores,

        [claveSemana]: {
          cuadrillaId: cuadrillaSeleccionada,

          motivo: motivoCambio.trim(),
        },
      };

      try {
        localStorage.setItem(
          "sigpas_cambios_manuales",
          JSON.stringify(nuevosCambios),
        );
      } catch (error) {
        console.error("Error al guardar cambios de disponibilidad:", error);
      }

      return nuevosCambios;
    });

    setMostrarFormulario(false);

    setMotivoCambio("");
  };

  // =========================================
  // LEER PLAN DE MANTENIMIENTO
  // =========================================

  const obtenerPlanesPM = () => {
    try {
      const planesGuardados = localStorage.getItem(CLAVE_PM);

      if (!planesGuardados) {
        return [];
      }

      const planes = JSON.parse(planesGuardados);

      return Array.isArray(planes) ? planes : [];
    } catch (error) {
      console.error("Error al leer el Plan de Mantenimiento:", error);

      return [];
    }
  };

  // =========================================
  // NORMALIZAR ID PM
  // =========================================

  const normalizarPMId = (valor) => {
    return valor.trim().toUpperCase();
  };

  // =========================================
  // BUSCAR PM POR ID
  // =========================================

  const buscarPMPorId = (valor) => {
    const idBuscado = normalizarPMId(valor);

    if (!idBuscado) {
      return null;
    }

    const planes = obtenerPlanesPM();

    return (
      planes.find(
        (plan) => normalizarPMId(plan.pmId || plan.id || "") === idBuscado,
      ) || null
    );
  };

  // =========================================
  // APLICAR DATOS DEL PM EN LA ACTIVIDAD
  // =========================================

  const aplicarDatosPM = (planPM, idPM) => {
    if (!planPM) {
      return;
    }

    setNuevaActividad((anterior) => ({
      ...anterior,
      pmId: idPM,
      subestacion: planPM.subestacion || anterior.subestacion || "",
      zona: planPM.zona || anterior.zona || "",
      nt: planPM.nt || anterior.nt || "",
      tipo: planPM.tipo || anterior.tipo || "",
    }));

    setPmEncontrado(planPM);

    setPmValidacion("valido");
  };

  // =========================================
  // CAMBIAR ID PM
  // =========================================

  const cambiarIdPM = (event) => {
    if (modoEdicion && nuevaActividad.pmId) {
      return;
    }

    const valor = normalizarPMId(event.target.value);

    if (!valor) {
      setNuevaActividad((anterior) => ({
        ...anterior,
        pmId: "",
      }));

      setPmEncontrado(null);

      setPmValidacion("vacio");

      return;
    }

    const planPM = buscarPMPorId(valor);

    if (!planPM) {
      setNuevaActividad((anterior) => ({
        ...anterior,
        pmId: valor,
      }));

      setPmEncontrado(null);

      setPmValidacion("invalido");

      return;
    }

    aplicarDatosPM(planPM, valor);
  };

  // =========================================
  // ABRIR NUEVA ACTIVIDAD
  // =========================================

  const abrirFormularioActividad = () => {
    setModoEdicion(false);

    setActividadEditandoId(null);

    setNuevaActividad({
      fecha: "",
      codigoOT: "",
      nombre: "",
      tipo: "",
      nt: "",
      subestacion: "",
      zona: "",
      cuadrillaId: "",
      responsable: "",
      camioneta: "",
      mantenimiento: "",
      estado: "Pendiente",
      pmId: "",
    });

    setPmEncontrado(null);

    setPmValidacion("vacio");

    setMostrarFormularioActividad(true);
  };

  // =========================================
  // OBTENER CUADRILLA DE ACTIVIDAD
  // =========================================

  const obtenerCuadrillaActividad = (actividad) => {
    if (actividad.cuadrillaId) {
      return actividad.cuadrillaId;
    }

    const cuadrillaPorIngeniero = cuadrillas.find(
      (cuadrilla) => cuadrilla.ingeniero === actividad.responsable,
    );

    return cuadrillaPorIngeniero?.id || null;
  };

  // =========================================
  // MODIFICAR ACTIVIDAD
  // =========================================

  const modificarActividad = (actividad) => {
    setModoEdicion(true);

    setActividadEditandoId(actividad.id);

    const pmIdActividad = actividad.pmId || "";

    setNuevaActividad({
      fecha: actividad.fecha || "",

      codigoOT: actividad.codigoOT || "",

      nombre: actividad.nombre || "",

      tipo: actividad.tipo || "",

      nt: actividad.nt || "",

      subestacion: actividad.subestacion || "",

      zona: actividad.zona || "",

      cuadrillaId: obtenerCuadrillaActividad(actividad) || "",

      responsable: actividad.responsable || "",

      camioneta: actividad.camioneta || "",

      mantenimiento: actividad.mantenimiento || "",

      estado: actividad.estado || "Pendiente",

      pmId: pmIdActividad,
    });

    if (pmIdActividad) {
      const planPM = buscarPMPorId(pmIdActividad);

      if (planPM) {
        setPmEncontrado(planPM);

        setPmValidacion("valido");
      } else {
        setPmEncontrado(null);

        setPmValidacion("invalido");
      }
    } else {
      setPmEncontrado(null);

      setPmValidacion("vacio");
    }

    setMostrarFormularioActividad(true);
  };

  // =========================================
  // ELIMINAR ACTIVIDAD
  // =========================================

  const eliminarActividad = (actividad) => {
    const confirmar = window.confirm(
      `¿Está seguro de eliminar la actividad "${actividad.nombre}"?`,
    );

    if (!confirmar) {
      return;
    }

    eliminarActividadContext(actividad.id);
  };

  // =========================================
  // DUPLICAR ACTIVIDAD
  // =========================================
  // UNA ACTIVIDAD VINCULADA A PM NO DEBE
  // DUPLICAR EL ID PM.
  // =========================================

  const duplicarActividad = (actividad) => {
    const confirmar = window.confirm("¿Seguro quieres duplicar la actividad?");

    if (!confirmar) {
      return;
    }

    const actividadDuplicada = {
      ...actividad,

      id: Date.now() + Math.floor(Math.random() * 1000),

      pmId: "",

      fechaOriginal: undefined,

      fechaActual: undefined,

      semanaOriginal: undefined,

      anioSemanaOriginal: undefined,

      semanaReprogramada: undefined,

      anioSemanaReprogramada: undefined,

      motivoReprogramacion: undefined,

      observacionReprogramacion: undefined,
    };

    agregarActividad(actividadDuplicada);
  };

  // =========================================
  // CAMBIAR ESTADO
  // =========================================

  const cambiarEstadoActividad = (id, nuevoEstado) => {
    const actividad = actividades.find((item) => item.id === id);

    if (!actividad) {
      return;
    }

    if (nuevoEstado === "Reprogramada" && actividad.estado !== "Reprogramada") {
      setActividadReprogramando(actividad);

      setDatosReprogramacion({
        fechaActual: actividad.fecha || "",
        motivo: "",
        observacion: "",
      });

      setMostrarFormularioReprogramacion(true);

      return;
    }

    if (actividad.estado === "Reprogramada" && nuevoEstado !== "Reprogramada") {
      cambiarEstadoContext(id, nuevoEstado);

      return;
    }

    cambiarEstadoContext(id, nuevoEstado);
  };

  // =========================================
  // CAMBIAR DATOS REPROGRAMACIÓN
  // =========================================

  const cambiarDatoReprogramacion = (event) => {
    const { name, value } = event.target;

    setDatosReprogramacion((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  // =========================================
  // GUARDAR REPROGRAMACIÓN
  // =========================================

  const guardarReprogramacion = (event) => {
    event.preventDefault();

    if (!actividadReprogramando) {
      return;
    }

    if (!datosReprogramacion.fechaActual) {
      alert("Seleccione la nueva fecha.");

      return;
    }

    if (!datosReprogramacion.motivo.trim()) {
      alert("Debe indicar el motivo de la reprogramación.");

      return;
    }

    const nuevaFecha = convertirFechaInput(datosReprogramacion.fechaActual);

    if (!nuevaFecha) {
      alert("Seleccione una fecha válida.");

      return;
    }

    const semanaOriginalFecha = actividadReprogramando.fechaOriginal
      ? convertirFechaInput(actividadReprogramando.fechaOriginal)
      : convertirFechaInput(actividadReprogramando.fecha);

    const semanaOriginal = semanaOriginalFecha
      ? obtenerNumeroSemanaISO(semanaOriginalFecha)
      : obtenerNumeroSemanaISO(nuevaFecha);

    const anioSemanaOriginal = semanaOriginalFecha
      ? obtenerAnioISO(semanaOriginalFecha)
      : obtenerAnioISO(nuevaFecha);

    const semanaFecha = obtenerNumeroSemanaISO(nuevaFecha);

    const anioFecha = obtenerAnioISO(nuevaFecha);

    const fechaOriginal =
      actividadReprogramando.fechaOriginal || actividadReprogramando.fecha;

    const cambios = {
      estado: "Reprogramada",

      fecha: datosReprogramacion.fechaActual,

      fechaOriginal,

      fechaActual: datosReprogramacion.fechaActual,

      semanaOriginal,

      anioSemanaOriginal,

      semanaReprogramada: semanaFecha,

      anioSemanaReprogramada: anioFecha,

      motivoReprogramacion: datosReprogramacion.motivo.trim(),

      observacionReprogramacion: datosReprogramacion.observacion.trim(),

      // El ID PM se conserva automáticamente.
      pmId: actividadReprogramando.pmId || "",
    };

    modificarActividadContext(actividadReprogramando.id, cambios);

    setMostrarFormularioReprogramacion(false);

    setActividadReprogramando(null);

    setDatosReprogramacion({
      fechaActual: "",
      motivo: "",
      observacion: "",
    });
  };

  // =========================================
  // CANCELAR REPROGRAMACIÓN
  // =========================================

  const cancelarReprogramacion = () => {
    setMostrarFormularioReprogramacion(false);

    setActividadReprogramando(null);

    setDatosReprogramacion({
      fechaActual: "",
      motivo: "",
      observacion: "",
    });
  };

  // =========================================
  // VER DETALLE
  // =========================================

  const verDetalleReprogramacion = (actividad) => {
    setActividadDetalle(actividad);
  };

  // =========================================
  // CERRAR DETALLE
  // =========================================

  const cerrarDetalleReprogramacion = () => {
    setActividadDetalle(null);
  };

  // =========================================
  // CERRAR FORMULARIO
  // =========================================

  const cerrarFormularioActividad = () => {
    setMostrarFormularioActividad(false);

    setModoEdicion(false);

    setActividadEditandoId(null);

    setPmEncontrado(null);

    setPmValidacion("vacio");
  };

  // =========================================
  // CAMBIAR CUADRILLA
  // =========================================

  const cambiarCuadrillaActividad = (event) => {
    const cuadrillaId = event.target.value;

    const cuadrillaSeleccionadaNueva = cuadrillas.find(
      (cuadrilla) => cuadrilla.id === cuadrillaId,
    );

    setNuevaActividad((anterior) => ({
      ...anterior,
      cuadrillaId,

      responsable: cuadrillaSeleccionadaNueva
        ? cuadrillaSeleccionadaNueva.ingeniero
        : "",
    }));
  };

  // =========================================
  // CAMBIAR CAMPOS
  // =========================================

  const cambiarCampoActividad = (event) => {
    const { name, value } = event.target;

    if (name === "codigoOT") {
      const valorNumerico = value.replace(/\D/g, "");

      setNuevaActividad((anterior) => ({
        ...anterior,
        codigoOT: valorNumerico,
      }));

      return;
    }

    setNuevaActividad((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  // =========================================
  // CONVERTIR FECHA INPUT
  // =========================================

  const convertirFechaInput = (fechaString) => {
    if (!fechaString) {
      return null;
    }

    const [anio, mes, dia] = fechaString.split("-").map(Number);

    const fecha = new Date(anio, mes - 1, dia);

    return isNaN(fecha.getTime()) ? null : fecha;
  };

  // =========================================
  // VALIDAR VÍNCULO PM
  // =========================================

  const validarVinculoPM = () => {
    const idPM = normalizarPMId(nuevaActividad.pmId);

    if (!idPM) {
      return {
        valido: true,
        plan: null,
      };
    }

    const planPM = buscarPMPorId(idPM);

    if (!planPM) {
      return {
        valido: false,
        plan: null,
      };
    }

    const actividadDuplicadaPM = actividades.find(
      (actividad) =>
        actividad.id !== actividadEditandoId &&
        normalizarPMId(actividad.pmId || "") === idPM,
    );

    if (actividadDuplicadaPM) {
      return {
        valido: false,
        plan: planPM,
        duplicado: true,
      };
    }

    return {
      valido: true,
      plan: planPM,
    };
  };

  // =========================================
  // GUARDAR ACTIVIDAD
  // =========================================

  const guardarNuevaActividad = (event) => {
    event.preventDefault();

    if (
      !nuevaActividad.fecha ||
      !nuevaActividad.nombre.trim() ||
      !nuevaActividad.tipo ||
      !nuevaActividad.subestacion.trim() ||
      !nuevaActividad.zona ||
      !nuevaActividad.cuadrillaId ||
      !nuevaActividad.responsable
    ) {
      alert("Complete todos los campos obligatorios.");

      return;
    }

    if (
      nuevaActividad.codigoOT.trim() &&
      !/^\d+$/.test(nuevaActividad.codigoOT.trim())
    ) {
      alert("El Código OT debe contener únicamente números.");

      return;
    }

    const fechaActividad = convertirFechaInput(nuevaActividad.fecha);

    if (!fechaActividad) {
      alert("Seleccione una fecha válida.");

      return;
    }

    const semanaFecha = obtenerNumeroSemanaISO(fechaActividad);

    const anioFecha = obtenerAnioISO(fechaActividad);

    // =======================================
    // VALIDAR SEMANA
    // =======================================

    if (semanaFecha !== semanaActual || anioFecha !== anioActual) {
      alert(
        `La fecha seleccionada no pertenece a la Semana ${semanaActual} de ${anioActual}.\n\n` +
          `La semana seleccionada corresponde del ${formatearFecha(
            fechasSemana.lunes,
          )} al ${formatearFecha(fechasSemana.domingo)}.`,
      );

      return;
    }

    // =======================================
    // VALIDAR ID PM
    // =======================================

    const validacionPM = validarVinculoPM();

    if (!validacionPM.valido) {
      if (validacionPM.duplicado) {
        alert("Este ID PM ya está vinculado a otra actividad programada.");
      } else {
        alert(
          "ID PM no encontrado.\n\nVerifique el identificador e intente nuevamente.",
        );
      }

      return;
    }

    const pmIdNormalizado = normalizarPMId(nuevaActividad.pmId);

    // =======================================
    // MODIFICAR
    // =======================================

    if (modoEdicion) {
      const actividadAnterior = actividades.find(
        (actividad) => actividad.id === actividadEditandoId,
      );

      const pmIdConservado = actividadAnterior?.pmId || pmIdNormalizado || "";

      const cambios = {
        fecha: nuevaActividad.fecha,

        codigoOT: nuevaActividad.codigoOT.trim(),

        nombre: nuevaActividad.nombre.trim(),

        tipo: nuevaActividad.tipo,

        nt: nuevaActividad.nt || "",

        subestacion: nuevaActividad.subestacion.trim(),

        zona: nuevaActividad.zona,

        cuadrillaId: nuevaActividad.cuadrillaId,

        responsable: nuevaActividad.responsable,

        camioneta: nuevaActividad.camioneta || "",

        mantenimiento: nuevaActividad.mantenimiento || "",

        estado: nuevaActividad.estado,

        // Si ya existía, se conserva.
        // Si la actividad era independiente y se
        // vinculó ahora, se guarda el nuevo ID.
        pmId: pmIdConservado,
      };

      // =====================================
      // CONSERVAR INFORMACIÓN REPROGRAMACIÓN
      // =====================================

      if (
        actividadAnterior?.estado === "Reprogramada" ||
        actividadAnterior?.estado === "Ejecutado Reprogramado"
      ) {
        cambios.fechaOriginal =
          actividadAnterior.fechaOriginal || actividadAnterior.fecha;

        cambios.fechaActual = nuevaActividad.fecha;

        cambios.semanaOriginal = actividadAnterior.semanaOriginal;

        cambios.anioSemanaOriginal = actividadAnterior.anioSemanaOriginal;

        cambios.semanaReprogramada = actividadAnterior.semanaReprogramada;

        cambios.anioSemanaReprogramada =
          actividadAnterior.anioSemanaReprogramada;

        cambios.motivoReprogramacion =
          actividadAnterior.motivoReprogramacion || "";

        cambios.observacionReprogramacion =
          actividadAnterior.observacionReprogramacion || "";
      }

      modificarActividadContext(actividadEditandoId, cambios);

      cerrarFormularioActividad();

      return;
    }

    // =======================================
    // CREAR NUEVA ACTIVIDAD
    // =======================================

    const nueva = {
      id: Date.now(),

      fecha: nuevaActividad.fecha,

      codigoOT: nuevaActividad.codigoOT.trim(),

      nombre: nuevaActividad.nombre.trim(),

      tipo: nuevaActividad.tipo,

      nt: nuevaActividad.nt || "",

      subestacion: nuevaActividad.subestacion.trim(),

      zona: nuevaActividad.zona,

      cuadrillaId: nuevaActividad.cuadrillaId,

      responsable: nuevaActividad.responsable,

      camioneta: nuevaActividad.camioneta || "",

      mantenimiento: nuevaActividad.mantenimiento || "",

      estado: nuevaActividad.estado,

      pmId: pmIdNormalizado,
    };

    agregarActividad(nueva);

    cerrarFormularioActividad();

    setNuevaActividad({
      fecha: "",
      codigoOT: "",
      nombre: "",
      tipo: "",
      nt: "",
      subestacion: "",
      zona: "",
      cuadrillaId: "",
      responsable: "",
      camioneta: "",
      mantenimiento: "",
      estado: "Pendiente",
      pmId: "",
    });
  };

  // =========================================
  // FECHA ACTIVIDAD
  // =========================================

  const obtenerFechaActividad = (actividad) => {
    if (!actividad.fecha) {
      return null;
    }

    if (typeof actividad.fecha === "string" && actividad.fecha.includes("-")) {
      return convertirFechaInput(actividad.fecha);
    }

    const fecha = new Date(actividad.fecha);

    return isNaN(fecha.getTime()) ? null : fecha;
  };

  // =========================================
  // OBTENER TEXTO DE ACTIVIDAD
  // =========================================

  const obtenerTextoActividad = (actividad) => {
    return [
      actividad.codigoOT,
      actividad.nombre,
      actividad.actividad,
      actividad.subestacion,
      actividad.zona,
      actividad.responsable,
      actividad.cuadrillaId,
      actividad.camioneta,
      actividad.mantenimiento,
      actividad.tipo,
      actividad.estado,
      actividad.pmId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  // =========================================
  // FILTRAR ACTIVIDADES
  // =========================================

  const actividadesFiltradas = actividades.filter((actividad) => {
    const fechaActividad = obtenerFechaActividad(actividad);

    let coincideSemana = false;

    if (fechaActividad) {
      const semanaActividad = obtenerNumeroSemanaISO(fechaActividad);

      const anioActividad = obtenerAnioISO(fechaActividad);

      coincideSemana =
        semanaActividad === semanaActual && anioActividad === anioActual;
    }

    const textoBusqueda = busqueda.toLowerCase().trim();

    const coincideBusqueda =
      !textoBusqueda ||
      obtenerTextoActividad(actividad).includes(textoBusqueda);

    const coincideEstado =
      filtroEstado === "Todos" || actividad.estado === filtroEstado;

    const coincideSubestacion =
      filtroSubestacion === "Todas" ||
      actividad.subestacion === filtroSubestacion;

    const coincideCuadrilla =
      filtroCuadrilla === "Todas" ||
      obtenerCuadrillaActividad(actividad) === filtroCuadrilla;

    const tipoActividad = actividad.tipo || "";

    const esFueraDePM = TIPOS_FUERA_PM.includes(tipoActividad);

    const tienePM = Boolean(actividad.pmId && actividad.pmId.trim());

    const coincidePM =
      filtroPM === "Todos" ||
      (filtroPM === "PM" && tienePM) ||
      (filtroPM === "Fuera de PM" && !tienePM);

    const mantenimientoActividad = actividad.mantenimiento || "";

    const coincideMantenimiento =
      filtroMantenimiento === "Todos" ||
      mantenimientoActividad === filtroMantenimiento;

    return (
      coincideSemana &&
      coincideBusqueda &&
      coincideEstado &&
      coincideSubestacion &&
      coincideCuadrilla &&
      coincidePM &&
      coincideMantenimiento
    );
  });

  // =========================================
  // RESUMEN
  // =========================================

  const totalActividades = actividadesFiltradas.length;

  const actividadesPendientes = actividadesFiltradas.filter(
    (actividad) => actividad.estado === "Pendiente",
  ).length;

  const actividadesReprogramadas = actividadesFiltradas.filter(
    (actividad) => actividad.estado === "Reprogramada",
  ).length;

  const actividadesEjecutadas = actividadesFiltradas.filter(
    (actividad) =>
      actividad.estado === "Ejecutada" ||
      actividad.estado === "Ejecutado Reprogramado",
  ).length;

  // =========================================
  // SUBESTACIONES
  // =========================================

  const subestaciones = [
    ...new Set(
      actividades.map((actividad) => actividad.subestacion).filter(Boolean),
    ),
  ];

  // =========================================
  // LIMPIAR FILTROS
  // =========================================

  const limpiarFiltros = () => {
    setBusqueda("");

    setFiltroPM("Todos");

    setFiltroEstado("Todos");

    setFiltroSubestacion("Todas");

    setFiltroCuadrilla("Todas");

    setFiltroMantenimiento("Todos");
  };

  // =========================================
  // INTERFAZ
  // =========================================

  return (
    <div className="programacion">
      {/* ENCABEZADO */}

      <div className="programacion-title-card">
        <div className="programacion-header">
          <div>
            <h1>Programación semanal</h1>

            <p>Gestion de las actividades programadas</p>
          </div>

          <button
            className="new-activity-button"
            onClick={abrirFormularioActividad}
          >
            + Nueva actividad
          </button>
        </div>
      </div>

      {/* SELECTOR DE SEMANA */}

      <div className="week-selector">
        <button className="week-navigation" onClick={semanaAnterior}>
          ←
        </button>

        <div className="selected-week">
          <strong>Semana {semanaActual}</strong>

          <small>
            {formatearFechaCorta(fechasSemana.lunes)}

            {" - "}

            {formatearFechaCorta(fechasSemana.domingo)}
          </small>
        </div>

        <button className="week-navigation" onClick={semanaSiguiente}>
          →
        </button>
      </div>

      {/* DISPONIBILIDAD */}

      <div className="availability-card">
        <div className="availability-header">
          <div>
            <span className="availability-label">DISPONIBILIDAD ACTUAL</span>

            <h2>
              {cuadrillaActual
                ? `${cuadrillaActual.nombre} — ${cuadrillaActual.ingeniero}`
                : "Sin disponibilidad registrada"}
            </h2>
          </div>

          <div className="availability-actions">
            <span
              className={`availability-type ${
                cambioManualActual ? "manual" : "rotation"
              }`}
            >
              {cambioManualActual
                ? "⚠️ Cambio manual"
                : "🔄 Rotación automática"}
            </span>

            <button
              className="edit-availability-button"
              onClick={abrirFormulario}
            >
              ✏️ Modificar
            </button>
          </div>
        </div>

        <div className="availability-details">
          <div className="availability-detail">
            <span>Inicio de disponibilidad</span>

            <strong>
              {formatearDisponibilidad(fechasDisponibilidad.inicio)}
            </strong>
          </div>

          <div className="availability-detail">
            <span>Fin de disponibilidad</span>

            <strong>{formatearDisponibilidad(fechasDisponibilidad.fin)}</strong>
          </div>

          <div className="availability-detail">
            <span>Siguiente cuadrilla</span>

            <strong>
              {siguienteCuadrilla
                ? `${siguienteCuadrilla.nombre} — ${siguienteCuadrilla.ingeniero}`
                : "No disponible"}
            </strong>
          </div>
        </div>

        {cambioManualActual && (
          <div className="availability-change">
            <strong>Motivo:</strong>

            <span>{cambioManualActual.motivo}</span>
          </div>
        )}
      </div>

      {/* FORMULARIO DISPONIBILIDAD */}

      {mostrarFormulario && (
        <div className="availability-form-card">
          <div className="availability-form-header">
            <div>
              <span>MODIFICAR DISPONIBILIDAD</span>

              <h2>
                Semana {semanaActual} — {anioActual}
              </h2>
            </div>

            <button className="close-form-button" onClick={cancelarFormulario}>
              ×
            </button>
          </div>

          <form onSubmit={guardarCambio}>
            <div className="availability-form-grid">
              <div className="form-field">
                <label htmlFor="cuadrilla">Cuadrilla</label>

                <select
                  id="cuadrilla"
                  value={cuadrillaSeleccionada}
                  onChange={(e) => setCuadrillaSeleccionada(e.target.value)}
                >
                  <option value="">Seleccione una cuadrilla</option>

                  {obtenerCuadrillasActivas().map((cuadrilla) => (
                    <option key={cuadrilla.id} value={cuadrilla.id}>
                      {cuadrilla.nombre}
                      {" — "}
                      {cuadrilla.ingeniero}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Inicio de disponibilidad</label>

                <input
                  type="text"
                  value={formatearDisponibilidad(fechasDisponibilidad.inicio)}
                  disabled
                />
              </div>

              <div className="form-field">
                <label>Fin de disponibilidad</label>

                <input
                  type="text"
                  value={formatearDisponibilidad(fechasDisponibilidad.fin)}
                  disabled
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="motivo">Motivo del cambio</label>

                <textarea
                  id="motivo"
                  value={motivoCambio}
                  onChange={(e) => setMotivoCambio(e.target.value)}
                  placeholder="Ejemplo: Maniobra programada..."
                  rows="4"
                />
              </div>
            </div>

            <div className="availability-form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={cancelarFormulario}
              >
                Cancelar
              </button>

              <button type="submit" className="save-availability-button">
                Guardar cambio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FORMULARIO ACTIVIDAD */}

      {mostrarFormularioActividad && (
        <div className="new-activity-card">
          <div className="new-activity-header">
            <div>
              <span>
                {modoEdicion ? "MODIFICAR ACTIVIDAD" : "NUEVA ACTIVIDAD"}
              </span>

              <h2>
                Semana {semanaActual} — {anioActual}
              </h2>
            </div>

            <button
              className="close-form-button"
              onClick={cerrarFormularioActividad}
            >
              ×
            </button>
          </div>

          <form onSubmit={guardarNuevaActividad}>
            <div className="new-activity-grid">
              {/* FECHA */}

              <div className="form-field">
                <label htmlFor="fecha">Fecha *</label>

                <input
                  id="fecha"
                  name="fecha"
                  type="date"
                  value={nuevaActividad.fecha}
                  onChange={cambiarCampoActividad}
                  required
                />

                <small>
                  Seleccione una fecha entre{" "}
                  {formatearFecha(fechasSemana.lunes)}
                  {" y "}
                  {formatearFecha(fechasSemana.domingo)}.
                </small>
              </div>

              {/* CÓDIGO OT */}

              <div className="form-field">
                <label htmlFor="codigoOT">Código OT</label>

                <input
                  id="codigoOT"
                  name="codigoOT"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={nuevaActividad.codigoOT}
                  onChange={cambiarCampoActividad}
                  placeholder="Opcional"
                />

                <small>
                  Código numérico de la Orden de Trabajo. Este campo es
                  opcional.
                </small>
              </div>

              {/* ID PM */}

              <div className="form-field">
                <label htmlFor="pmId">ID PM</label>

                <input
                  id="pmId"
                  name="pmId"
                  type="text"
                  value={nuevaActividad.pmId}
                  onChange={cambiarIdPM}
                  placeholder="Ejemplo: PM-2026-000125"
                  disabled={modoEdicion && Boolean(nuevaActividad.pmId)}
                  style={
                    modoEdicion && nuevaActividad.pmId
                      ? {
                          backgroundColor: "#f3f4f6",
                          cursor: "not-allowed",
                        }
                      : undefined
                  }
                />

                {!nuevaActividad.pmId && (
                  <small>
                    Opcional. Ingrese el ID del Plan de Mantenimiento para
                    vincular esta actividad.
                  </small>
                )}

                {pmValidacion === "invalido" && (
                  <small
                    style={{
                      color: "#b42318",
                      fontWeight: "600",
                    }}
                  >
                    ID PM no encontrado.
                  </small>
                )}

                {pmValidacion === "valido" && pmEncontrado && (
                  <small
                    style={{
                      color: "#16794c",
                      fontWeight: "600",
                    }}
                  >
                    ✓ ID PM validado
                  </small>
                )}
              </div>

              {/* ACTIVIDAD */}

              <div className="form-field">
                <label htmlFor="nombre">Actividad *</label>

                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={nuevaActividad.nombre}
                  onChange={cambiarCampoActividad}
                  placeholder="Ejemplo: Mantenimiento preventivo"
                  required
                />
              </div>

              {/* TIPO */}

              <div className="form-field">
                <label htmlFor="tipoActividad">Tipo *</label>

                <select
                  id="tipoActividad"
                  name="tipo"
                  value={nuevaActividad.tipo}
                  onChange={cambiarCampoActividad}
                  required
                >
                  <option value="">Seleccione el tipo de actividad</option>

                  {TIPOS_ACTIVIDAD.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>

                <small>Clasifique la actividad según el PM anual.</small>
              </div>

              {/* NT */}

              <div className="form-field">
                <label htmlFor="nt">NT</label>

                <select
                  id="nt"
                  name="nt"
                  value={nuevaActividad.nt}
                  onChange={cambiarCampoActividad}
                >
                  <option value="">Seleccione NT</option>

                  <option value="NIV III">NIV III</option>

                  <option value="NIV IV">NIV IV</option>

                  <option value="REC 34,5KV">REC 34,5KV</option>

                  <option value="REC 13,8KV">REC 13,8KV</option>
                </select>
              </div>

              {/* SUBESTACIÓN */}

              <div className="form-field">
                <label htmlFor="subestacion">Subestación *</label>

                <input
                  id="subestacion"
                  name="subestacion"
                  type="text"
                  value={nuevaActividad.subestacion}
                  onChange={cambiarCampoActividad}
                  placeholder="Ejemplo: Subestación Ocaña"
                  required
                />
              </div>

              {/* ZONA */}

              <div className="form-field">
                <label htmlFor="zona">Zona *</label>

                <select
                  id="zona"
                  name="zona"
                  value={nuevaActividad.zona}
                  onChange={cambiarCampoActividad}
                  required
                >
                  <option value="">Seleccione una zona</option>

                  {ZONAS.map((zona) => (
                    <option key={zona} value={zona}>
                      {zona}
                    </option>
                  ))}
                </select>
              </div>

              {/* CUADRILLA */}

              <div className="form-field">
                <label htmlFor="cuadrillaActividad">Cuadrilla *</label>

                <select
                  id="cuadrillaActividad"
                  value={nuevaActividad.cuadrillaId}
                  onChange={cambiarCuadrillaActividad}
                  required
                >
                  <option value="">Seleccione una cuadrilla</option>

                  {obtenerTodasCuadrillasActivas().map((cuadrilla) => (
                    <option key={cuadrilla.id} value={cuadrilla.id}>
                      {cuadrilla.nombre}
                      {" — "}
                      {cuadrilla.ingeniero}
                    </option>
                  ))}
                </select>
              </div>

              {/* RESPONSABLE */}

              <div className="form-field">
                <label htmlFor="responsable">Responsable *</label>

                <select
                  id="responsable"
                  name="responsable"
                  value={nuevaActividad.responsable}
                  onChange={cambiarCampoActividad}
                  disabled={!nuevaActividad.cuadrillaId}
                  required
                >
                  <option value="">
                    {nuevaActividad.cuadrillaId
                      ? "Seleccione responsable"
                      : "Primero seleccione cuadrilla"}
                  </option>

                  {nuevaActividad.cuadrillaId &&
                    (() => {
                      const cuadrilla = cuadrillas.find(
                        (item) => item.id === nuevaActividad.cuadrillaId,
                      );

                      return cuadrilla ? (
                        <option value={cuadrilla.ingeniero}>
                          {cuadrilla.ingeniero}
                        </option>
                      ) : null;
                    })()}
                </select>
              </div>

              {/* CAMIONETA */}

              <div className="form-field">
                <label htmlFor="camioneta">Camioneta</label>

                <select
                  id="camioneta"
                  name="camioneta"
                  value={nuevaActividad.camioneta}
                  onChange={cambiarCampoActividad}
                >
                  <option value="">Sin asignar</option>

                  {camionetas.map((camioneta) => (
                    <option key={camioneta.placa} value={camioneta.placa}>
                      {camioneta.placa}
                    </option>
                  ))}
                </select>

                <small>
                  Seleccione el vehículo asignado o deje "Sin asignar".
                </small>
              </div>

              {/* MANTENIMIENTO */}

              <div className="form-field">
                <label htmlFor="mantenimiento">Tipo de mantenimiento</label>

                <select
                  id="mantenimiento"
                  name="mantenimiento"
                  value={nuevaActividad.mantenimiento}
                  onChange={cambiarCampoActividad}
                >
                  <option value="">No especificado</option>

                  {TIPOS_MANTENIMIENTO.map((mantenimiento) => (
                    <option key={mantenimiento} value={mantenimiento}>
                      {mantenimiento}
                    </option>
                  ))}
                </select>

                <small>Campo opcional para clasificar el mantenimiento.</small>
              </div>

              {/* ESTADO */}

              <div className="form-field">
                <label htmlFor="estadoActividad">Estado</label>

                <select
                  id="estadoActividad"
                  name="estado"
                  value={nuevaActividad.estado}
                  onChange={cambiarCampoActividad}
                >
                  <option value="Pendiente">Pendiente</option>

                  <option value="Reprogramada">Reprogramada</option>

                  <option value="Ejecutado Reprogramado">
                    Ejecutado Reprogramado
                  </option>

                  <option value="Ejecutada">Ejecutada</option>

                  <option value="Emergencia">Emergencia</option>
                </select>
              </div>
            </div>

            {/* INFORMACIÓN PM VALIDADO */}

            {pmValidacion === "valido" && pmEncontrado && (
              <div
                style={{
                  marginTop: "14px",
                  padding: "12px 14px",
                  border: "1px solid #dce9e2",
                  borderRadius: "8px",
                  backgroundColor: "#f6faf8",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#16794c",
                    fontSize: "13px",
                  }}
                >
                  PLAN DE MANTENIMIENTO VINCULADO
                </strong>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div>
                    <small
                      style={{
                        display: "block",
                        color: "#667085",
                      }}
                    >
                      ID PM
                    </small>

                    <strong>
                      {pmEncontrado.pmId ||
                        pmEncontrado.id ||
                        nuevaActividad.pmId}
                    </strong>
                  </div>

                  <div>
                    <small
                      style={{
                        display: "block",
                        color: "#667085",
                      }}
                    >
                      Año PM
                    </small>

                    <strong>{pmEncontrado.anio || "No registrado"}</strong>
                  </div>

                  <div>
                    <small
                      style={{
                        display: "block",
                        color: "#667085",
                      }}
                    >
                      Semana PM
                    </small>

                    <strong>{pmEncontrado.semana || "No registrada"}</strong>
                  </div>

                  <div>
                    <small
                      style={{
                        display: "block",
                        color: "#667085",
                      }}
                    >
                      Estado PM
                    </small>

                    <strong>{pmEncontrado.estado || "P"}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="availability-form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={cerrarFormularioActividad}
              >
                Cancelar
              </button>

              <button type="submit" className="save-availability-button">
                {modoEdicion ? "Guardar cambios" : "Guardar actividad"}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* FORMULARIO DE REPROGRAMACIÓN */}

      {mostrarFormularioReprogramacion && actividadReprogramando && (
        <div className="reprogramacion-overlay">
          <div className="reprogramacion-modal">
            <div className="reprogramacion-modal-header">
              <div>
                <span>REPROGRAMACIÓN</span>

                <h2>Registrar nueva programación</h2>
              </div>

              <button
                type="button"
                className="close-form-button"
                onClick={cancelarReprogramacion}
              >
                ×
              </button>
            </div>

            <div className="reprogramacion-activity-info">
              <strong>{actividadReprogramando.nombre}</strong>

              <span>{actividadReprogramando.subestacion}</span>
            </div>

            <form onSubmit={guardarReprogramacion}>
              <div className="reprogramacion-grid">
                <div className="form-field">
                  <label>Fecha original</label>

                  <input
                    type="text"
                    value={
                      actividadReprogramando.fechaOriginal ||
                      actividadReprogramando.fecha ||
                      ""
                    }
                    disabled
                  />

                  <small>
                    Fecha en la que estaba programada originalmente.
                  </small>
                </div>

                <div className="form-field">
                  <label htmlFor="fechaActual">Fecha actual *</label>

                  <input
                    id="fechaActual"
                    name="fechaActual"
                    type="date"
                    value={datosReprogramacion.fechaActual}
                    onChange={cambiarDatoReprogramacion}
                    required
                  />

                  <small>Seleccione la nueva fecha de programación.</small>
                </div>

                <div className="form-field form-field-full">
                  <label htmlFor="motivoReprogramacion">
                    Motivo de reprogramación *
                  </label>

                  <textarea
                    id="motivoReprogramacion"
                    name="motivo"
                    value={datosReprogramacion.motivo}
                    onChange={cambiarDatoReprogramacion}
                    placeholder="Ejemplo: Indisponibilidad de la subestación, falta de autorización, condiciones operativas..."
                    rows="3"
                    required
                  />
                </div>

                <div className="form-field form-field-full">
                  <label htmlFor="observacionReprogramacion">Observación</label>

                  <textarea
                    id="observacionReprogramacion"
                    name="observacion"
                    value={datosReprogramacion.observacion}
                    onChange={cambiarDatoReprogramacion}
                    placeholder="Agregue una observación adicional si es necesario."
                    rows="3"
                  />
                </div>
              </div>

              <div className="reprogramacion-form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={cancelarReprogramacion}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-availability-button">
                  Guardar reprogramación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          DETALLE DE ACTIVIDAD
      ========================================= */}

      {actividadDetalle && (
        <div className="activity-detail-overlay">
          <div className="activity-detail-modal">
            {/* ENCABEZADO */}

            <div className="activity-detail-header">
              <div>
                <span>DETALLE DE ACTIVIDAD</span>

                <h2>Información de la actividad</h2>
              </div>

              <button
                type="button"
                className="activity-detail-close"
                onClick={cerrarDetalleReprogramacion}
              >
                ×
              </button>
            </div>

            {/* IDENTIFICACIÓN */}

            <div className="activity-detail-title">
              <strong>{actividadDetalle.nombre}</strong>

              <span>{actividadDetalle.subestacion}</span>
            </div>

            {/* INFORMACIÓN */}

            <div className="activity-detail-grid">
              <div className="activity-detail-item">
                <span>Código OT</span>

                <strong>{actividadDetalle.codigoOT || "No registrado"}</strong>
              </div>

              <div className="activity-detail-item">
                <span>Camioneta</span>

                <strong>{actividadDetalle.camioneta || "No asignada"}</strong>
              </div>

              <div className="activity-detail-item">
                <span>Zona</span>

                <strong>{actividadDetalle.zona || "No especificada"}</strong>
              </div>

              <div className="activity-detail-item">
                <span>Mantenimiento</span>

                <strong>
                  {actividadDetalle.mantenimiento || "No especificado"}
                </strong>
              </div>

              <div className="activity-detail-item">
                <span>Estado</span>

                <strong className="activity-detail-status">
                  {actividadDetalle.estado || "No registrado"}
                </strong>
              </div>

              <div className="activity-detail-item">
                <span>Tipo</span>

                <strong>{actividadDetalle.tipo || "Sin tipo"}</strong>
              </div>

              <div className="activity-detail-item">
                <span>Responsable</span>

                <strong>
                  {actividadDetalle.responsable || "No registrado"}
                </strong>
              </div>

              <div className="activity-detail-item">
                <span>Cuadrilla</span>

                <strong>
                  {(() => {
                    const cuadrilla = cuadrillas.find(
                      (item) =>
                        item.id === obtenerCuadrillaActividad(actividadDetalle),
                    );

                    return cuadrilla ? cuadrilla.nombre : "No asignada";
                  })()}
                </strong>
              </div>

              {/* ORIGEN PM */}

              <div className="activity-detail-item">
                <span>Origen</span>

                <strong>
                  {actividadDetalle.pmId
                    ? "Plan de Mantenimiento"
                    : "Independiente"}
                </strong>
              </div>

              {/* ID PM */}

              <div className="activity-detail-item">
                <span>ID PM</span>

                <strong>{actividadDetalle.pmId || "No aplica"}</strong>
              </div>

              <div className="activity-detail-item">
                <span>Fecha original</span>

                <strong>
                  {actividadDetalle.fechaOriginal
                    ? formatearFechaActividad(
                        obtenerFechaActividad({
                          fecha: actividadDetalle.fechaOriginal,
                        }),
                      )
                    : formatearFechaActividad(
                        obtenerFechaActividad(actividadDetalle),
                      )}
                </strong>
              </div>

              <div className="activity-detail-item">
                <span>Nueva fecha</span>

                <strong>
                  {actividadDetalle.fechaActual
                    ? formatearFechaActividad(
                        obtenerFechaActividad({
                          fecha: actividadDetalle.fechaActual,
                        }),
                      )
                    : formatearFechaActividad(
                        obtenerFechaActividad(actividadDetalle),
                      )}
                </strong>
              </div>

              {actividadDetalle.pmId && (
                <>
                  <div className="activity-detail-item">
                    <span>Semana original</span>

                    <strong>
                      {actividadDetalle.semanaOriginal &&
                      actividadDetalle.anioSemanaOriginal
                        ? `Semana ${actividadDetalle.semanaOriginal} — ${actividadDetalle.anioSemanaOriginal}`
                        : "No registrada"}
                    </strong>
                  </div>

                  <div className="activity-detail-item">
                    <span>Semana reprogramada</span>

                    <strong>
                      {actividadDetalle.semanaReprogramada &&
                      actividadDetalle.anioSemanaReprogramada
                        ? `Semana ${actividadDetalle.semanaReprogramada} — ${actividadDetalle.anioSemanaReprogramada}`
                        : "No registrada"}
                    </strong>
                  </div>
                </>
              )}

              <div className="activity-detail-item activity-detail-full">
                <span>Motivo de reprogramación</span>

                <strong className="activity-detail-text">
                  {actividadDetalle.motivoReprogramacion || "No registrado"}
                </strong>
              </div>

              <div className="activity-detail-item activity-detail-full">
                <span>Observación</span>

                <strong className="activity-detail-text">
                  {actividadDetalle.observacionReprogramacion ||
                    "Sin observaciones"}
                </strong>
              </div>
            </div>

            {/* ACCIONES */}

            <div className="activity-detail-actions">
              <button
                type="button"
                className="activity-detail-close-button"
                onClick={cerrarDetalleReprogramacion}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS */}

      <div className="programacion-filters">
        {/* BÚSQUEDA */}

        <div className="filter-group filter-search-group">
          <label htmlFor="busqueda">Buscar</label>

          <input
            id="busqueda"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Actividad, OT, placa, subestación, responsable..."
          />
        </div>

        {/* ESTADO */}

        <div className="filter-group">
          <label htmlFor="estado">Estado</label>

          <select
            id="estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="Todos">Todos</option>

            <option value="Pendiente">Pendiente</option>

            <option value="Reprogramada">Reprogramada</option>

            <option value="Ejecutado Reprogramado">
              Ejecutado Reprogramado
            </option>

            <option value="Ejecutada">Ejecutada</option>

            <option value="Emergencia">Emergencia</option>
          </select>
        </div>

        {/* SUBESTACIÓN */}

        <div className="filter-group">
          <label htmlFor="subestacion">Subestación</label>

          <select
            id="subestacion"
            value={filtroSubestacion}
            onChange={(e) => setFiltroSubestacion(e.target.value)}
          >
            <option value="Todas">Todas</option>

            {subestaciones.map((subestacion) => (
              <option key={subestacion} value={subestacion}>
                {subestacion}
              </option>
            ))}
          </select>
        </div>

        {/* CUADRILLA */}

        <div className="filter-group">
          <label htmlFor="filtroCuadrilla">Cuadrilla</label>

          <select
            id="filtroCuadrilla"
            value={filtroCuadrilla}
            onChange={(e) => setFiltroCuadrilla(e.target.value)}
          >
            <option value="Todas">Todas</option>

            {obtenerTodasCuadrillasActivas().map((cuadrilla) => (
              <option key={cuadrilla.id} value={cuadrilla.id}>
                {cuadrilla.nombre}
                {" — "}
                {cuadrilla.ingeniero}
              </option>
            ))}
          </select>
        </div>

        {/* PM */}

        <div className="filter-group">
          <label htmlFor="filtroPM">PM</label>

          <select
            id="filtroPM"
            value={filtroPM}
            onChange={(e) => setFiltroPM(e.target.value)}
          >
            <option value="Todos">Todos</option>

            <option value="PM">PM</option>

            <option value="Fuera de PM">Fuera de PM</option>
          </select>
        </div>

        {/* MANTENIMIENTO */}

        <div className="filter-group">
          <label htmlFor="filtroMantenimiento">Mantenimiento</label>

          <select
            id="filtroMantenimiento"
            value={filtroMantenimiento}
            onChange={(e) => setFiltroMantenimiento(e.target.value)}
          >
            <option value="Todos">Todos</option>

            {TIPOS_MANTENIMIENTO.map((mantenimiento) => (
              <option key={mantenimiento} value={mantenimiento}>
                {mantenimiento}
              </option>
            ))}
          </select>
        </div>

        {/* LIMPIAR */}

        <button
          type="button"
          className="filter-clear-button"
          onClick={limpiarFiltros}
        >
          Limpiar filtros
        </button>
      </div>

      {/* RESUMEN */}

      <div className="activity-summary">
        <div className="activity-summary-item">
          <span>Total</span>

          <strong>{totalActividades}</strong>
        </div>

        <div className="activity-summary-item">
          <span>Pendientes</span>

          <strong>{actividadesPendientes}</strong>
        </div>

        <div className="activity-summary-item">
          <span>Reprogramadas</span>

          <strong>{actividadesReprogramadas}</strong>
        </div>

        <div className="activity-summary-item">
          <span>Ejecutadas</span>

          <strong>{actividadesEjecutadas}</strong>
        </div>
      </div>

      {/* TABLA */}

      <div className="programacion-card">
        <div
          className="programacion-card-header"
          style={{ textAlign: "center" }}
        >
          <h2>Actividades programadas</h2>

          <p>
            Semana {semanaActual} — {anioActual}
            {" · "}
            {actividadesFiltradas.length}
            {" actividad"}
            {actividadesFiltradas.length !== 1 ? "es" : ""}
            {" encontrada"}
            {actividadesFiltradas.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="programacion-table-container">
          <table className="programacion-table">
            <thead>
              <tr>
                <th>Fecha</th>

                <th>Código OT</th>

                <th>Actividad</th>

                <th>Tipo</th>

                <th>Subestación</th>

                <th>Zona</th>

                <th>Cuadrilla</th>

                <th>Responsable</th>

                <th>Camioneta</th>

                <th>Mantenimiento</th>

                <th>Estado</th>

                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {actividadesFiltradas.length > 0 ? (
                actividadesFiltradas.map((actividad) => {
                  const cuadrillaActividad = cuadrillas.find(
                    (cuadrilla) =>
                      cuadrilla.id === obtenerCuadrillaActividad(actividad),
                  );

                  const claseEstado =
                    actividad.estado === "Ejecutado Reprogramado"
                      ? "ejecutada"
                      : (actividad.estado || "")
                          .toLowerCase()
                          .replace(/\s+/g, "-");
                  return (
                    <tr key={actividad.id}>
                      <td>
                        {formatearFechaActividad(
                          obtenerFechaActividad(actividad),
                        )}
                      </td>

                      <td>
                        <strong>{actividad.codigoOT || "—"}</strong>
                      </td>

                      <td className="programacion-activity-name">
                        {actividad.nombre || "Sin nombre"}
                      </td>

                      <td>
                        <span className="activity-type-badge">
                          {actividad.tipo || "Sin tipo"}
                        </span>
                      </td>

                      <td>{actividad.subestacion || "—"}</td>

                      <td>{actividad.zona || "—"}</td>

                      <td>
                        {cuadrillaActividad
                          ? cuadrillaActividad.nombre
                          : "No asignada"}
                      </td>

                      <td>{actividad.responsable || "—"}</td>

                      <td>{actividad.camioneta || "—"}</td>

                      <td>{actividad.mantenimiento || "No especificado"}</td>

                      <td>
                        <select
                          className={`programacion-status-select status-${claseEstado}`}
                          value={actividad.estado}
                          onChange={(e) =>
                            cambiarEstadoActividad(actividad.id, e.target.value)
                          }
                        >
                          <option value="Pendiente">Pendiente</option>

                          <option value="Reprogramada">Reprogramada</option>

                          <option value="Ejecutado Reprogramado">
                            Ejecutado Reprogramado
                          </option>

                          <option value="Ejecutada">Ejecutada</option>

                          <option value="Emergencia">Emergencia</option>
                        </select>

                        {(actividad.estado === "Reprogramada" ||
                          actividad.estado === "Ejecutado Reprogramado") && (
                          <button
                            type="button"
                            className="reprogramacion-detail-button"
                            onClick={() => verDetalleReprogramacion(actividad)}
                          >
                            Ver detalle
                          </button>
                        )}
                      </td>

                      <td>
                        <div className="activity-actions">
                          <button
                            type="button"
                            className="activity-edit-button"
                            onClick={() => modificarActividad(actividad)}
                          >
                            ✏️ Modificar
                          </button>

                          <button
                            type="button"
                            className="activity-duplicate-button"
                            onClick={() => duplicarActividad(actividad)}
                          >
                            📋 Duplicar
                          </button>

                          <button
                            type="button"
                            className="activity-delete-button"
                            onClick={() => eliminarActividad(actividad)}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="12" className="no-activities">
                    No hay actividades programadas para la Semana {semanaActual}
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Programacion;
