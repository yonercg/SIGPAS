import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActividades } from "../context/ActividadesContext";
import { cuadrillas as cuadrillasData } from "../data/cuadrillas";
import { supabase } from "../lib/supabase";
import "./Actividades.css";

function Actividades() {
  const navigate = useNavigate();

  // =========================================
  // ACTIVIDADES DESDE EL CONTEXT
  // =========================================

  const {
    actividades,
    modificarActividad: modificarActividadContext,
    obtenerOTPorActividad,
  } = useActividades();

  // =========================================
  // FILTROS
  // =========================================

  const [busqueda, setBusqueda] = useState("");
  const [semanaFiltro, setSemanaFiltro] = useState("");
  const [cuadrillaFiltro, setCuadrillaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [materialesFiltro, setMaterialesFiltro] = useState("");

  // =========================================
  // DISPONIBILIDAD ACTUAL
  // =========================================

  const [cuadrillaDisponible, setCuadrillaDisponible] = useState(null);

  // =========================================
  // MODAL DETALLE
  // =========================================

  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);

  // =========================================
  // MODAL MATERIALES
  // =========================================

  const [actividadMateriales, setActividadMateriales] = useState(null);
  const [materiales, setMateriales] = useState("");

  // =========================================
  // DOCUMENTOS
  // =========================================

  const [actividadDocumentos, setActividadDocumentos] = useState(null);

  const [posicionDocumentos, setPosicionDocumentos] = useState(null);

  // =========================================
  // INFORMES CREADOS (para los chulitos ✓)
  // 🔹 Ahora se leen desde Supabase, no desde localStorage.
  //    Contiene objetos { id, actividadId } de la tabla "informes".
  // =========================================

  const [informesCreados, setInformesCreados] = useState([]);

  // =========================================
  // FECHA BASE
  // =========================================

  const SEMANA_BASE = 34;
  const ANIO_BASE = 2026;

  // =========================================
  // CUADRILLAS QUE PARTICIPAN EN LA
  // ROTACIÓN DE DISPONIBILIDAD
  // (mismas que Programación)
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
  // OBTENER SEMANA ISO
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
  // OBTENER SEMANA ACTUAL REAL
  // =========================================

  const obtenerSemanaActualReal = () => {
    const fechaActual = new Date();

    return {
      semana: obtenerNumeroSemanaISO(fechaActual),
      anio: obtenerAnioISO(fechaActual),
    };
  };

  // =========================================
  // OBTENER CUADRILLAS ACTIVAS
  // =========================================

  // Para el cálculo de la disponibilidad semanal
  // (mismas que Programación: solo C1-C4)

  const obtenerCuadrillasActivas = () => {
    return cuadrillasData.filter(
      (cuadrilla) =>
        cuadrilla.activa && CUADRILLAS_ROTACION.includes(cuadrilla.id),
    );
  };

  // Para el dropdown de filtro y demás listados
  // (todas las activas, igual que en Programación)

  const obtenerTodasCuadrillasActivas = () => {
    return cuadrillasData.filter((cuadrilla) => cuadrilla.activa);
  };

  // =========================================
  // OBTENER SIGUIENTE CUADRILLA
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
  // OBTENER CUADRILLA DE LA SEMANA
  // =========================================

  const obtenerCuadrillaSemana = (semana, anio) => {
    const cuadrillasActivas = obtenerCuadrillasActivas();

    if (cuadrillasActivas.length === 0) {
      return null;
    }

    let cambiosManuales = {};

    try {
      const guardados = localStorage.getItem("sigpas_cambios_manuales");

      if (guardados) {
        cambiosManuales = JSON.parse(guardados);
      }
    } catch (error) {
      console.error(
        "No se pudieron leer los cambios de disponibilidad.",
        error,
      );
    }

    const claveSemana = `${anio}-${semana}`;

    // =======================================
    // CAMBIO MANUAL EXACTO
    // =======================================

    if (cambiosManuales[claveSemana]) {
      const cuadrillaManual = cambiosManuales[claveSemana].cuadrillaId;

      if (
        cuadrillasActivas.some((cuadrilla) => cuadrilla.id === cuadrillaManual)
      ) {
        return cuadrillaManual;
      }
    }

    // =======================================
    // BUSCAR CAMBIO MANUAL ANTERIOR
    // =======================================

    const semanasConCambio = Object.keys(cambiosManuales)
      .filter((clave) => {
        const [anioCambio, semanaCambio] = clave.split("-").map(Number);

        return (
          anioCambio < anio || (anioCambio === anio && semanaCambio < semana)
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

    // =======================================
    // ROTACIÓN NORMAL
    // =======================================

    if (semanasConCambio.length === 0) {
      const diferencia = obtenerDiferenciaSemanas(
        SEMANA_BASE,
        ANIO_BASE,
        semana,
        anio,
      );

      const posicion =
        ((diferencia % cuadrillasActivas.length) + cuadrillasActivas.length) %
        cuadrillasActivas.length;

      return cuadrillasActivas[posicion]?.id || null;
    }

    // =======================================
    // CONTINUAR DESDE ÚLTIMO CAMBIO MANUAL
    // =======================================

    const ultimaSemanaManual = semanasConCambio[0];

    const [anioManual, semanaManual] = ultimaSemanaManual
      .split("-")
      .map(Number);

    let cuadrillaActual = cambiosManuales[ultimaSemanaManual]?.cuadrillaId;

    if (!cuadrillaActual) {
      return null;
    }

    const semanasTranscurridas = obtenerDiferenciaSemanas(
      semanaManual,
      anioManual,
      semana,
      anio,
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
  // CARGAR INFORMES DESDE SUPABASE
  // 🔹 Necesario para los chulitos ✓ de la tabla.
  //    Se refresca al volver a la pestaña (focus).
  // =========================================

  useEffect(() => {
    let activo = true;

    const cargarInformes = async () => {
      try {
        const { data, error } = await supabase
          .from("informes")
          .select("id, metadatos");

        if (!activo) return;

        if (error) {
          console.error("Error cargando informes para el check:", error);
          setInformesCreados([]);
          return;
        }

        setInformesCreados(
          (data || []).map((fila) => ({
            id: fila.id,
            actividadId: fila.metadatos?.actividadId ?? null,
          })),
        );
      } catch (err) {
        console.error("Error inesperado cargando informes:", err);
        if (activo) setInformesCreados([]);
      }
    };

    cargarInformes();

    const refrescar = () => cargarInformes();
    window.addEventListener("focus", refrescar);

    return () => {
      activo = false;
      window.removeEventListener("focus", refrescar);
    };
  }, []);

  // =========================================
  // ACTUALIZAR DISPONIBILIDAD
  // =========================================

  useEffect(() => {
    const actualizarDisponibilidad = () => {
      const { semana, anio } = obtenerSemanaActualReal();

      const cuadrillaId = obtenerCuadrillaSemana(semana, anio);

      const cuadrilla =
        cuadrillasData.find((item) => item.id === cuadrillaId) || null;

      setCuadrillaDisponible(cuadrilla);
    };

    actualizarDisponibilidad();

    const intervalo = setInterval(actualizarDisponibilidad, 60000);

    window.addEventListener("storage", actualizarDisponibilidad);

    return () => {
      clearInterval(intervalo);

      window.removeEventListener("storage", actualizarDisponibilidad);
    };
  }, []);

  // =========================================
  // OBTENER INFORMACIÓN DE DISPONIBILIDAD
  // =========================================

  const obtenerInformacionDisponibilidad = () => {
    const { semana, anio } = obtenerSemanaActualReal();

    const lunesActual = obtenerLunesISO(semana, anio);

    // VIERNES ACTUAL - 4:30 PM

    const viernesActual = agregarDias(lunesActual, 4);

    viernesActual.setHours(16, 30, 0, 0);

    // SIGUIENTE VIERNES - 4:30 PM

    const siguienteViernes = agregarDias(viernesActual, 7);

    siguienteViernes.setHours(16, 30, 0, 0);

    // SEMANA SIGUIENTE

    const semanaSiguiente = obtenerNumeroSemanaISO(siguienteViernes);

    const anioSiguiente = obtenerAnioISO(siguienteViernes);

    // CUADRILLA SIGUIENTE

    const cuadrillaSiguienteId = obtenerCuadrillaSemana(
      semanaSiguiente,
      anioSiguiente,
    );

    const cuadrillaSiguiente =
      cuadrillasData.find(
        (cuadrilla) => cuadrilla.id === cuadrillaSiguienteId,
      ) || null;

    return {
      fechaEntrega: viernesActual,
      fechaRecepcion: viernesActual,
      cuadrillaActual: cuadrillaDisponible,
      cuadrillaSiguiente,
    };
  };

  // =========================================
  // OBTENER FECHA
  // =========================================

  const obtenerFecha = (fecha) => {
    if (!fecha) {
      return null;
    }

    if (typeof fecha === "string" && fecha.includes("-")) {
      const [anio, mes, dia] = fecha.split("-").map(Number);

      return new Date(anio, mes - 1, dia);
    }

    const fechaConvertida = new Date(fecha);

    return isNaN(fechaConvertida.getTime()) ? null : fechaConvertida;
  };

  // =========================================
  // FORMATEAR FECHA
  // =========================================

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "Sin fecha";
    }

    const fechaConvertida = obtenerFecha(fecha);

    if (!fechaConvertida) {
      return "Sin fecha";
    }

    return fechaConvertida.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // =========================================
  // FORMATEAR FECHA LARGA
  // =========================================

  const formatearFechaLarga = (fecha) => {
    if (!fecha) {
      return "Sin fecha";
    }

    const fechaConvertida = obtenerFecha(fecha);

    if (!fechaConvertida) {
      return "Sin fecha";
    }

    return fechaConvertida.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // =========================================
  // OBTENER SEMANA DE ACTIVIDAD
  // =========================================

  const obtenerSemanaActividad = (actividad) => {
    const fecha = obtenerFecha(actividad.fecha);

    if (!fecha) {
      return null;
    }

    return obtenerNumeroSemanaISO(fecha);
  };

  // =========================================
  // SABER SI TIENE MATERIALES
  // =========================================

  const tieneMateriales = (actividad) => {
    return Boolean(
      actividad.materiales &&
      typeof actividad.materiales === "string" &&
      actividad.materiales.trim(),
    );
  };

  // =========================================
  // OBTENER CUADRILLA DE ACTIVIDAD
  // =========================================

  const obtenerCuadrillaActividad = (actividad) => {
    return actividad.cuadrillaId || actividad.cuadrilla || "";
  };

  // =========================================
  // OBTENER NOMBRE DE CUADRILLA
  // =========================================

  const obtenerNombreCuadrilla = (actividad) => {
    const cuadrillaId = obtenerCuadrillaActividad(actividad);

    const cuadrilla = cuadrillasData.find((item) => item.id === cuadrillaId);

    return (
      cuadrilla?.nombre ||
      actividad.cuadrilla ||
      actividad.cuadrillaId ||
      "No asignada"
    );
  };

  // =========================================
  // OBTENER CÓDIGO OT
  // =========================================

  const obtenerCodigoOT = (actividad) => {
    return actividad.codigoOT || "No registrado";
  };

  // =========================================
  // OBTENER CAMIONETA
  // =========================================

  const obtenerCamioneta = (actividad) => {
    return actividad.camioneta || "Sin asignar";
  };

  // =========================================
  // TEXTO COMPLETO PARA BÚSQUEDA
  // =========================================

  const obtenerTextoBusqueda = (actividad) => {
    return [
      actividad.codigoOT,
      actividad.nombre,
      actividad.actividad,
      actividad.subestacion,
      actividad.responsable,
      actividad.cuadrilla,
      actividad.cuadrillaId,
      actividad.camioneta,
      actividad.tipo,
      actividad.estado,
      actividad.materiales,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  // =========================================
  // FILTROS
  // =========================================

  const cumpleFiltros = (actividad, exclude = "") => {
    const texto = busqueda.toLowerCase().trim();

    // =======================================
    // BÚSQUEDA
    // =======================================

    if (exclude !== "busqueda") {
      const coincideBusqueda =
        !texto || obtenerTextoBusqueda(actividad).includes(texto);

      if (!coincideBusqueda) {
        return false;
      }
    }

    // =======================================
    // SEMANA
    // =======================================

    if (exclude !== "semana") {
      const semanaActividad = obtenerSemanaActividad(actividad);

      if (semanaFiltro !== "" && semanaActividad !== Number(semanaFiltro)) {
        return false;
      }
    }

    // =======================================
    // CUADRILLA
    // =======================================

    if (exclude !== "cuadrilla") {
      const cuadrillaActividad = obtenerCuadrillaActividad(actividad);

      if (cuadrillaFiltro !== "" && cuadrillaActividad !== cuadrillaFiltro) {
        return false;
      }
    }

    // =======================================
    // ESTADO
    // =======================================

    if (exclude !== "estado") {
      if (estadoFiltro !== "" && actividad.estado !== estadoFiltro) {
        return false;
      }
    }

    // =======================================
    // MATERIALES
    // =======================================

    if (exclude !== "materiales") {
      if (materialesFiltro === "con" && !tieneMateriales(actividad)) {
        return false;
      }

      if (materialesFiltro === "sin" && tieneMateriales(actividad)) {
        return false;
      }
    }

    return true;
  };

  // =========================================
  // ACTIVIDADES FILTRADAS
  //
  // IMPORTANTE:
  // TODAS las actividades participan.
  // NO se usa cuadrillaDisponible para
  // filtrar automáticamente.
  // =========================================

  const actividadesFiltradas = actividades.filter((actividad) =>
    cumpleFiltros(actividad),
  );

  // =========================================
  // OPCIONES DE SEMANA
  // =========================================

  const semanas = [
    ...new Set(
      actividades
        .filter((actividad) => cumpleFiltros(actividad, "semana"))
        .map((actividad) => obtenerSemanaActividad(actividad))
        .filter(Boolean),
    ),
  ].sort((a, b) => a - b);

  // =========================================
  // CUADRILLAS DISPONIBLES
  //
  // Misma fuente que Programación:
  // cuadrillas activas de ../data/cuadrillas.
  // =========================================

  const cuadrillas = obtenerTodasCuadrillasActivas();

  // =========================================
  // OPCIONES DE ESTADO
  // =========================================

  const estadosDisponibles = [
    ...new Set(
      actividades
        .filter((actividad) => cumpleFiltros(actividad, "estado"))
        .map((actividad) => actividad.estado)
        .filter(Boolean),
    ),
  ];

  // =========================================
  // OPCIONES DE MATERIALES
  // =========================================

  const hayActividadesConMateriales = actividades.some(
    (actividad) =>
      cumpleFiltros(actividad, "materiales") && tieneMateriales(actividad),
  );

  const hayActividadesSinMateriales = actividades.some(
    (actividad) =>
      cumpleFiltros(actividad, "materiales") && !tieneMateriales(actividad),
  );

  // =========================================
  // RESUMEN
  // =========================================

  const total = actividadesFiltradas.length;

  const pendientes = actividadesFiltradas.filter(
    (actividad) => actividad.estado === "Pendiente",
  ).length;

  const ejecutadas = actividadesFiltradas.filter(
    (actividad) =>
      actividad.estado === "Ejecutada" ||
      actividad.estado === "Ejecutado Reprogramado",
  ).length;

  const reprogramadas = actividadesFiltradas.filter(
    (actividad) => actividad.estado === "Reprogramada",
  ).length;

  const emergencias = actividadesFiltradas.filter(
    (actividad) => actividad.estado === "Emergencia",
  ).length;

  // =========================================
  // LIMPIAR FILTROS
  // =========================================

  const limpiarFiltros = () => {
    setBusqueda("");
    setSemanaFiltro("");
    setCuadrillaFiltro("");
    setEstadoFiltro("");
    setMaterialesFiltro("");
  };

  // =========================================
  // CERRAR MODAL DETALLE
  // =========================================

  const cerrarModal = () => {
    setActividadSeleccionada(null);
  };

  // =========================================
  // ABRIR MATERIALES
  // =========================================

  const abrirMateriales = (actividad) => {
    setActividadMateriales(actividad);

    setMateriales(actividad.materiales || "");
  };

  // =========================================
  // CERRAR MATERIALES
  // =========================================

  const cerrarMateriales = () => {
    setActividadMateriales(null);
    setMateriales("");
  };

  // =========================================
  // GUARDAR MATERIALES
  // =========================================

  const guardarMateriales = () => {
    if (!actividadMateriales) {
      return;
    }

    modificarActividadContext(actividadMateriales.id, {
      materiales: materiales.trim(),
    });

    cerrarMateriales();
  };

  // =========================================
  // DOCUMENTOS
  // =========================================
  //
  // El menú se renderiza mediante Portal
  // directamente en document.body.
  //
  // Esto evita que el overflow de la tabla
  // recorte el menú desplegable.
  // =========================================

  const abrirDocumentos = (actividad, elementoBoton) => {
    if (actividadDocumentos?.id === actividad.id) {
      setActividadDocumentos(null);
      setPosicionDocumentos(null);
      return;
    }

    const rect = elementoBoton.getBoundingClientRect();

    const anchoMenu = 235;

    let left = rect.right - anchoMenu;

    if (left < 10) {
      left = 10;
    }

    if (left + anchoMenu > window.innerWidth - 10) {
      left = window.innerWidth - anchoMenu - 10;
    }

    setPosicionDocumentos({
      top: rect.bottom + 7,
      left,
    });

    setActividadDocumentos(actividad);
  };

  // =========================================
  // CERRAR DOCUMENTOS
  // =========================================

  const cerrarDocumentos = () => {
    setActividadDocumentos(null);
    setPosicionDocumentos(null);
  };

  // =========================================
  // ABRIR INFORME
  // =========================================

  const abrirInforme = (actividad) => {
    cerrarDocumentos();

    if (!actividad?.id) {
      alert(
        "No se puede generar el informe porque esta actividad no tiene un identificador.",
      );

      return;
    }

    navigate(`/informes?actividadId=${encodeURIComponent(actividad.id)}`);
  };

  // =========================================
  // ABRIR ORDEN DE TRABAJO
  // =========================================

  const abrirOrdenTrabajo = (actividad) => {
    cerrarDocumentos();

    if (!actividad?.id) {
      alert(
        "No se puede abrir la orden de trabajo porque esta actividad no tiene un identificador.",
      );

      return;
    }

    navigate(`/ot?actividadId=${encodeURIComponent(actividad.id)}`);
  };

  // =========================================
  // DETECCIÓN DE DOCUMENTOS CREADOS
  //
  // INFORME: se consulta la lista traída de
  // Supabase (tabla informes) por actividadId.
  //
  // OT: se consulta con obtenerOTPorActividad
  // del context de Actividades (misma función
  // que usa el listado de OTs y la OT misma).
  // =========================================

  const tieneInformeCreado = (actividadId) => {
    if (!actividadId) {
      return false;
    }

    // 🔹 FIX: consultamos la lista de informes traída de Supabase
    // en lugar de leer localStorage (que ya no se usa).
    return informesCreados.some(
      (informe) => String(informe.actividadId ?? "") === String(actividadId),
    );
  };

  const tieneOrdenTrabajoCreada = (actividadId) => {
    if (!actividadId) {
      return false;
    }

    try {
      return Boolean(obtenerOTPorActividad(actividadId));
    } catch (error) {
      console.error("Error al verificar OT:", error);

      return false;
    }
  };

  const obtenerDocumentosActividad = (actividad) => {
    const informe = tieneInformeCreado(actividad?.id);

    const ordenTrabajo = tieneOrdenTrabajoCreada(actividad?.id);

    return {
      informe,
      ordenTrabajo,
      completos: informe && ordenTrabajo,
    };
  };

  // =========================================
  // CLASE DEL ESTADO
  // =========================================

  const obtenerClaseEstado = (estado) => {
    if (estado === "Pendiente") {
      return "estado-Pendiente";
    }

    if (estado === "Ejecutada" || estado === "Ejecutado Reprogramado") {
      return "estado-Ejecutada";
    }

    if (estado === "Reprogramada") {
      return "estado-Reprogramada";
    }

    if (estado === "Emergencia") {
      return "estado-Emergencia";
    }

    return "";
  };

  // =========================================
  // TEXTO MATERIALES
  // =========================================

  const obtenerTextoMateriales = () => {
    if (materialesFiltro === "con") {
      return "Con materiales";
    }

    if (materialesFiltro === "sin") {
      return "Sin materiales";
    }

    return "todas";
  };

  // =========================================
  // INFORMACIÓN DISPONIBILIDAD
  // =========================================

  const disponibilidad = obtenerInformacionDisponibilidad();

  // ⚠️ FIN DE LA PARTE 1
  // La PARTE 2 (JSX return) va justo debajo, dentro de este mismo componente.
  // =========================================
  // INTERFAZ
  // =========================================

  return (
    <div className="actividades-page">
      {/* =====================================
          ENCABEZADO
      ===================================== */}

      <div className="actividades-title-card">
        <div className="actividades-header">
          <div>
            <h1>Actividades</h1>

            <p>
              Seguimiento y control de actividades programadas para las
              cuadrillas.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================
          DISPONIBILIDAD
      ===================================== */}

      <div className="disponibilidad-actividades">
        <div className="disponibilidad-principal">
          <div className="disponibilidad-titulo">
            <span>CUADRILLA DISPONIBLE</span>

            <strong>
              {disponibilidad.cuadrillaActual
                ? disponibilidad.cuadrillaActual.nombre
                : "No disponible"}
            </strong>

            {disponibilidad.cuadrillaActual && (
              <small>{disponibilidad.cuadrillaActual.ingeniero}</small>
            )}
          </div>

          <div className="disponibilidad-detalles">
            <div className="disponibilidad-item">
              <span>FINALIZA DISPONIBILIDAD</span>

              <strong>
                {formatearFechaLarga(disponibilidad.fechaEntrega)}
              </strong>

              <small>4:30 p. m.</small>
            </div>

            <div className="disponibilidad-separador">→</div>

            <div className="disponibilidad-item">
              <span>RECIBE DISPONIBILIDAD</span>

              <strong>
                {formatearFechaLarga(disponibilidad.fechaRecepcion)}
              </strong>

              <small>4:30 p. m.</small>
            </div>

            <div className="disponibilidad-siguiente">
              <span>SIGUIENTE CUADRILLA</span>

              <strong>
                {disponibilidad.cuadrillaSiguiente
                  ? disponibilidad.cuadrillaSiguiente.nombre
                  : "No disponible"}
              </strong>

              {disponibilidad.cuadrillaSiguiente && (
                <small>{disponibilidad.cuadrillaSiguiente.ingeniero}</small>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================
          RESUMEN
      ===================================== */}

      <div className="actividades-resumen">
        <div className="resumen-card">
          <div>
            <strong>Total</strong>

            <small>Actividades mostradas</small>
          </div>

          <span>{total}</span>
        </div>

        <div className="resumen-card">
          <div>
            <strong>Pendientes</strong>

            <small>Por ejecutar</small>
          </div>

          <span>{pendientes}</span>
        </div>

        <div className="resumen-card">
          <div>
            <strong>Ejecutadas</strong>

            <small>Incluye reprogramadas</small>
          </div>

          <span>{ejecutadas}</span>
        </div>

        <div className="resumen-card">
          <div>
            <strong>Reprogramadas</strong>

            <small>Con nueva programación</small>
          </div>

          <span>{reprogramadas}</span>
        </div>

        <div className="resumen-card resumen-emergencia">
          <div>
            <strong>Emergencias</strong>

            <small>Atención prioritaria</small>
          </div>

          <span>{emergencias}</span>
        </div>
      </div>

      {/* =====================================
          FILTROS
      ===================================== */}

      <div className="actividades-filtros">
        {/* BÚSQUEDA */}

        <div className="filtro-busqueda">
          <input
            type="text"
            placeholder="Buscar actividad, OT, placa, subestación o responsable..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {/* SEMANA */}

        <select
          value={semanaFiltro}
          onChange={(e) => setSemanaFiltro(e.target.value)}
        >
          <option value="">Todas las semanas</option>

          {semanas.map((semana) => (
            <option key={semana} value={semana}>
              Semana {semana}
            </option>
          ))}
        </select>

        {/* CUADRILLA */}

        <select
          value={cuadrillaFiltro}
          onChange={(e) => setCuadrillaFiltro(e.target.value)}
        >
          <option value="">Todas las cuadrillas</option>

          {cuadrillas.map((cuadrilla) => (
            <option key={cuadrilla.id} value={cuadrilla.id}>
              {cuadrilla.nombre} — {cuadrilla.ingeniero}
            </option>
          ))}
        </select>

        {/* ESTADO */}

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>

          {estadosDisponibles.includes("Pendiente") && (
            <option value="Pendiente">Pendiente</option>
          )}

          {estadosDisponibles.includes("Ejecutada") && (
            <option value="Ejecutada">Ejecutada</option>
          )}

          {estadosDisponibles.includes("Ejecutado Reprogramado") && (
            <option value="Ejecutado Reprogramado">
              Ejecutado Reprogramado
            </option>
          )}

          {estadosDisponibles.includes("Reprogramada") && (
            <option value="Reprogramada">Reprogramada</option>
          )}

          {estadosDisponibles.includes("Emergencia") && (
            <option value="Emergencia">Emergencia</option>
          )}
        </select>

        {/* MATERIALES */}

        <select
          value={materialesFiltro}
          onChange={(e) => setMaterialesFiltro(e.target.value)}
        >
          <option value="">Todos los materiales</option>

          {hayActividadesConMateriales && (
            <option value="con">Con materiales</option>
          )}

          {hayActividadesSinMateriales && (
            <option value="sin">Sin materiales</option>
          )}
        </select>

        {/* LIMPIAR */}

        <button className="btn-limpiar" onClick={limpiarFiltros}>
          Limpiar
        </button>
      </div>

      {/* =====================================
          INFORMACIÓN DE FILTROS
      ===================================== */}

      <div className="actividades-semana-info">
        <span>Mostrando:</span>

        <strong>
          {semanaFiltro ? `Semana ${semanaFiltro}` : "todas las semanas"}
        </strong>

        {cuadrillaFiltro && (
          <>
            <span>{" · "}</span>

            <strong>{cuadrillaFiltro}</strong>
          </>
        )}

        {estadoFiltro && (
          <>
            <span>{" · "}</span>

            <strong>{estadoFiltro}</strong>
          </>
        )}

        {materialesFiltro && (
          <>
            <span>{" · "}</span>

            <strong>{obtenerTextoMateriales()}</strong>
          </>
        )}
      </div>

      {/* =====================================
          TABLA
      ===================================== */}

      <div className="actividades-tabla-contenedor">
        <table className="actividades-tabla">
          <thead>
            <tr>
              <th>Fecha</th>

              <th>Código OT</th>

              <th>Actividad</th>

              <th>Subestación</th>

              <th>Cuadrilla</th>

              <th>Responsable</th>

              <th>Camioneta</th>

              <th>Estado</th>

              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {actividadesFiltradas.length > 0 ? (
              actividadesFiltradas.map((actividad, index) => {
                const nombreActividad =
                  actividad.nombre || actividad.actividad || "Sin nombre";

                const fechaActividad = obtenerFecha(actividad.fecha);

                const actividadTieneMateriales = tieneMateriales(actividad);

                const documentosActividad =
                  obtenerDocumentosActividad(actividad);

                return (
                  <tr key={actividad.id || index}>
                    <td className="fecha-columna">
                      {formatearFecha(fechaActividad)}
                    </td>

                    <td>
                      <strong>{obtenerCodigoOT(actividad)}</strong>
                    </td>

                    <td className="actividad-columna">{nombreActividad}</td>

                    <td>{actividad.subestacion || "—"}</td>

                    <td>
                      <span className="cuadrilla-badge">
                        {obtenerNombreCuadrilla(actividad)}
                      </span>
                    </td>

                    <td>{actividad.responsable || "—"}</td>

                    <td>{obtenerCamioneta(actividad)}</td>

                    <td>
                      <span
                        className={`estado ${obtenerClaseEstado(
                          actividad.estado,
                        )}`}
                      >
                        {actividad.estado || "Sin estado"}
                      </span>
                    </td>

                    <td>
                      <div className="actividad-acciones">
                        <button
                          className="btn-detalle"
                          onClick={() => setActividadSeleccionada(actividad)}
                        >
                          Ver detalle
                        </button>

                        <button
                          className={`btn-materiales ${
                            actividadTieneMateriales
                              ? "materiales-registrados"
                              : ""
                          }`}
                          onClick={() => abrirMateriales(actividad)}
                        >
                          {actividadTieneMateriales
                            ? "Materiales ✓"
                            : "Materiales"}
                        </button>

                        {/* =================================
                              DOCUMENTOS
                          ================================= */}

                        <div className="documentos-contenedor">
                          <button
                            className={`btn-documentos ${
                              actividadDocumentos?.id === actividad.id
                                ? "documentos-activo"
                                : ""
                            }`}
                            type="button"
                            onClick={(e) =>
                              abrirDocumentos(actividad, e.currentTarget)
                            }
                            aria-expanded={
                              actividadDocumentos?.id === actividad.id
                            }
                            aria-haspopup="menu"
                          >
                            <span>Documentos</span>

                            {documentosActividad.completos && (
                              <span
                                className="documentos-check"
                                aria-label="Documentos completos"
                              >
                                ✓
                              </span>
                            )}

                            <span
                              className="documentos-flecha"
                              aria-hidden="true"
                            >
                              ▾
                            </span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="actividades-sin-resultados">
                  No se encontraron actividades con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================
          MENÚ DOCUMENTOS MEDIANTE PORTAL
      ===================================== */}

      {actividadDocumentos &&
        posicionDocumentos &&
        createPortal(
          <>
            <div
              className="documentos-cierre"
              onClick={cerrarDocumentos}
              aria-hidden="true"
            />

            <div
              className="documentos-menu documentos-menu-portal"
              role="menu"
              aria-label="Documentos de la actividad"
              style={{
                top: `${posicionDocumentos.top}px`,
                left: `${posicionDocumentos.left}px`,
              }}
            >
              {(() => {
                const docs = obtenerDocumentosActividad(actividadDocumentos);

                return (
                  <>
                    <button
                      className="documento-opcion"
                      type="button"
                      role="menuitem"
                      onClick={() => abrirInforme(actividadDocumentos)}
                    >
                      <span
                        className="documento-opcion-icono"
                        aria-hidden="true"
                      >
                        📄
                      </span>

                      <span className="documento-opcion-contenido">
                        <strong>Informe</strong>

                        <small>Crear o continuar informe</small>
                      </span>

                      {docs.informe && (
                        <span
                          className="documento-opcion-check"
                          aria-label="Informe creado"
                        >
                          ✓
                        </span>
                      )}
                    </button>

                    <button
                      className="documento-opcion"
                      type="button"
                      role="menuitem"
                      onClick={() => abrirOrdenTrabajo(actividadDocumentos)}
                    >
                      <span
                        className="documento-opcion-icono"
                        aria-hidden="true"
                      >
                        📋
                      </span>

                      <span className="documento-opcion-contenido">
                        <strong>Orden de trabajo</strong>

                        <small>Crear o consultar orden de trabajo</small>
                      </span>

                      {docs.ordenTrabajo && (
                        <span
                          className="documento-opcion-check"
                          aria-label="Orden de trabajo creada"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  </>
                );
              })()}
            </div>
          </>,
          document.body,
        )}

      {/* =====================================
          CONTADOR
      ===================================== */}

      <p className="actividades-contador">
        Mostrando {actividadesFiltradas.length} de {actividades.length}{" "}
        actividades.
      </p>

      {/* =====================================
          MODAL DETALLE
      ===================================== */}

      {actividadSeleccionada && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-detalle" onClick={(e) => e.stopPropagation()}>
            <div className="detalle-header">
              <div className="detalle-header-texto">
                <span className="detalle-etiqueta">
                  SIGPAS · DETALLE DE ACTIVIDAD
                </span>

                <h2>
                  {actividadSeleccionada.nombre ||
                    actividadSeleccionada.actividad ||
                    "Actividad"}
                </h2>

                <p>Información de seguimiento de la actividad programada.</p>
              </div>

              <span
                className={`estado estado-modal ${obtenerClaseEstado(
                  actividadSeleccionada.estado,
                )}`}
              >
                {actividadSeleccionada.estado || "Sin estado"}
              </span>
            </div>

            <div className="detalle-informacion">
              {/* CÓDIGO OT */}

              <div className="detalle-dato">
                <span>Código OT</span>

                <strong>{obtenerCodigoOT(actividadSeleccionada)}</strong>
              </div>

              {/* FECHA DE PROGRAMACIÓN */}

              <div className="detalle-dato">
                <span>Fecha de programación</span>

                <strong>
                  {formatearFecha(obtenerFecha(actividadSeleccionada.fecha))}
                </strong>
              </div>

              {/* SUBESTACIÓN */}

              <div className="detalle-dato">
                <span>Subestación</span>

                <strong>
                  {actividadSeleccionada.subestacion || "No especificada"}
                </strong>
              </div>

              {/* TIPO */}

              <div className="detalle-dato">
                <span>Tipo de actividad</span>

                <strong>
                  {actividadSeleccionada.tipo || "No especificado"}
                </strong>
              </div>

              {/* CUADRILLA */}

              <div className="detalle-dato">
                <span>Cuadrilla asignada</span>

                <strong>
                  <span className="cuadrilla-badge grande">
                    {obtenerNombreCuadrilla(actividadSeleccionada)}
                  </span>
                </strong>
              </div>

              {/* RESPONSABLE */}

              <div className="detalle-dato">
                <span>Responsable</span>

                <strong>
                  {actividadSeleccionada.responsable || "No especificado"}
                </strong>
              </div>

              {/* CAMIONETA */}

              <div className="detalle-dato">
                <span>Camioneta</span>

                <strong>{obtenerCamioneta(actividadSeleccionada)}</strong>
              </div>
            </div>

            {/* =================================
                INFORMACIÓN DE REPROGRAMACIÓN
            ================================= */}

            {(actividadSeleccionada.estado === "Reprogramada" ||
              actividadSeleccionada.estado === "Ejecutado Reprogramado") && (
              <div className="detalle-reprogramacion">
                <div className="reprogramacion-icono">!</div>

                <div>
                  <span>Actividad reprogramada</span>

                  {/* FECHA ORIGINAL */}

                  <strong>Fecha original</strong>

                  <p>
                    {actividadSeleccionada.fechaOriginal
                      ? formatearFecha(
                          obtenerFecha(actividadSeleccionada.fechaOriginal),
                        )
                      : formatearFecha(
                          obtenerFecha(actividadSeleccionada.fecha),
                        )}
                  </p>

                  {/* FECHA ACTUAL */}

                  <strong>Fecha actual</strong>

                  <p>
                    {actividadSeleccionada.fechaActual
                      ? formatearFecha(
                          obtenerFecha(actividadSeleccionada.fechaActual),
                        )
                      : formatearFecha(
                          obtenerFecha(actividadSeleccionada.fecha),
                        )}
                  </p>

                  {/* MOTIVO */}

                  <strong>Motivo de reprogramación</strong>

                  <p>
                    {actividadSeleccionada.motivoReprogramacion ||
                      actividadSeleccionada.motivo ||
                      "No especificado"}
                  </p>

                  {/* OBSERVACIÓN */}

                  <strong>Observación</strong>

                  <p>
                    {actividadSeleccionada.observacionReprogramacion ||
                      "Sin observaciones"}
                  </p>
                </div>
              </div>
            )}

            {/* =================================
                MATERIALES
            ================================= */}

            {actividadSeleccionada.materiales?.trim() && (
              <div className="detalle-materiales">
                <div className="materiales-detalle-icono">✓</div>

                <div>
                  <span>Materiales solicitados</span>

                  <p>{actividadSeleccionada.materiales}</p>
                </div>
              </div>
            )}

            <div className="detalle-footer">
              <button className="btn-modal-cerrar" onClick={cerrarModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================
          MODAL MATERIALES
      ===================================== */}

      {actividadMateriales && (
        <div className="modal-overlay" onClick={cerrarMateriales}>
          <div
            className="modal-detalle modal-materiales"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detalle-header">
              <div className="detalle-header-texto">
                <span className="detalle-etiqueta">SIGPAS · MATERIALES</span>

                <h2>Materiales necesarios</h2>

                <p>
                  Registre los materiales necesarios para realizar esta
                  actividad.
                </p>
              </div>
            </div>

            <div className="materiales-actividad">
              <span>Actividad</span>

              <strong>
                {actividadMateriales.nombre ||
                  actividadMateriales.actividad ||
                  "Actividad"}
              </strong>
            </div>

            <div className="materiales-campo">
              <label htmlFor="materiales">Materiales</label>

              <textarea
                id="materiales"
                value={materiales}
                onChange={(e) => setMateriales(e.target.value)}
                placeholder="Escriba aquí los materiales necesarios..."
                rows="6"
                autoFocus
              />
            </div>

            <div className="detalle-footer">
              <button className="btn-modal-cerrar" onClick={cerrarMateriales}>
                Cancelar
              </button>

              <button
                className="btn-materiales-guardar"
                onClick={guardarMateriales}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Actividades;
