import { useEffect, useMemo, useState } from "react";
import { useActividades } from "../context/ActividadesContext";
import { supabase } from "../lib/supabase";
import "./Dashboard.css";

/* ========================================================= */
/* MESES */
/* ========================================================= */

const mesesGrafico = [
  { numero: 1, nombre: "Ene" },
  { numero: 2, nombre: "Feb" },
  { numero: 3, nombre: "Mar" },
  { numero: 4, nombre: "Abr" },
  { numero: 5, nombre: "May" },
  { numero: 6, nombre: "Jun" },
  { numero: 7, nombre: "Jul" },
  { numero: 8, nombre: "Ago" },
  { numero: 9, nombre: "Sep" },
  { numero: 10, nombre: "Oct" },
  { numero: 11, nombre: "Nov" },
  { numero: 12, nombre: "Dic" },
];

/* ========================================================= */
/* TIPOS PM */
/* ========================================================= */

const tiposPM = [
  "Inspeccion",
  "Termografia/coronografia",
  "Baterias",
  "Aceites",
  "Paso y contacto",
  "Podas",
  "Aires",
  "Maniobras",
  "Consignas",
];

const tiposGrupo50 = [
  "Inspeccion",
  "Termografia/coronografia",
  "Baterias",
  "Aceites",
  "Paso y contacto",
  "Podas",
  "Aires",
  "Maniobras",
];

/* ========================================================= */
/* CATEGORÍAS NT */
/* ========================================================= */

const categoriasMantenimiento = [
  "NIV III",
  "NIV IV",
  "REC 13,8KV",
  "REC 34,5KV",
];

/* ========================================================= */
/* TIPOS DE MANTENIMIENTO EVALUADOS */
/* ========================================================= */

const tiposMantenimientoIntegral = ["Preventivo", "Correctivo", "Predictivo"];

const zonasEmergencia = ["Río Meta", "Centro", "Ariari"];

/* ========================================================= */
/* NORMALIZACIÓN DE TEXTO */
/* ========================================================= */

const normalizarTexto = (texto) => {
  if (!texto) return "";

  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

/* ========================================================= */
/* NORMALIZACIÓN DE ID PM */
/* ========================================================= */

const normalizarPMId = (valor) =>
  String(valor || "")
    .trim()
    .toUpperCase();

/* ========================================================= */
/* NORMALIZACIÓN DE TIPOS PM */
/* ========================================================= */

const normalizarTipoPM = (tipo) => {
  const tipoNormalizado = normalizarTexto(tipo);

  if (tipoNormalizado === "termografia/coronometria") {
    return "termografia/coronometria";
  }

  return tipoNormalizado;
};

/* ========================================================= */
/* TIPOS PM PRECALCULADOS */
/* ========================================================= */

const tiposPMNormalizados = tiposPM.map((tipo) => normalizarTipoPM(tipo));

const tiposGrupo50Normalizados = new Set(
  tiposGrupo50.map((tipo) => normalizarTipoPM(tipo)),
);

const claveConsignasPM = normalizarTipoPM("Consignas");

/* ========================================================= */
/* FECHA DE ACTIVIDAD (🔹 FIX: parseo LOCAL, no UTC) */
/* ========================================================= */

const obtenerFecha = (actividad) => {
  if (!actividad) return null;

  const fecha =
    actividad.fechaProgramacion || actividad.fecha || actividad.fechaActividad;

  if (!fecha) return null;

  // Si ya es Date, devolver
  if (fecha instanceof Date) {
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  // 🔹 FIX: parsear strings ISO "YYYY-MM-DD" como fecha LOCAL
  // Sin esto, en Colombia (UTC-5) las fechas se corren un día hacia atrás
  // y las actividades aparecen en el mes/trimestre anterior.
  if (typeof fecha === "string") {
    const matchISO = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchISO) {
      const anio = Number(matchISO[1]);
      const mes = Number(matchISO[2]) - 1;
      const dia = Number(matchISO[3]);
      const fechaLocal = new Date(anio, mes, dia);
      if (!Number.isNaN(fechaLocal.getTime())) return fechaLocal;
    }
  }

  const fechaConvertida = new Date(fecha);

  if (Number.isNaN(fechaConvertida.getTime())) {
    return null;
  }

  return fechaConvertida;
};

/* ========================================================= */
/* INFORMACIÓN DE FECHA */
/* ========================================================= */

const obtenerInformacionFecha = (actividad) => {
  const fecha = obtenerFecha(actividad);

  if (!fecha) {
    return {
      fecha: null,
      anio: null,
      mes: null,
      trimestre: null,
    };
  }

  const anio = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;

  return {
    fecha,
    anio,
    mes,
    trimestre: Math.ceil(mes / 3),
  };
};

/* ========================================================= */
/* CÓDIGO OT */
/* ========================================================= */

const tieneCodigoOT = (actividad) => {
  if (!actividad) return false;

  if (actividad.codigoOT === null || actividad.codigoOT === undefined) {
    return false;
  }

  return String(actividad.codigoOT).trim() !== "";
};

/* ========================================================= */
/* FECHA DEL LUNES DE UNA SEMANA ISO */
/* ========================================================= */

const obtenerFechaSemanaISO = (anio, semana) => {
  const anioNumero = Number(anio);
  const semanaNumero = Number(semana);

  if (!anioNumero || !semanaNumero) {
    return null;
  }

  const fecha = new Date(Date.UTC(anioNumero, 0, 4));

  const diaSemana = fecha.getUTCDay() || 7;

  fecha.setUTCDate(fecha.getUTCDate() - diaSemana + 1 + (semanaNumero - 1) * 7);

  return new Date(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
  );
};

/* ========================================================= */
/* OBTENER AÑO PM */
/* ========================================================= */

const obtenerAnioPM = (actividad) => {
  if (!actividad) return null;

  if (
    actividad.anio !== undefined &&
    actividad.anio !== null &&
    actividad.anio !== ""
  ) {
    const anio = Number(actividad.anio);

    return Number.isNaN(anio) ? null : anio;
  }

  const semana = Number(actividad.semana);

  if (semana) {
    return new Date().getFullYear();
  }

  return null;
};

/* ========================================================= */
/* OBTENER INFORMACIÓN DE FECHA PM */
/* ========================================================= */

const obtenerInformacionFechaPM = (actividad) => {
  const anio = obtenerAnioPM(actividad);
  const semana = Number(actividad?.semana);

  if (!anio || !semana) {
    return {
      anio: anio || null,
      semana: semana || null,
      mes: null,
      trimestre: null,
    };
  }

  const fecha = obtenerFechaSemanaISO(anio, semana);

  if (!fecha) {
    return {
      anio,
      semana,
      mes: null,
      trimestre: null,
    };
  }

  const mes = fecha.getMonth() + 1;

  return {
    anio,
    semana,
    mes,
    trimestre: Math.ceil(mes / 3),
  };
};

/* ========================================================= */
/* OBTENER CATEGORÍA NT */
/* ========================================================= */

const obtenerCategoriaMantenimiento = (actividad) => {
  if (!actividad) return null;

  const nt = normalizarTexto(actividad.nt).replace(/\s+/g, "");

  if (nt === "niviii") {
    return "NIV III";
  }

  if (nt === "niviv") {
    return "NIV IV";
  }

  if (nt === "rec13,8kv") {
    return "REC 13,8KV";
  }

  if (nt === "rec34,5kv") {
    return "REC 34,5KV";
  }

  return null;
};

/* ========================================================= */
/* TIPO DE MANTENIMIENTO INTEGRAL */
/* ========================================================= */

const obtenerTipoMantenimientoIntegral = (actividad) => {
  const tipo = normalizarTexto(actividad?.mantenimiento);

  if (tipo === "preventivo") {
    return "Preventivo";
  }

  if (tipo === "correctivo") {
    return "Correctivo";
  }

  if (tipo === "predictivo") {
    return "Predictivo";
  }

  return null;
};

/* ========================================================= */
/* ZONA DE EMERGENCIA */
/* ========================================================= */

const obtenerZonaEmergencia = (actividad) => {
  const zona = normalizarTexto(actividad?.zona);

  if (zona === "rio meta") {
    return "Río Meta";
  }

  if (zona === "centro") {
    return "Centro";
  }

  if (zona === "ariari") {
    return "Ariari";
  }

  return null;
};

/* ========================================================= */
/* DASHBOARD */
/* ========================================================= */

function Dashboard() {
  const { actividades } = useActividades();

  const anioActual = new Date().getFullYear();

  const [anioSeleccionado, setAnioSeleccionado] = useState(anioActual);

  const [trimestreSeleccionado, setTrimestreSeleccionado] = useState("Todos");

  const [mesSeleccionado, setMesSeleccionado] = useState("Todos");

  /* ========================================================= */
  /* ACTIVIDADES PM (🔹 AHORA DESDE SUPABASE) */
  /* ========================================================= */

  const [actividadesPM, setActividadesPM] = useState([]);

  const [cargandoPM, setCargandoPM] = useState(true);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("pm")
          .select("datos")
          .eq("id", "plan")
          .maybeSingle();

        if (!activo) return;

        if (error) {
          console.error("Error cargando PM desde Supabase:", error);
          setActividadesPM([]);
          return;
        }

        const datos = Array.isArray(data?.datos) ? data.datos : [];

        setActividadesPM(datos);
      } catch (err) {
        console.error("Error inesperado cargando PM:", err);
        setActividadesPM([]);
      } finally {
        if (activo) setCargandoPM(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  // ⚠️ FIN DE LA PARTE 1 — continúa con la PARTE 2 justo debajo.
  /* ========================================================= */
  /* ACTIVIDADES INDEXADAS */
  /* ========================================================= */

  const actividadesIndexadas = useMemo(() => {
    return actividades.map((actividad) => {
      const informacionFecha = obtenerInformacionFecha(actividad);

      return {
        actividad,
        ...informacionFecha,
      };
    });
  }, [actividades]);

  /* ========================================================= */
  /* PM INDEXADAS */
  /* ========================================================= */

  const actividadesPMIndexadas = useMemo(() => {
    return actividadesPM.map((actividad) => {
      const informacionFechaPM = obtenerInformacionFechaPM(actividad);

      return {
        actividad,
        ...informacionFechaPM,
        tipoNormalizado: normalizarTipoPM(actividad?.tipo),
      };
    });
  }, [actividadesPM]);

  /* ========================================================= */
  /* AÑOS DISPONIBLES */
  /* ========================================================= */

  const aniosDisponibles = useMemo(() => {
    const conjuntoAnios = new Set();

    actividadesIndexadas.forEach((item) => {
      if (item.anio !== null) {
        conjuntoAnios.add(item.anio);
      }
    });

    actividadesPMIndexadas.forEach((item) => {
      if (item.anio !== null) {
        conjuntoAnios.add(item.anio);
      }
    });

    conjuntoAnios.add(anioActual);

    return [...conjuntoAnios].sort((a, b) => b - a);
  }, [actividadesIndexadas, actividadesPMIndexadas, anioActual]);

  /* ========================================================= */
  /* ACTIVIDADES DEL AÑO Y PERIODO */
  /* ========================================================= */

  const actividadesMostradas = useMemo(() => {
    const anio = Number(anioSeleccionado);

    const trimestre =
      trimestreSeleccionado === "Todos" ? null : Number(trimestreSeleccionado);

    const mes = mesSeleccionado === "Todos" ? null : Number(mesSeleccionado);

    return actividadesIndexadas.filter((item) => {
      if (item.anio !== anio) {
        return false;
      }

      if (trimestre !== null && item.trimestre !== trimestre) {
        return false;
      }

      if (mes !== null && item.mes !== mes) {
        return false;
      }

      return true;
    });
  }, [
    actividadesIndexadas,
    anioSeleccionado,
    trimestreSeleccionado,
    mesSeleccionado,
  ]);

  /* ========================================================= */
  /* RESUMEN GENERAL + BACKLOG + ANÁLISIS */
  /* ========================================================= */

  const resumenDashboard = useMemo(() => {
    const resultado = {
      total: 0,

      pendientes: 0,
      ejecutadas: 0,
      ejecutadasReprogramadas: 0,
      reprogramadas: 0,
      emergencias: 0,

      /* ===================================================== */
      /* BACKLOG */
      /* ===================================================== */

      backlogEjecutadas: 0,
      backlogEjecutadasReprogramadas: 0,

      datosMensualesBacklog: mesesGrafico.map((mes) => ({
        ...mes,
        ejecutadas: 0,
        ejecutadasReprogramadas: 0,
        total: 0,
      })),

      /* ----------------------------------------------------- */
      /* EJECUCIÓN POR NT Y TIPO DE MANTENIMIENTO */
      /* ----------------------------------------------------- */

      mantenimiento: {
        "NIV III": {
          Preventivo: 0,
          Correctivo: 0,
          Predictivo: 0,
        },

        "NIV IV": {
          Preventivo: 0,
          Correctivo: 0,
          Predictivo: 0,
        },

        "REC 13,8KV": {
          Preventivo: 0,
          Correctivo: 0,
          Predictivo: 0,
        },

        "REC 34,5KV": {
          Preventivo: 0,
          Correctivo: 0,
          Predictivo: 0,
        },
      },

      mantenimientoIntegral: {
        Preventivo: 0,
        Correctivo: 0,
        Predictivo: 0,
      },

      emergenciasZonas: {
        "Río Meta": 0,
        Centro: 0,
        Ariari: 0,
      },
    };

    actividadesMostradas.forEach((item) => {
      const actividad = item.actividad;

      resultado.total += 1;

      const estado = actividad?.estado;

      /* ----------------------------------------------------- */
      /* ESTADOS */
      /* ----------------------------------------------------- */

      if (estado === "Pendiente") {
        resultado.pendientes += 1;
      }

      if (estado === "Ejecutada") {
        resultado.ejecutadas += 1;
      }

      if (estado === "Ejecutado Reprogramado") {
        resultado.ejecutadasReprogramadas += 1;
      }

      if (estado === "Reprogramada") {
        resultado.reprogramadas += 1;
      }

      if (estado === "Emergencia") {
        resultado.emergencias += 1;
      }

      /* ----------------------------------------------------- */
      /* BACKLOG */
      /* ----------------------------------------------------- */

      if (
        tieneCodigoOT(actividad) &&
        (estado === "Ejecutada" || estado === "Ejecutado Reprogramado")
      ) {
        if (estado === "Ejecutada") {
          resultado.backlogEjecutadas += 1;
        }

        if (estado === "Ejecutado Reprogramado") {
          resultado.backlogEjecutadasReprogramadas += 1;
        }

        if (item.mes) {
          const indiceMes = item.mes - 1;

          if (estado === "Ejecutada") {
            resultado.datosMensualesBacklog[indiceMes].ejecutadas += 1;
          }

          if (estado === "Ejecutado Reprogramado") {
            resultado.datosMensualesBacklog[
              indiceMes
            ].ejecutadasReprogramadas += 1;
          }

          resultado.datosMensualesBacklog[indiceMes].total =
            resultado.datosMensualesBacklog[indiceMes].ejecutadas +
            resultado.datosMensualesBacklog[indiceMes].ejecutadasReprogramadas;
        }
      }

      /* ----------------------------------------------------- */
      /* EJECUCIÓN: NT + TIPO DE MANTENIMIENTO */
      /* (🔹 SIN FILTRO DE ESTADO — cuenta TODAS las actividades */
      /*  que tengan Preventivo/Correctivo/Predictivo + NT)      */
      /* ----------------------------------------------------- */

      {
        const categoria = obtenerCategoriaMantenimiento(actividad);

        const tipoMantenimiento = obtenerTipoMantenimientoIntegral(actividad);

        if (
          categoria &&
          tipoMantenimiento &&
          resultado.mantenimiento[categoria]
        ) {
          resultado.mantenimiento[categoria][tipoMantenimiento] += 1;
        }
      }

      /* ----------------------------------------------------- */
      /* TIPO DE MANTENIMIENTO INTEGRAL */
      /* (sin filtro de estado)                                  */
      /* ----------------------------------------------------- */

      const tipoMantenimiento = obtenerTipoMantenimientoIntegral(actividad);

      if (tipoMantenimiento) {
        resultado.mantenimientoIntegral[tipoMantenimiento] += 1;
      }

      /* ----------------------------------------------------- */
      /* EMERGENCIAS POR ZONA */
      /* ----------------------------------------------------- */

      if (estado === "Emergencia") {
        const zona = obtenerZonaEmergencia(actividad);

        if (zona) {
          resultado.emergenciasZonas[zona] += 1;
        }
      }
    });

    return resultado;
  }, [actividadesMostradas]);

  /* ========================================================= */
  /* VARIABLES RESUMEN */
  /* ========================================================= */

  const total = resumenDashboard.total;

  const pendientes = resumenDashboard.pendientes;

  const ejecutadas = resumenDashboard.ejecutadas;

  const ejecutadasReprogramadas = resumenDashboard.ejecutadasReprogramadas;

  const reprogramadas = resumenDashboard.reprogramadas;

  const emergencias = resumenDashboard.emergencias;

  const porcentajePendientes = total > 0 ? (pendientes / total) * 100 : 0;

  const porcentajeEjecutadas = total > 0 ? (ejecutadas / total) * 100 : 0;

  const porcentajeEjecutadasReprogramadas =
    total > 0 ? (ejecutadasReprogramadas / total) * 100 : 0;

  const porcentajeReprogramadas = total > 0 ? (reprogramadas / total) * 100 : 0;

  const porcentajeEmergencias = total > 0 ? (emergencias / total) * 100 : 0;

  /* ========================================================= */
  /* INDICADOR EJECUTADAS VS PROGRAMADAS */
  /* ========================================================= */

  const programadas = Math.max(total - ejecutadas, 0);

  const porcentajeEjecutadasGrafico =
    total > 0 ? (ejecutadas / total) * 100 : 0;

  const porcentajeProgramadasGrafico =
    total > 0 ? (programadas / total) * 100 : 0;

  /* ========================================================= */
  /* BACKLOG */
  /* ========================================================= */

  const backlogEjecutadas = resumenDashboard.backlogEjecutadas;

  const backlogEjecutadasReprogramadas =
    resumenDashboard.backlogEjecutadasReprogramadas;

  const totalBacklog = backlogEjecutadas + backlogEjecutadasReprogramadas;

  const porcentajeBacklogEjecutadas =
    totalBacklog > 0 ? (backlogEjecutadas / totalBacklog) * 100 : 0;

  const porcentajeBacklogEjecutadasReprogramadas =
    totalBacklog > 0
      ? (backlogEjecutadasReprogramadas / totalBacklog) * 100
      : 0;

  /* ========================================================= */
  /* BACKLOG POR MES */
  /* ========================================================= */

  const datosMensualesBacklog = resumenDashboard.datosMensualesBacklog;

  const maxMensualBacklog = Math.max(
    ...datosMensualesBacklog.flatMap((mes) => [
      mes.ejecutadas,
      mes.ejecutadasReprogramadas,
    ]),
    1,
  );

  /* ========================================================= */
  /* ACTIVIDADES PM DEL PERIODO */
  /* ========================================================= */

  const actividadesPMMostradas = useMemo(() => {
    const anio = Number(anioSeleccionado);

    const trimestre =
      trimestreSeleccionado === "Todos" ? null : Number(trimestreSeleccionado);

    const mes = mesSeleccionado === "Todos" ? null : Number(mesSeleccionado);

    return actividadesPMIndexadas.filter((item) => {
      if (item.anio !== anio) {
        return false;
      }

      if (trimestre !== null && item.trimestre !== trimestre) {
        return false;
      }

      if (mes !== null && item.mes !== mes) {
        return false;
      }

      return true;
    });
  }, [
    actividadesPMIndexadas,
    anioSeleccionado,
    trimestreSeleccionado,
    mesSeleccionado,
  ]);

  /* ========================================================= */
  /* INDICADOR PM */
  /* ========================================================= */
  /*
    Reglas:
      - "Programadas" = PM planeadas en el periodo (por semana del PM).
      - "Ejecutadas"  = PM cuya EJECUCIÓN REAL (según Programación)
                        cae dentro del periodo. Si se reprogramó a otra
                        semana/trimestre, cuenta en el periodo REAL.
  */

  const indicadorPM = useMemo(() => {
    const contadores = {};

    tiposPMNormalizados.forEach((tipoNormalizado) => {
      contadores[tipoNormalizado] = {
        programadas: 0,
        ejecutadas: 0,
      };
    });

    let totalProgramadas = 0;
    let totalEjecutadas = 0;

    let programadasGrupo50 = 0;
    let ejecutadasGrupo50 = 0;

    let programadasConsignas = 0;
    let ejecutadasConsignas = 0;

    /* ---------------------------------------------------- */
    /* MAPA: pmId -> Actividad de Programación */
    /* ---------------------------------------------------- */

    const actividadesPorPmId = new Map();

    actividades.forEach((a) => {
      if (a && a.pmId) {
        actividadesPorPmId.set(normalizarPMId(a.pmId), a);
      }
    });

    /* ---------------------------------------------------- */
    /* Verifica si una fecha cae en el periodo seleccionado */
    /* ---------------------------------------------------- */

    const coincideConPeriodo = (fechaObj) => {
      if (!fechaObj) return false;

      if (fechaObj.getFullYear() !== Number(anioSeleccionado)) {
        return false;
      }

      const mes = fechaObj.getMonth() + 1;

      if (mesSeleccionado !== "Todos") {
        return mes === Number(mesSeleccionado);
      }

      if (trimestreSeleccionado !== "Todos") {
        return Math.ceil(mes / 3) === Number(trimestreSeleccionado);
      }

      return true;
    };

    /* ---------------------------------------------------- */
    /* 1) PROGRAMADAS: PM planeadas en el periodo */
    /* ---------------------------------------------------- */

    actividadesPMMostradas.forEach((item) => {
      const tipoNormalizado = item.tipoNormalizado;

      const datos = contadores[tipoNormalizado];

      if (!datos) {
        return;
      }

      datos.programadas += 1;
      totalProgramadas += 1;

      if (tiposGrupo50Normalizados.has(tipoNormalizado)) {
        programadasGrupo50 += 1;
      }

      if (tipoNormalizado === claveConsignasPM) {
        programadasConsignas += 1;
      }
    });

    /* ---------------------------------------------------- */
    /* 2) EJECUTADAS: por FECHA REAL de ejecución */
    /* ---------------------------------------------------- */

    actividadesPM.forEach((pmAct) => {
      const pmIdNorm = normalizarPMId(pmAct.pmId);

      if (!pmIdNorm) return;

      const progAct = actividadesPorPmId.get(pmIdNorm);

      if (!progAct) return;

      const estadoProg = normalizarTexto(progAct.estado);

      const esEjecutada =
        estadoProg === "ejecutada" || estadoProg === "ejecutado reprogramado";

      if (!esEjecutada) return;

      // La fecha `fecha` de la actividad de Programación es la fecha
      // actual (se actualiza al reprogramar). Es la que define el
      // trimestre real de ejecución.
      const fechaEjecucion = obtenerFecha({ fecha: progAct.fecha });

      if (!coincideConPeriodo(fechaEjecucion)) return;

      const tipoNormalizado = normalizarTipoPM(pmAct.tipo);

      const datos = contadores[tipoNormalizado];

      if (!datos) return;

      datos.ejecutadas += 1;
      totalEjecutadas += 1;

      if (tiposGrupo50Normalizados.has(tipoNormalizado)) {
        ejecutadasGrupo50 += 1;
      }

      if (tipoNormalizado === claveConsignasPM) {
        ejecutadasConsignas += 1;
      }
    });

    /* ------------------------------------------------------- */
    /* FILAS */
    /* ------------------------------------------------------- */

    const filas = tiposPM.map((tipo, indice) => {
      const clave = tiposPMNormalizados[indice];

      const datos = contadores[clave];

      const programadasTipo = datos?.programadas || 0;

      const ejecutadasTipo = datos?.ejecutadas || 0;

      const porcentajeTipo =
        programadasTipo > 0 ? (ejecutadasTipo / programadasTipo) * 100 : 0;

      return {
        tipo,
        programadas: programadasTipo,
        ejecutadas: ejecutadasTipo,
        porcentaje: porcentajeTipo,
      };
    });

    /* ------------------------------------------------------- */
    /* PORCENTAJE GRUPO 50% */
    /* ------------------------------------------------------- */
    /* Si el grupo no tiene programadas, se considera 100%
       cumplido (no hay nada que ejecutar). */

    const porcentajeGrupo50 =
      programadasGrupo50 > 0
        ? (ejecutadasGrupo50 / programadasGrupo50) * 100
        : 100;

    /* ------------------------------------------------------- */
    /* PORCENTAJE CONSIGNAS */
    /* ------------------------------------------------------- */

    const porcentajeConsignas =
      programadasConsignas > 0
        ? (ejecutadasConsignas / programadasConsignas) * 100
        : 100;

    /* ------------------------------------------------------- */
    /* PONDERACIÓN */
    /* ------------------------------------------------------- */

    const aporteGrupo50 = porcentajeGrupo50 * 0.5;
    const aporteConsignas = porcentajeConsignas * 0.5;

    /* Si NINGÚN grupo tiene programadas, no hay datos que medir
       → indicador = 0% (para no mostrar 100% sin información). */

    const hayAlgoProgramado =
      programadasGrupo50 > 0 || programadasConsignas > 0;

    const indicadorFinal = hayAlgoProgramado
      ? Math.min(aporteGrupo50 + aporteConsignas, 100)
      : 0;

    /* ------------------------------------------------------- */
    /* CUMPLIMIENTO TOTAL SIMPLE */
    /* ------------------------------------------------------- */

    const porcentajeTotalSimple =
      totalProgramadas > 0 ? (totalEjecutadas / totalProgramadas) * 100 : 0;

    return {
      filas,

      programadasGrupo50,
      ejecutadasGrupo50,
      porcentajeGrupo50,
      aporteGrupo50,

      programadasConsignas,
      ejecutadasConsignas,
      porcentajeConsignas,
      aporteConsignas,

      indicadorFinal,

      totalProgramadas,
      totalEjecutadas,
      porcentajeTotalSimple,
    };
  }, [
    actividadesPMMostradas,
    actividadesPM,
    actividades,
    anioSeleccionado,
    trimestreSeleccionado,
    mesSeleccionado,
  ]);

  /* ========================================================= */
  /* ANÁLISIS DE GESTIÓN PM */
  /* ========================================================= */

  const datosAnalisisPM = useMemo(() => {
    return indicadorPM.filas.filter(
      (fila) => fila.programadas > 0 || fila.ejecutadas > 0,
    );
  }, [indicadorPM.filas]);

  const maxAnalisisPM = Math.max(
    ...datosAnalisisPM.flatMap((fila) => [fila.programadas, fila.ejecutadas]),
    1,
  );

  /* ========================================================= */
  /* DATOS DE EJECUCIÓN POR NT */
  /* ========================================================= */

  const datosEjecutadasMantenimiento = useMemo(() => {
    return categoriasMantenimiento.map((categoria) => {
      const datos = resumenDashboard.mantenimiento[categoria];

      const preventivo = datos?.Preventivo || 0;
      const correctivo = datos?.Correctivo || 0;
      const predictivo = datos?.Predictivo || 0;

      return {
        categoria,
        Preventivo: preventivo,
        Correctivo: correctivo,
        Predictivo: predictivo,
        total: preventivo + correctivo + predictivo,
      };
    });
  }, [resumenDashboard]);

  const maxEjecutadasMantenimiento = Math.max(
    ...datosEjecutadasMantenimiento.flatMap((item) => [
      item.Preventivo,
      item.Correctivo,
      item.Predictivo,
    ]),
    1,
  );

  /* ========================================================= */
  /* TIPO DE MANTENIMIENTO INTEGRAL */
  /* ========================================================= */

  const datosTipoMantenimientoIntegral = useMemo(() => {
    return tiposMantenimientoIntegral.map((tipo) => ({
      tipo,
      cantidad: resumenDashboard.mantenimientoIntegral[tipo] || 0,
    }));
  }, [resumenDashboard]);

  const totalMantenimientoIntegral = datosTipoMantenimientoIntegral.reduce(
    (acumulado, item) => acumulado + item.cantidad,
    0,
  );

  /* ========================================================= */
  /* EMERGENCIA POR ZONAS */
  /* ========================================================= */

  const datosEmergenciaZonas = useMemo(() => {
    return zonasEmergencia.map((zona) => ({
      zona,
      cantidad: resumenDashboard.emergenciasZonas[zona] || 0,
    }));
  }, [resumenDashboard]);

  const totalEmergenciasZonas = datosEmergenciaZonas.reduce(
    (acumulado, item) => acumulado + item.cantidad,
    0,
  );

  /* ========================================================= */
  /* GRADIENTES DE LAS TORTAS */
  /* ========================================================= */

  const coloresMantenimiento = {
    Preventivo: "#4c9a6a",
    Correctivo: "#7c9cd8",
    Predictivo: "#9ba6b1",
  };

  const coloresEmergencia = {
    "Río Meta": "#d27a70",
    Centro: "#d5a84c",
    Ariari: "#7c9cd8",
  };

  const crearGradienteTorta = (datos, totalDatos, clave, colores) => {
    if (totalDatos <= 0) {
      return "#edf0f2";
    }

    let acumulado = 0;

    const segmentos = datos
      .filter((item) => item.cantidad > 0)
      .map((item) => {
        const inicio = acumulado;

        acumulado += (item.cantidad / totalDatos) * 100;

        return `${colores[item[clave]]} ${inicio}% ${acumulado}%`;
      });

    return `conic-gradient(${segmentos.join(", ")})`;
  };

  const gradienteMantenimiento = crearGradienteTorta(
    datosTipoMantenimientoIntegral,
    totalMantenimientoIntegral,
    "tipo",
    coloresMantenimiento,
  );

  const gradienteEmergencias = crearGradienteTorta(
    datosEmergenciaZonas,
    totalEmergenciasZonas,
    "zona",
    coloresEmergencia,
  );

  /* ========================================================= */
  /* PERIODO */
  /* ========================================================= */

  const nombrePeriodo = useMemo(() => {
    if (mesSeleccionado !== "Todos") {
      const mes = mesesGrafico.find(
        (item) => item.numero === Number(mesSeleccionado),
      );

      return mes ? `${mes.nombre} ${anioSeleccionado}` : `${anioSeleccionado}`;
    }

    if (trimestreSeleccionado !== "Todos") {
      return `T${trimestreSeleccionado} ${anioSeleccionado}`;
    }

    return `${anioSeleccionado}`;
  }, [anioSeleccionado, trimestreSeleccionado, mesSeleccionado]);

  /* ========================================================= */
  /* LIMPIAR FILTROS */
  /* ========================================================= */

  const limpiarFiltros = () => {
    setAnioSeleccionado(anioActual);
    setTrimestreSeleccionado("Todos");
    setMesSeleccionado("Todos");
  };

  return (
    <div className="dashboard">
      {/* ================================================= */}
      {/* ENCABEZADO */}
      {/* ================================================= */}

      <div className="dashboard-header">
        <div className="dashboard-title">
          <span className="dashboard-title-label">SIGPAS</span>

          <h1>Dashboard</h1>
        </div>

        <div className="dashboard-filtros">
          <div className="dashboard-filtro">
            <label>Año</label>

            <select
              value={anioSeleccionado}
              onChange={(e) => setAnioSeleccionado(Number(e.target.value))}
            >
              {aniosDisponibles.map((anio) => (
                <option key={anio} value={anio}>
                  {anio}
                </option>
              ))}
            </select>
          </div>

          <div className="dashboard-filtro">
            <label>Trimestre</label>

            <select
              value={trimestreSeleccionado}
              onChange={(e) => {
                setTrimestreSeleccionado(e.target.value);

                if (e.target.value !== "Todos") {
                  setMesSeleccionado("Todos");
                }
              }}
            >
              <option value="Todos">Todos</option>
              <option value="1">T1</option>
              <option value="2">T2</option>
              <option value="3">T3</option>
              <option value="4">T4</option>
            </select>
          </div>

          <div className="dashboard-filtro">
            <label>Mes</label>

            <select
              value={mesSeleccionado}
              onChange={(e) => {
                setMesSeleccionado(e.target.value);

                if (e.target.value !== "Todos") {
                  setTrimestreSeleccionado("Todos");
                }
              }}
            >
              <option value="Todos">Todos</option>

              {mesesGrafico.map((mes) => (
                <option key={mes.numero} value={mes.numero}>
                  {mes.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="dashboard-filtro-limpiar"
            onClick={limpiarFiltros}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* ================================================= */}
      {/* RESUMEN GENERAL */}
      {/* ================================================= */}

      <section className="dashboard-section">
        <div className="dashboard-section-header-centered">
          <span className="dashboard-section-label">RESUMEN GENERAL</span>

          <h2>Total de actividades</h2>
        </div>

        <div className="dashboard-cards">
          <div className="dashboard-card dashboard-card-total">
            <div className="dashboard-card-icon">📋</div>

            <div className="dashboard-card-content">
              <span>Total actividades</span>
              <strong>{total}</strong>
              <small>Periodo seleccionado</small>
            </div>
          </div>

          <div className="dashboard-card dashboard-card-pendientes">
            <div className="dashboard-card-icon">🟡</div>

            <div className="dashboard-card-content">
              <span>Pendientes</span>
              <strong>{pendientes}</strong>
              <small>{porcentajePendientes.toFixed(0)}% del total</small>
            </div>
          </div>

          <div className="dashboard-card dashboard-card-ejecutadas">
            <div className="dashboard-card-icon">🟢</div>

            <div className="dashboard-card-content">
              <span>Ejecutadas</span>
              <strong>{ejecutadas}</strong>
              <small>{porcentajeEjecutadas.toFixed(0)}% del total</small>
            </div>
          </div>

          <div className="dashboard-card dashboard-card-ejecutadas-reprogramadas">
            <div className="dashboard-card-icon">🟩</div>

            <div className="dashboard-card-content">
              <span>Ejecutadas Reprogramadas</span>
              <strong>{ejecutadasReprogramadas}</strong>
              <small>
                {porcentajeEjecutadasReprogramadas.toFixed(0)}% del total
              </small>
            </div>
          </div>

          <div className="dashboard-card dashboard-card-reprogramadas">
            <div className="dashboard-card-icon">🔵</div>

            <div className="dashboard-card-content">
              <span>Reprogramadas</span>
              <strong>{reprogramadas}</strong>
              <small>{porcentajeReprogramadas.toFixed(0)}% del total</small>
            </div>
          </div>

          <div className="dashboard-card dashboard-card-emergencias">
            <div className="dashboard-card-icon">🔴</div>

            <div className="dashboard-card-content">
              <span>Emergencias</span>
              <strong>{emergencias}</strong>
              <small>{porcentajeEmergencias.toFixed(0)}% del total</small>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================= */}
      {/* INDICADOR BACKLOG */}
      {/* ================================================= */}

      <section className="dashboard-section">
        <div className="dashboard-section-header-centered">
          <span className="dashboard-section-label">INDICADOR BACKLOG</span>

          <h2>Actividades realizadas</h2>
        </div>

        <div className="dashboard-charts">
          <div className="dashboard-chart">
            <div className="chart-header">
              <div>
                <span className="chart-label">INDICADOR</span>

                <h2>BACKLOG Trimestre</h2>

                <p>Porcentaje de cumplimiento</p>
              </div>

              <span className="chart-periodo">{nombrePeriodo}</span>
            </div>

            <div className="pie-chart-container">
              <div
                className="pie-chart"
                style={{
                  background:
                    totalBacklog > 0
                      ? `conic-gradient(#4c9a6a 0% ${porcentajeBacklogEjecutadas}%, #7c9cd8 ${porcentajeBacklogEjecutadas}% 100%)`
                      : "#edf0f1",
                }}
              >
                <div className="pie-chart-center">
                  <strong>{porcentajeBacklogEjecutadas.toFixed(0)}%</strong>

                  <span>Ejecutadas</span>
                </div>
              </div>

              <div className="pie-chart-info">
                <div className="pie-info-item">
                  <span className="pie-info-dot pie-info-ejecutadas" />

                  <div>
                    <span>Ejecutadas</span>

                    <strong>{porcentajeBacklogEjecutadas.toFixed(0)}%</strong>

                    <small>{backlogEjecutadas} actividades</small>
                  </div>
                </div>

                <div className="pie-info-item">
                  <span className="pie-info-dot pie-info-programadas" />

                  <div>
                    <span>Ejecutadas Reprogramadas</span>

                    <strong>
                      {porcentajeBacklogEjecutadasReprogramadas.toFixed(0)}%
                    </strong>

                    <small>{backlogEjecutadasReprogramadas} actividades</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="chart-backlog-total">
              <span>Total actividades</span>

              <strong>{totalBacklog}</strong>
            </div>
          </div>

          <div className="dashboard-chart">
            <div className="chart-header">
              <div>
                <span className="chart-label">INDICADOR</span>

                <h2>BACKLOG por Mes</h2>

                <p>Distribución de actividades</p>
              </div>

              <span className="chart-periodo">{anioSeleccionado}</span>
            </div>

            <div className="monthly-chart-container">
              <div className="monthly-chart-y-axis">
                <span>{maxMensualBacklog}</span>

                <span>{Math.ceil(maxMensualBacklog * 0.75)}</span>

                <span>{Math.ceil(maxMensualBacklog * 0.5)}</span>

                <span>{Math.ceil(maxMensualBacklog * 0.25)}</span>

                <span>0</span>
              </div>

              <div className="monthly-chart-main">
                <div className="monthly-chart-grid">
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                </div>

                <div className="monthly-bars">
                  {datosMensualesBacklog.map((mes) => (
                    <div className="monthly-column" key={mes.numero}>
                      <div className="monthly-bar-group">
                        <div className="monthly-bar-item">
                          <div
                            className="monthly-bar-wrapper"
                            style={{
                              height: `${
                                mes.ejecutadas > 0
                                  ? Math.max(
                                      (mes.ejecutadas / maxMensualBacklog) *
                                        100,
                                      3,
                                    )
                                  : 0
                              }%`,
                            }}
                          >
                            <div className="monthly-bar monthly-bar-ejecutadas">
                              <span className="monthly-value">
                                {mes.ejecutadas}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="monthly-bar-item">
                          <div
                            className="monthly-bar-wrapper"
                            style={{
                              height: `${
                                mes.ejecutadasReprogramadas > 0
                                  ? Math.max(
                                      (mes.ejecutadasReprogramadas /
                                        maxMensualBacklog) *
                                        100,
                                      3,
                                    )
                                  : 0
                              }%`,
                            }}
                          >
                            <div className="monthly-bar monthly-bar-reprogramadas">
                              <span className="monthly-value">
                                {mes.ejecutadasReprogramadas}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <span className="monthly-name">{mes.nombre}</span>

                      <span className="monthly-total">{mes.total} OT</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="monthly-legend">
              <div className="legend-item">
                <span className="legend-dot legend-ejecutadas" />
                <span>Ejecutadas</span>
              </div>

              <div className="legend-item">
                <span className="legend-dot legend-reprogramadas" />
                <span>Ejecutadas Reprogramadas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================= */}
      {/* INDICADOR PM */}
      {/* ================================================= */}

      <section className="dashboard-section">
        <div className="dashboard-section-header-centered">
          <span className="dashboard-section-label">INDICADOR PM</span>

          <h2>Cumplimiento del Plan de Mantenimiento</h2>
        </div>

        <div className="pm-indicator-container">
          <div className="pm-indicator-chart">
            <div className="pm-indicator-header">
              <div>
                <span className="chart-label">INDICADOR</span>

                <h2>PM Ejecutado vs Programado</h2>

                <p>Indicador ponderado de cumplimiento</p>
              </div>

              <span className="chart-periodo">{nombrePeriodo}</span>
            </div>

            <div className="pm-indicator-main">
              <div className="pm-indicator-score">
                <strong>{indicadorPM.indicadorFinal.toFixed(0)}%</strong>

                <span>Cumplimiento PM</span>
              </div>

              <div className="pm-progress-container">
                <div className="pm-progress-labels">
                  <span>0%</span>
                  <span>100%</span>
                </div>

                <div className="pm-progress-bar">
                  <div
                    className="pm-progress-fill"
                    style={{
                      width: `${Math.min(indicadorPM.indicadorFinal, 100)}%`,
                    }}
                  >
                    <span>{indicadorPM.indicadorFinal.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pm-weight-summary">
              <div className="pm-weight-item">
                <div className="pm-weight-title">
                  <span>Grupo PM</span>
                  <strong>50%</strong>
                </div>

                <div className="pm-weight-value">
                  <strong>{indicadorPM.porcentajeGrupo50.toFixed(0)}%</strong>

                  <span>
                    {indicadorPM.programadasGrupo50 > 0
                      ? `${indicadorPM.ejecutadasGrupo50} de ${indicadorPM.programadasGrupo50} ejecutadas`
                      : "Sin programadas · 100% por defecto"}
                  </span>
                </div>

                <small>
                  Aporte al indicador: {indicadorPM.aporteGrupo50.toFixed(1)}{" "}
                  puntos
                </small>
              </div>

              <div className="pm-weight-item">
                <div className="pm-weight-title">
                  <span>Consignas</span>
                  <strong>50%</strong>
                </div>

                <div className="pm-weight-value">
                  <strong>{indicadorPM.porcentajeConsignas.toFixed(0)}%</strong>

                  <span>
                    {indicadorPM.programadasConsignas > 0
                      ? `${indicadorPM.ejecutadasConsignas} de ${indicadorPM.programadasConsignas} ejecutadas`
                      : "Sin programadas · 100% por defecto"}
                  </span>
                </div>

                <small>
                  Aporte al indicador: {indicadorPM.aporteConsignas.toFixed(1)}{" "}
                  puntos
                </small>
              </div>
            </div>

            <div className="pm-total-summary">
              <div>
                <span>Total programadas</span>
                <strong>{indicadorPM.totalProgramadas}</strong>
              </div>

              <div>
                <span>Total ejecutadas</span>
                <strong>{indicadorPM.totalEjecutadas}</strong>
              </div>

              <div>
                <span>Cumplimiento simple</span>
                <strong>{indicadorPM.porcentajeTotalSimple.toFixed(0)}%</strong>
              </div>
            </div>
          </div>

          <div className="pm-indicator-table">
            <div className="pm-indicator-table-header">
              <div>
                <span className="chart-label">DETALLE</span>

                <h2>Tipos de PM</h2>

                <p>Programadas y ejecutadas</p>
              </div>
            </div>

            <div className="pm-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Tipo PM</th>
                    <th>Programadas</th>
                    <th>Ejecutadas</th>
                  </tr>
                </thead>

                <tbody>
                  {indicadorPM.filas.map((fila) => (
                    <tr
                      key={fila.tipo}
                      className={
                        fila.tipo === "Consignas"
                          ? "pm-table-row-consignas"
                          : ""
                      }
                    >
                      <td>
                        <span className="pm-type-name">{fila.tipo}</span>
                      </td>

                      <td>
                        <strong>{fila.programadas}</strong>
                      </td>

                      <td>
                        <strong>{fila.ejecutadas}</strong>
                      </td>
                    </tr>
                  ))}

                  <tr className="pm-table-total">
                    <td>Total</td>
                    <td>{indicadorPM.totalProgramadas}</td>
                    <td>{indicadorPM.totalEjecutadas}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================= */}
      {/* ANÁLISIS DE GESTIÓN DEL PLAN DE MANTENIMIENTO */}
      {/* ================================================= */}

      <section className="dashboard-section dashboard-analisis-pm">
        <div className="dashboard-section-header-centered">
          <span className="dashboard-section-label">ANÁLISIS DE GESTIÓN</span>

          <h2>ANÁLISIS DE GESTIÓN DEL PLAN DE MANTENIMIENTO</h2>
        </div>

        <div className="analisis-pm-graficos">
          <div className="analisis-pm-panel">
            <div className="analisis-pm-panel-header">
              <div>
                <span className="chart-label">PLAN DE MANTENIMIENTO</span>

                <h2>Plan de mantenimiento</h2>

                <p>Distribución por tipo · {nombrePeriodo}</p>
              </div>

              <span className="chart-periodo">{nombrePeriodo}</span>
            </div>

            <div className="analisis-pm-grafico-barras">
              <div className="analisis-pm-eje">
                <span>{maxAnalisisPM}</span>

                <span>{Math.ceil(maxAnalisisPM * 0.75)}</span>

                <span>{Math.ceil(maxAnalisisPM * 0.5)}</span>

                <span>{Math.ceil(maxAnalisisPM * 0.25)}</span>

                <span>0</span>
              </div>

              <div className="analisis-pm-grafico-principal">
                <div className="analisis-pm-grid">
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                </div>

                <div className="analisis-pm-columnas">
                  {datosAnalisisPM.map((fila) => (
                    <div className="analisis-pm-columna" key={fila.tipo}>
                      <div className="analisis-pm-barras">
                        <div
                          className="analisis-pm-barra analisis-pm-barra-programadas"
                          style={{
                            height: `${
                              fila.programadas > 0
                                ? Math.max(
                                    (fila.programadas / maxAnalisisPM) * 100,
                                    4,
                                  )
                                : 0
                            }%`,
                          }}
                        >
                          <span>{fila.programadas}</span>
                        </div>

                        <div
                          className="analisis-pm-barra analisis-pm-barra-ejecutadas"
                          style={{
                            height: `${
                              fila.ejecutadas > 0
                                ? Math.max(
                                    (fila.ejecutadas / maxAnalisisPM) * 100,
                                    4,
                                  )
                                : 0
                            }%`,
                          }}
                        >
                          <span>{fila.ejecutadas}</span>
                        </div>
                      </div>

                      <span className="analisis-pm-nombre">{fila.tipo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="analisis-pm-leyenda">
              <div className="legend-item">
                <span className="legend-dot analisis-legend-programadas" />
                <span>Programadas</span>
              </div>

              <div className="legend-item">
                <span className="legend-dot analisis-legend-ejecutadas" />
                <span>Ejecutadas</span>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* EJECUCIÓN: ACTIVIDADES DE MANTENIMIENTO */}
          {/* ================================================= */}

          <div className="analisis-pm-panel">
            <div className="analisis-pm-panel-header">
              <div>
                <span className="chart-label">EJECUCIÓN</span>

                <h2>Actividades de mantenimiento</h2>

                <p>Todas · {nombrePeriodo}</p>
              </div>

              <span className="chart-periodo">{nombrePeriodo}</span>
            </div>

            {/* ================================================= */}
            {/* GRÁFICO NT + TIPO DE MANTENIMIENTO */}
            {/* ================================================= */}

            <div
              className="analisis-ejecucion-grafico"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "18px",
                alignItems: "stretch",
              }}
            >
              {datosEjecutadasMantenimiento.map((item) => (
                <div
                  className="analisis-ejecucion-columna"
                  key={item.categoria}
                  style={{
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {/* ÁREA DE LAS TRES BARRAS */}
                  <div
                    className="analisis-ejecucion-barra-area"
                    style={{
                      width: "100%",
                      height: "240px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {/* PREVENTIVO */}
                    <div
                      style={{
                        width: "28px",
                        height: `${
                          item.Preventivo > 0
                            ? Math.max(
                                (item.Preventivo / maxEjecutadasMantenimiento) *
                                  100,
                                4,
                              )
                            : 0
                        }%`,
                        minHeight: item.Preventivo > 0 ? "4px" : "0",
                        background: coloresMantenimiento.Preventivo,
                        borderRadius: "6px 6px 0 0",
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                        transition: "height 0.3s ease",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "-24px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#334155",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.Preventivo}
                      </span>
                    </div>

                    {/* CORRECTIVO */}
                    <div
                      style={{
                        width: "28px",
                        height: `${
                          item.Correctivo > 0
                            ? Math.max(
                                (item.Correctivo / maxEjecutadasMantenimiento) *
                                  100,
                                4,
                              )
                            : 0
                        }%`,
                        minHeight: item.Correctivo > 0 ? "4px" : "0",
                        background: coloresMantenimiento.Correctivo,
                        borderRadius: "6px 6px 0 0",
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                        transition: "height 0.3s ease",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "-24px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#334155",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.Correctivo}
                      </span>
                    </div>

                    {/* PREDICTIVO */}
                    <div
                      style={{
                        width: "28px",
                        height: `${
                          item.Predictivo > 0
                            ? Math.max(
                                (item.Predictivo / maxEjecutadasMantenimiento) *
                                  100,
                                4,
                              )
                            : 0
                        }%`,
                        minHeight: item.Predictivo > 0 ? "4px" : "0",
                        background: coloresMantenimiento.Predictivo,
                        borderRadius: "6px 6px 0 0",
                        position: "relative",
                        display: "flex",
                        justifyContent: "center",
                        transition: "height 0.3s ease",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "-24px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#334155",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.Predictivo}
                      </span>
                    </div>
                  </div>

                  {/* NT */}
                  <span
                    className="analisis-ejecucion-nombre"
                    style={{
                      marginTop: "12px",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {item.categoria}
                  </span>
                </div>
              ))}
            </div>

            {/* ================================================= */}
            {/* LEYENDA DE TIPOS DE MANTENIMIENTO */}
            {/* ================================================= */}

            <div
              className="analisis-pm-leyenda"
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "28px",
                flexWrap: "wrap",
                marginTop: "20px",
              }}
            >
              <div className="legend-item">
                <span
                  className="legend-dot"
                  style={{
                    background: coloresMantenimiento.Preventivo,
                  }}
                />

                <span>Preventivo</span>
              </div>

              <div className="legend-item">
                <span
                  className="legend-dot"
                  style={{
                    background: coloresMantenimiento.Correctivo,
                  }}
                />

                <span>Correctivo</span>
              </div>

              <div className="legend-item">
                <span
                  className="legend-dot"
                  style={{
                    background: coloresMantenimiento.Predictivo,
                  }}
                />

                <span>Predictivo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="analisis-pm-inferior">
          <div className="analisis-pm-resumen-panel">
            <div className="analisis-pm-resumen-header">
              <div>
                <span className="chart-label">CLASIFICACIÓN</span>

                <h2>Tipo de Mantenimiento Integral</h2>

                <p>Distribución porcentual · {nombrePeriodo}</p>
              </div>

              <strong>{totalMantenimientoIntegral}</strong>
            </div>

            <div className="analisis-pie-contenedor">
              <div
                className="analisis-pie"
                style={{
                  background: gradienteMantenimiento,
                }}
              >
                <div className="analisis-pie-centro">
                  <strong>{totalMantenimientoIntegral}</strong>

                  <span>Actividades</span>
                </div>
              </div>

              <div className="analisis-pie-leyenda">
                {datosTipoMantenimientoIntegral.map((item) => {
                  const porcentaje =
                    totalMantenimientoIntegral > 0
                      ? (item.cantidad / totalMantenimientoIntegral) * 100
                      : 0;

                  return (
                    <div className="analisis-pie-item" key={item.tipo}>
                      <span
                        className="analisis-pie-punto"
                        style={{
                          background: coloresMantenimiento[item.tipo],
                        }}
                      />

                      <div className="analisis-pie-item-info">
                        <span>{item.tipo}</span>

                        <div>
                          <strong>{porcentaje.toFixed(0)}%</strong>

                          <small>{item.cantidad} actividades</small>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="analisis-pm-resumen-panel">
            <div className="analisis-pm-resumen-header">
              <div>
                <span className="chart-label">EMERGENCIAS</span>

                <h2>Emergencia por zonas</h2>

                <p>Emergencias por zona · {nombrePeriodo}</p>
              </div>

              <strong>{totalEmergenciasZonas}</strong>
            </div>

            <div className="analisis-pie-contenedor">
              <div
                className="analisis-pie analisis-pie-emergencias"
                style={{
                  background: gradienteEmergencias,
                }}
              >
                <div className="analisis-pie-centro">
                  <strong>{totalEmergenciasZonas}</strong>

                  <span>Emergencias</span>
                </div>
              </div>

              <div className="analisis-pie-leyenda">
                {datosEmergenciaZonas.map((item) => {
                  const porcentaje =
                    totalEmergenciasZonas > 0
                      ? (item.cantidad / totalEmergenciasZonas) * 100
                      : 0;

                  return (
                    <div className="analisis-pie-item" key={item.zona}>
                      <span
                        className="analisis-pie-punto"
                        style={{
                          background: coloresEmergencia[item.zona],
                        }}
                      />

                      <div className="analisis-pie-item-info">
                        <span>{item.zona}</span>

                        <div>
                          <strong>{porcentaje.toFixed(0)}%</strong>

                          <small>{item.cantidad} emergencias</small>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
