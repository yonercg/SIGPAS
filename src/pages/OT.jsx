import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useActividades } from "../context/ActividadesContext";
import { cuadrillas as cuadrillasData } from "../data/cuadrillas";
import "./OT.css";

// =========================================================
// OPCIONES
// =========================================================

const TIPOS_OT = ["PROGRAMADO", "NO PROGRAMADO"];

const ACTIVIDADES_OT = [
  "INSPECCIÓN",
  "MTTO BANCO DE BATERIAS",
  "CAMBIO SILICA GEL",
  "RECARGA SF6",
  "ATENCIÓN EMERGENCIA",
  "MARQUILLADO/AMARILLADO",
  "MONTAJE EQUIPOS",
  "MANIOBRA NV III",
  "MANIOBRA NV IV",
  "MTTO LOCATIVO",
  "ACOMPAÑAMIENTO",
  "MTTO RECONECTADOR",
  "AJUSTE PROTECCIONES",
  "AJUSTE CONTROL",
  "TERMOGRAFIA",
  "SPT Y TPC",
];

const TIPOS_MTTO = [
  "MTTO PREVENTIVO",
  "MTTO PREDICTIVO",
  "MTTO CORRECTIVO",
  "NO MANTENIMIENTO",
  "MEJORATIVO",
];

const PLANEADORES = ["EMSA", "CONTRATISTA", "CSM EMERGENCIA"];

const EMPRESAS = ["EMSA", "CONTRATISTA", "DAGELEC", "EXTERNO"];

const CONTRASENA_CIERRE_OT = "EMSA1408";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// =========================================================
// ESTRUCTURA VACÍA
// =========================================================

function obtenerEstructuraOTVacia() {
  return {
    fechaEmision: "",
    numeroOT: "",
    tipoOT: "PROGRAMADO",
    actividad: "",
    descripcionOT: "",
    tipoMTTO: "",
    equiposIntervenir: "",
    ubicacionGeografica: "",
    inicioActividadFecha: "",
    inicioActividadHora: "",
    finActividadFecha: "",
    finActividadHora: "",
    planeador: "EMSA",
    cuadrillas: "",
    fechaPlaneada: "",
    documentacion: "PR-GD-MS-03",
    horasEstimadas: "8",
    fechaCreada: "",
    nCuadrillas: "1",
    equipo: "",
    ordenSAP: "N/A",
    memorandoFormato: "",
    cantIngenieros: "1",
    cantAsistentes: "",
    cantTecnicos: "2",
    cantAuxiliares: "",
    descripcionActividades: "",
    diagramaUnifilar: "",
    ejecucion: {
      dia1: {
        iniDesp1: "",
        finDesp1: "",
        iniAct1: "",
        finAct1: "",
        iniDesp2: "",
        finDesp2: "",
      },
      dia2: {
        iniDesp1: "",
        finDesp1: "",
        iniAct1: "",
        finAct1: "",
        iniDesp2: "",
        finDesp2: "",
      },
      dia3: {
        iniDesp1: "",
        finDesp1: "",
        iniAct1: "",
        finAct1: "",
        iniDesp2: "",
        finDesp2: "",
      },
    },
    preliminares: {
      charlaSeguridad: "",
      admonDocumentacion: "",
      esperaMateriales: "",
      esperaHerramienta: "",
      esperaPermiso: "",
      aislamiento: "",
      cambioCondiciones: "",
      climatologia: "",
      ordenPublico: "",
    },
    descripcionActividadesRealizadas: "",
    personalEjecutor: [
      { nombre: "", cargo: "", empresa: "", cedula: "", firma: "" },
    ],
    materiales: [{ descripcion: "", cantidad: "", referencia: "" }],
    numeroInforme: "",
    fechaRecepcionInforme: "",
    informeRecibidoPor: "",
    fechaAprobacionInforme: "",
    informeAprobadoPor: "",
    fotosCierre: ["", "", ""],
    fechaAutorizacion: "",
    ejecutadoPor: "",
    tarea100: "NO",
    porcentajeTarea: "",
    fechaCierre: "",
    recibidoPor: "",
    firmaAutorizacion: "",
    firmaRecibidoPor: "",
    estadoOT: "Pendiente",
  };
}

function fusionarConEstructura(otGuardada) {
  const base = obtenerEstructuraOTVacia();
  if (!otGuardada) return base;

  const personalFusionado =
    otGuardada.personalEjecutor && otGuardada.personalEjecutor.length
      ? otGuardada.personalEjecutor.map((p) => ({
          nombre: "",
          cargo: "",
          empresa: "",
          cedula: "",
          firma: "",
          ...p,
        }))
      : base.personalEjecutor;

  return {
    ...base,
    ...otGuardada,
    ejecucion: {
      ...base.ejecucion,
      ...(otGuardada.ejecucion || {}),
      dia1: { ...base.ejecucion.dia1, ...(otGuardada.ejecucion?.dia1 || {}) },
      dia2: { ...base.ejecucion.dia2, ...(otGuardada.ejecucion?.dia2 || {}) },
      dia3: { ...base.ejecucion.dia3, ...(otGuardada.ejecucion?.dia3 || {}) },
    },
    preliminares: {
      ...base.preliminares,
      ...(otGuardada.preliminares || {}),
    },
    personalEjecutor: personalFusionado,
    materiales:
      otGuardada.materiales && otGuardada.materiales.length
        ? otGuardada.materiales
        : base.materiales,
    fotosCierre:
      otGuardada.fotosCierre && otGuardada.fotosCierre.length === 3
        ? otGuardada.fotosCierre
        : base.fotosCierre,
  };
}

// =========================================================
// HELPERS
// =========================================================

function extraerAnio(fecha) {
  if (!fecha) return "";
  if (typeof fecha === "string" && fecha.length >= 4) {
    return fecha.substring(0, 4);
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return String(d.getFullYear());
}

function extraerMes(fecha) {
  if (!fecha) return "";
  if (typeof fecha === "string" && /^\d{4}-\d{2}/.test(fecha)) {
    return String(Number(fecha.substring(5, 7)));
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return String(d.getMonth() + 1);
}

// =========================================================
// OBTENER NÚMERO DE SEMANA ISO
// (misma lógica que Actividades y Programación)
// =========================================================

function obtenerNumeroSemanaISO(fecha) {
  const fechaUTC = new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
  );

  const diaSemana = fechaUTC.getUTCDay() || 7;

  fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

  const inicioAnio = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));

  return Math.ceil(((fechaUTC - inicioAnio) / 86400000 + 1) / 7);
}

// =========================================================
// OBTENER SEMANA A PARTIR DE UNA FECHA (string o Date)
// =========================================================

function obtenerSemanaDeFecha(fecha) {
  if (!fecha) return null;

  let d;

  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    const [a, m, dia] = fecha.substring(0, 10).split("-").map(Number);

    d = new Date(a, m - 1, dia);
  } else {
    d = new Date(fecha);
  }

  if (isNaN(d.getTime())) return null;

  return obtenerNumeroSemanaISO(d);
}

function formatearFechaCorta(fecha) {
  if (!fecha) return "—";
  let d;
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [a, m, dia] = fecha.split("-").map(Number);
    d = new Date(a, m - 1, dia);
  } else {
    d = new Date(fecha);
  }
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function obtenerNombreCuadrillaDeActividad(actividad) {
  if (!actividad) return "";
  const cuadrillaId = actividad.cuadrillaId || actividad.cuadrilla || "";
  const cuadrilla = cuadrillasData.find((item) => item.id === cuadrillaId);
  return (
    cuadrilla?.nombre || actividad.cuadrilla || actividad.cuadrillaId || ""
  );
}

// =========================================================
// UTILIDADES
// =========================================================

async function esperarImagenes(raiz) {
  const imgs = Array.from(raiz.querySelectorAll("img"));
  if (imgs.length === 0) return;

  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalHeight !== 0) {
            resolve();
            return;
          }
          const timeout = setTimeout(() => resolve(), 5000);
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve();
          };
        }),
    ),
  );
}

async function esperarFuentes() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }
}

// =========================================================
// HELPER: Formatear fecha para PDF (DD/MM/YYYY HH:MM)
// =========================================================

function formatearFechaPDF(fechaISO) {
  if (!fechaISO) return "";
  const [fecha, hora] = String(fechaISO).split("T");
  const partes = fecha.split("-");
  if (partes.length !== 3) return fechaISO;
  const [y, m, d] = partes;
  const fechaFmt = `${d}/${m}/${y}`;
  if (hora) return `${fechaFmt} ${hora}`;
  return fechaFmt;
}

// =========================================================
// HELPER: Generar PDF con inyección de <style>
// =========================================================

async function generarPDFDeHoja(hojaElement, nombreArchivo, datosOT = null) {
  if (!hojaElement) {
    throw new Error("No se encontró el elemento .ot-hoja");
  }

  // Contenedor fuera del viewport, no hereda zoom ni transformaciones
  const contenedorClon = document.createElement("div");
  contenedorClon.style.cssText = `
    position: absolute;
    left: -99999px;
    top: 0;
    width: 816px;
    background: #ffffff;
    z-index: 2147483646;
    pointer-events: none;
    overflow: visible;
    zoom: 1 !important;
    transform: none !important;
    transform-origin: top left;
  `;
  document.body.appendChild(contenedorClon);

  // ============================================================
  // INYECTAR STYLE OVERRIDES
  // ============================================================
  const styleOverride = document.createElement("style");
  styleOverride.textContent = `
    /* === GRID ACTIVIDADES === */
    .ot-grid-actividades {
      display: table !important;
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .ot-bloque-actividades,
    .ot-bloque-diagrama {
      display: table-cell !important;
      vertical-align: top !important;
      padding: 6px !important;
      box-sizing: border-box !important;
    }
    .ot-bloque-actividades {
      width: 58% !important;
      border-right: 1px solid #000000 !important;
    }
    .ot-bloque-diagrama {
      width: 42% !important;
    }
    .ot-bloque-actividades .ot-textarea,
    .ot-bloque-actividades textarea {
      display: block !important;
      width: 100% !important;
      min-height: 55px !important;
      height: 55px !important;
      box-sizing: border-box !important;
    }
    .ot-bloque-diagrama .ot-foto-zona {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 55px !important;
      height: 55px !important;
      border: 1px dashed #9ca3af !important;
      background: #f9fafb !important;
      padding: 4px !important;
    }

    /* === GRID PERSONAL === */
    .ot-grid-personal {
      display: table !important;
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .ot-grid-personal > table {
      display: table-cell !important;
      width: 50% !important;
      vertical-align: top !important;
      float: none !important;
      box-sizing: border-box !important;
    }

    /* === CELDA DESCRIPCIÓN PRELIMINARES (rowSpan=13) === */
    .ot-celda-descripcion {
      padding: 4px !important;
      vertical-align: top !important;
      height: 1px !important;
      box-sizing: border-box !important;
      background: transparent !important;
      position: static !important;
    }
  `;
  contenedorClon.appendChild(styleOverride);

  // Clonar la hoja
  const clon = hojaElement.cloneNode(true);
  clon.style.boxShadow = "none";
  clon.style.margin = "0";
  clon.style.transform = "none";
  clon.style.zoom = "1";
  clon.style.width = "816px";
  clon.style.minWidth = "816px";
  clon.style.maxWidth = "816px";
  clon.style.minHeight = "1056px";
  clon.style.display = "block";
  clon.style.contain = "none";
  clon.style.overflow = "visible";

  // FIX 1: Emojis
  clon.querySelectorAll(".ot-foto-zona-icono").forEach((el) => {
    el.textContent = "FOTO";
    el.style.fontSize = "10px";
    el.style.fontWeight = "bold";
    el.style.color = "#9ca3af";
    el.style.letterSpacing = "1px";
  });

  // FIX 2: Radios y checkboxes → texto marcado
  clon.querySelectorAll('input[type="radio"]').forEach((radio) => {
    const marcado = radio.checked ? "X" : " ";
    const span = document.createElement("span");
    span.textContent = `[${marcado}]`;
    span.style.cssText = `display:inline-block;font-family:monospace;font-size:10px;margin-right:3px;color:#000;`;
    radio.parentNode.replaceChild(span, radio);
  });

  clon.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
    const marcado = chk.checked ? "X" : " ";
    const span = document.createElement("span");
    span.textContent = `[${marcado}]`;
    span.style.cssText = `display:inline-block;font-family:monospace;font-size:10px;margin-right:3px;color:#000;`;
    chk.parentNode.replaceChild(span, chk);
  });

  // FIX 3: Inputs y textareas → divs con formato de fechas
  clon
    .querySelectorAll(
      'input:not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea',
    )
    .forEach((el) => {
      const div = document.createElement("div");
      const valor = el.value || "";

      if (el.type === "date" && valor) {
        const [y, m, d] = valor.split("-");
        div.textContent = `${d}/${m}/${y}`;
      } else if (el.type === "datetime-local" && valor) {
        const [fecha, hora] = valor.split("T");
        const [y, m, d] = fecha.split("-");
        div.textContent = `${d}/${m}/${y} ${hora || ""}`;
      } else {
        div.textContent = valor || el.getAttribute("placeholder") || "";
      }

      div.style.cssText = `
        width:100%;padding:3px 6px;
        font-family:Arial, Helvetica, sans-serif;font-size:9px;color:#000;
        white-space:pre-wrap;word-wrap:break-word;
        min-height:18px;box-sizing:border-box;line-height:1.3;
      `;

      if (!div.textContent) div.innerHTML = "&nbsp;";

      el.parentNode.replaceChild(div, el);
    });

  clon.querySelectorAll('input[type="file"]').forEach((f) => f.remove());

  // FIX 4: Limpieza
  clon.querySelectorAll("datalist").forEach((d) => d.remove());
  clon
    .querySelectorAll(
      ".ot-btn-mini, .ot-btn-agregar-fila, .ot-btn-eliminar, .ot-firma-personal-zona input",
    )
    .forEach((b) => b.remove());

  // ============================================================
  // FIX 4.5: CELDA DE DESCRIPCIÓN (rowSpan={13}) → DIV SIMPLE
  // ============================================================
  clon.querySelectorAll(".ot-celda-descripcion").forEach((td) => {
    const textarea = td.querySelector("textarea");
    const value = textarea ? textarea.value : "";

    td.innerHTML = "";
    td.className = "ot-celda-descripcion";
    td.setAttribute(
      "style",
      `
        position: static !important;
        padding: 4px !important;
        vertical-align: top !important;
        height: 1px !important;
        box-sizing: border-box !important;
        background: transparent !important;
      `,
    );

    const div = document.createElement("div");
    div.setAttribute(
      "style",
      `
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        padding: 2px !important;
        box-sizing: border-box !important;
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: 8.5px !important;
        line-height: 1.3 !important;
        color: #000 !important;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow: hidden !important;
      `,
    );
    div.textContent = value || "";

    td.appendChild(div);
  });

  // ============================================================
  // FIX 5: RECONSTRUIR BLOQUE DEL CIERRE CON DOM API
  // ============================================================
  const cierreGrid = clon.querySelector(".ot-cierre-grid");
  console.log("[PDF] cierreGrid encontrado:", !!cierreGrid);
  console.log("[PDF] datosOT presente:", !!datosOT);

  if (cierreGrid && datosOT) {
    const formatearFecha = (fechaISO) => {
      if (!fechaISO) return "—";
      const [fecha, hora] = String(fechaISO).split("T");
      const partes = fecha.split("-");
      if (partes.length !== 3) return fechaISO;
      const [y, m, d] = partes;
      const fechaFmt = `${d}/${m}/${y}`;
      if (hora) return `${fechaFmt} ${hora}`;
      return fechaFmt;
    };

    const fechaAutorizacionFmt = formatearFecha(datosOT.fechaAutorizacion);
    const fechaCierreFmt = formatearFecha(datosOT.fechaCierre);

    const crearCelda = (config) => {
      const td = document.createElement("td");
      const estiloBase =
        "width:33.33%;padding:8px;text-align:center;vertical-align:top;box-sizing:border-box;";
      const estiloBorde = config.esUltimo
        ? ""
        : "border-right:1px solid #000000;";
      td.setAttribute("style", estiloBase + estiloBorde);

      const divFoto = document.createElement("div");
      divFoto.setAttribute(
        "style",
        "border:1px dashed #9ca3af;background:#f9fafb;height:90px;display:flex;align-items:center;justify-content:center;overflow:hidden;",
      );

      if (config.src) {
        const img = document.createElement("img");
        img.setAttribute("src", config.src);
        img.setAttribute(
          "style",
          "max-width:90%;max-height:80px;object-fit:contain;display:block;",
        );
        img.setAttribute("alt", "");
        divFoto.appendChild(img);
      } else {
        const span = document.createElement("span");
        span.setAttribute(
          "style",
          "font-size:10px;color:#9ca3af;font-weight:700;letter-spacing:1px;",
        );
        span.textContent = "FOTO";
        divFoto.appendChild(span);
      }
      td.appendChild(divFoto);

      const linea = document.createElement("div");
      linea.setAttribute(
        "style",
        "border-bottom:1px solid #000000;width:90%;margin:6px auto;height:0;",
      );
      td.appendChild(linea);

      const label = document.createElement("div");
      label.setAttribute(
        "style",
        "font-size:8px;font-weight:700;text-transform:uppercase;color:#000000;margin:4px 0;line-height:1.2;",
      );
      label.textContent = config.label;
      td.appendChild(label);

      if (config.fecha) {
        const fechaDiv = document.createElement("div");
        fechaDiv.setAttribute(
          "style",
          "font-size:9px;color:#000000;margin:3px 0;",
        );
        fechaDiv.textContent = config.fecha;
        td.appendChild(fechaDiv);
      }

      if (config.sub) {
        const sub = document.createElement("div");
        sub.setAttribute(
          "style",
          "font-size:7.5px;color:#333333;margin:2px 0;",
        );
        sub.textContent = config.sub;
        td.appendChild(sub);
      }

      if (config.tarea) {
        const tareaDiv = document.createElement("div");
        tareaDiv.setAttribute(
          "style",
          "font-size:8px;color:#000000;margin:6px 0;line-height:1.4;",
        );
        tareaDiv.textContent = config.tarea;
        td.appendChild(tareaDiv);
      }

      return td;
    };

    const tabla = document.createElement("table");
    tabla.setAttribute(
      "style",
      "width:100%;border-collapse:collapse;table-layout:fixed;",
    );

    const tbody = document.createElement("tbody");
    const tr = document.createElement("tr");

    tr.appendChild(
      crearCelda({
        src: datosOT.firmaAutorizacion || "",
        label: "Firma autorización ejecución OT",
        fecha: fechaAutorizacionFmt,
        sub: "Fecha Autorización OT",
        tarea: null,
        esUltimo: false,
      }),
    );

    tr.appendChild(
      crearCelda({
        src:
          datosOT.fotosCierre && datosOT.fotosCierre[1]
            ? datosOT.fotosCierre[1]
            : "",
        label: "Ejecutado por",
        fecha: null,
        sub: null,
        tarea:
          datosOT.tarea100 === "SI"
            ? "[X] Tarea 100% SI    [ ] NO"
            : "[ ] Tarea 100% SI    [X] NO",
        esUltimo: false,
      }),
    );

    tr.appendChild(
      crearCelda({
        src: datosOT.firmaRecibidoPor || "",
        label: "Recibido por",
        fecha: fechaCierreFmt,
        sub: "Fecha Cierre OT",
        tarea: null,
        esUltimo: true,
      }),
    );

    tbody.appendChild(tr);
    tabla.appendChild(tbody);

    cierreGrid.parentNode.replaceChild(tabla, cierreGrid);
    console.log("[PDF] CIERRE OT reemplazado correctamente");
  }

  contenedorClon.appendChild(clon);

  try {
    await esperarImagenes(contenedorClon);
    await esperarFuentes();

    // Doble RAF + delays para asegurar layout completo
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 300));
    await new Promise((r) => setTimeout(r, 800));

    // Forzar reflow
    void clon.offsetHeight;

    const html2canvasModule = await import("html2canvas");
    const html2canvas = html2canvasModule.default || html2canvasModule;

    // Medir con varios métodos y tomar el MAYOR para no cortar contenido
    const altoScroll = clon.scrollHeight;
    const altoOffset = clon.offsetHeight;
    const altoContenedor = contenedorClon.scrollHeight;

    // Recorrer TODOS los descendientes para detectar el fondo real
    // (captura contenido que sobresale del scrollHeight por overflow)
    const clonRect = clon.getBoundingClientRect();
    let maxBottom = clonRect.height;
    clon.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      const bottom = r.bottom - clonRect.top;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    const ancho = 816;
    // +100px de margen de seguridad para que nunca corte la última fila
    const alto = Math.ceil(
      Math.max(altoScroll, altoOffset, altoContenedor, maxBottom) + 100,
    );

    console.log("[PDF] Medidas:", {
      altoScroll,
      altoOffset,
      altoContenedor,
      maxBottom,
      anchoFinal: ancho,
      altoFinal: alto,
    });

    const canvas = await html2canvas(clon, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: ancho,
      height: alto,
      windowWidth: ancho,
      windowHeight: alto,
      scrollX: 0,
      scrollY: 0,
    });

    const jsPDFModule = await import("jspdf");
    const { jsPDF } = jsPDFModule;

    const pdf = new jsPDF({
      unit: "in",
      format: "letter",
      orientation: "portrait",
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0.01) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
    }

    pdf.save(nombreArchivo);
  } finally {
    document.body.removeChild(contenedorClon);
  }
}

// =========================================================
// LISTADO
// =========================================================

function OTListado({
  actividades,
  obtenerOTPorActividad,
  eliminarOT,
  navigate,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroSemana, setFiltroSemana] = useState("");
  const [filtroSubestacion, setFiltroSubestacion] = useState("");
  const [filtroCuadrilla, setFiltroCuadrilla] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [paraEliminar, setParaEliminar] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [progresoDescarga, setProgresoDescarga] = useState({
    actual: 0,
    total: 0,
  });

  const listaOTs = useMemo(() => {
    const result = [];

    actividades.forEach((act) => {
      const ot = obtenerOTPorActividad(act.id);

      if (!ot) return;

      const nombreCuadrilla =
        ot.cuadrillas || obtenerNombreCuadrillaDeActividad(act);

      // La semana debe coincidir con la mostrada en Actividades.
      // 1) Se intenta con la fecha de la actividad vinculada.
      // 2) Si no existe, se usa la fecha de emisión de la OT.
      const semanaActividad = obtenerSemanaDeFecha(act.fecha);
      const semanaOT =
        semanaActividad != null
          ? semanaActividad
          : obtenerSemanaDeFecha(ot.fechaEmision);

      result.push({
        actividadId: String(act.id),
        numeroOT: ot.numeroOT || "",
        subestacion: act.subestacion || ot.ubicacionGeografica || "—",
        cuadrilla: nombreCuadrilla || "—",
        estado: ot.estadoOT || "Pendiente",
        fechaEmision: ot.fechaEmision || "",
        anio: extraerAnio(ot.fechaEmision),
        mes: extraerMes(ot.fechaEmision),
        semana: semanaOT,
      });
    });

    result.sort((a, b) => String(b.numeroOT).localeCompare(String(a.numeroOT)));

    return result;
  }, [actividades, obtenerOTPorActividad]);

  const opcionesAnios = useMemo(() => {
    const set = new Set();
    listaOTs.forEach((o) => {
      if (o.anio) set.add(o.anio);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [listaOTs]);

  const opcionesSemanas = useMemo(() => {
    const set = new Set();
    listaOTs.forEach((o) => {
      if (o.semana != null) set.add(o.semana);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [listaOTs]);

  const opcionesSubestaciones = useMemo(() => {
    const set = new Set();
    listaOTs.forEach((o) => {
      if (o.subestacion && o.subestacion !== "—") set.add(o.subestacion);
    });
    return Array.from(set).sort();
  }, [listaOTs]);

  const opcionesCuadrillas = useMemo(() => {
    const set = new Set();
    listaOTs.forEach((o) => {
      if (o.cuadrilla && o.cuadrilla !== "—") set.add(o.cuadrilla);
    });
    return Array.from(set).sort();
  }, [listaOTs]);

  const listaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return listaOTs.filter((o) => {
      if (texto) {
        const concat = [o.numeroOT, o.subestacion, o.cuadrilla, o.estado]
          .join(" ")
          .toLowerCase();

        if (!concat.includes(texto)) return false;
      }

      if (filtroAnio && o.anio !== filtroAnio) return false;

      if (filtroMes && o.mes !== filtroMes) return false;

      if (filtroSemana && String(o.semana ?? "") !== String(filtroSemana)) {
        return false;
      }

      if (filtroSubestacion && o.subestacion !== filtroSubestacion)
        return false;

      if (filtroCuadrilla && o.cuadrilla !== filtroCuadrilla) return false;

      if (filtroEstado && o.estado !== filtroEstado) return false;

      return true;
    });
  }, [
    listaOTs,
    busqueda,
    filtroAnio,
    filtroMes,
    filtroSemana,
    filtroSubestacion,
    filtroCuadrilla,
    filtroEstado,
  ]);

  const todosSeleccionados =
    listaFiltrada.length > 0 &&
    listaFiltrada.every((o) => seleccionadas.includes(o.actividadId));

  const toggleTodos = () => {
    if (todosSeleccionados) setSeleccionadas([]);
    else setSeleccionadas(listaFiltrada.map((o) => o.actividadId));
  };

  const toggleUno = (id) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // =========================================
  // DESCARGAR UN PDF (promesa individual)
  // =========================================

  const descargarUnPDF = (id) => {
    return new Promise((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 816px;
        height: 1200px;
        border: 0;
        opacity: 0.01;
        pointer-events: none;
      `;

      let resuelto = false;

      const terminar = (motivo) => {
        if (resuelto) return;
        resuelto = true;
        console.log(`[PDF-masivo] ✅ Terminando OT ${id} — motivo: ${motivo}`);
        window.removeEventListener("message", listener);
        clearTimeout(timeout);
        try {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch (e) {}
        resolve();
      };

      const listener = (event) => {
        if (!event.data || typeof event.data !== "object") return;
        console.log(`[PDF-masivo] 📩 Mensaje recibido del iframe:`, event.data);
        const { tipo, actividadId: idMsg } = event.data;
        if (
          String(idMsg) === String(id) &&
          (tipo === "pdfOk" || tipo === "pdfError")
        ) {
          terminar(tipo);
        }
      };

      window.addEventListener("message", listener);

      iframe.onload = () => {
        console.log(`[PDF-masivo] 📄 iframe cargado para OT ${id}`);
      };

      iframe.onerror = (e) => {
        console.error(`[PDF-masivo] ❌ Error al cargar iframe OT ${id}:`, e);
        terminar("iframeError");
      };

      const timeout = setTimeout(() => {
        console.warn(`[PDF-masivo] ⏱ Timeout de 30s para OT ${id}`);
        terminar("timeout");
      }, 30000);

      const basePath = window.location.pathname.replace(/\/ot.*$/, "");
      const url = `${window.location.origin}${basePath}/ot?actividadId=${encodeURIComponent(
        id,
      )}&pdfMode=1&t=${Date.now()}`;

      console.log(`[PDF-masivo] 🚀 Cargando OT ${id} en:`, url);

      iframe.src = url;
      document.body.appendChild(iframe);
    });
  };

  // =========================================
  // DESCARGAR SELECCIONADAS
  // =========================================

  const descargarSeleccionadas = async () => {
    if (seleccionadas.length === 0) return;
    if (descargando) return;

    setDescargando(true);
    setProgresoDescarga({ actual: 0, total: seleccionadas.length });

    for (let i = 0; i < seleccionadas.length; i++) {
      const id = seleccionadas[i];
      setProgresoDescarga({ actual: i + 1, total: seleccionadas.length });

      try {
        await descargarUnPDF(id);
      } catch (err) {
        console.error(`Error descargando OT ${id}:`, err);
      }

      if (i < seleccionadas.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setDescargando(false);
    setProgresoDescarga({ actual: 0, total: 0 });
  };

  const pedirEliminar = (item) => setParaEliminar({ items: [item] });

  const confirmarEliminar = () => {
    if (!paraEliminar) return;
    paraEliminar.items.forEach((it) => eliminarOT(it.actividadId));
    setSeleccionadas((prev) =>
      prev.filter(
        (id) => !paraEliminar.items.some((it) => it.actividadId === id),
      ),
    );
    setParaEliminar(null);
  };

  const cancelarEliminar = () => setParaEliminar(null);

  const abrirOT = (actividadId) => {
    navigate(`/ot?actividadId=${encodeURIComponent(actividadId)}`);
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroAnio("");
    setFiltroMes("");
    setFiltroSemana("");
    setFiltroSubestacion("");
    setFiltroCuadrilla("");
    setFiltroEstado("");
  };

  return (
    <div className="ot-lista-page">
      <div className="ot-lista-title-card">
        <div className="ot-lista-header">
          <div>
            <h1>Órdenes de Trabajo</h1>

            <p>
              Administra y consulta todas las órdenes de trabajo registradas en
              el sistema.
            </p>
          </div>
        </div>
      </div>

      <div className="ot-lista-filtros">
        <input
          type="text"
          className="ot-lista-filtros-busqueda"
          placeholder="Buscar por N° OT, subestación, cuadrilla o estado..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <select
          className="ot-lista-filtros-select"
          value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value)}
        >
          <option value="">Todos los años</option>
          {opcionesAnios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          className="ot-lista-filtros-select"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
        >
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>

        <select
          className="ot-lista-filtros-select"
          value={filtroSemana}
          onChange={(e) => setFiltroSemana(e.target.value)}
        >
          <option value="">Todas las semanas</option>
          {opcionesSemanas.map((s) => (
            <option key={s} value={String(s)}>
              Semana {s}
            </option>
          ))}
        </select>

        <select
          className="ot-lista-filtros-select"
          value={filtroSubestacion}
          onChange={(e) => setFiltroSubestacion(e.target.value)}
        >
          <option value="">Todas las subestaciones</option>
          {opcionesSubestaciones.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="ot-lista-filtros-select"
          value={filtroCuadrilla}
          onChange={(e) => setFiltroCuadrilla(e.target.value)}
        >
          <option value="">Todas las cuadrillas</option>
          {opcionesCuadrillas.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="ot-lista-filtros-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En revisión">En revisión</option>
          <option value="OT Cerrada">OT Cerrada</option>
        </select>

        <button
          type="button"
          className="ot-lista-btn-limpiar"
          onClick={limpiarFiltros}
        >
          Limpiar
        </button>
      </div>

      {seleccionadas.length > 0 && (
        <div className="ot-lista-barra-seleccion">
          <span>
            {descargando
              ? `⏳ Generando PDF ${progresoDescarga.actual} de ${progresoDescarga.total}...`
              : `${seleccionadas.length} ${seleccionadas.length === 1 ? "OT seleccionada" : "OTs seleccionadas"}`}
          </span>
          <button
            type="button"
            className="ot-lista-btn-descargar-masivo"
            onClick={descargarSeleccionadas}
            disabled={descargando}
          >
            {descargando ? "⏳ Descargando..." : "⬇ Descargar seleccionadas"}
          </button>
        </div>
      )}

      <div className="ot-lista-tabla-contenedor">
        <table className="ot-lista-tabla">
          <thead>
            <tr>
              <th className="ot-lista-checkbox-col">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                  aria-label="Seleccionar todas"
                  disabled={descargando}
                />
              </th>
              <th>Código OT</th>
              <th>Fecha</th>
              <th>Semana</th>
              <th>Subestación</th>
              <th>Cuadrilla</th>
              <th>Estado</th>
              <th className="ot-lista-acciones-col">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr>
                <td colSpan="8">
                  <div className="ot-lista-vacio">
                    <div className="ot-lista-vacio-icono">📋</div>

                    <h3>No hay órdenes de trabajo</h3>

                    <p>
                      No se encontraron OTs con los filtros seleccionados, o aún
                      no se ha creado ninguna.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              listaFiltrada.map((o) => {
                const isSeleccionada = seleccionadas.includes(o.actividadId);

                return (
                  <tr key={o.actividadId}>
                    <td className="ot-lista-checkbox-col">
                      <input
                        type="checkbox"
                        checked={isSeleccionada}
                        onChange={() => toggleUno(o.actividadId)}
                        aria-label={`Seleccionar OT ${o.numeroOT}`}
                        disabled={descargando}
                      />
                    </td>

                    <td>
                      <strong>{o.numeroOT || "Sin número"}</strong>
                    </td>

                    <td>{formatearFechaCorta(o.fechaEmision)}</td>

                    <td>
                      {o.semana != null ? (
                        <span className="ot-lista-semana-badge">
                          Semana {o.semana}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>{o.subestacion}</td>

                    <td>{o.cuadrilla}</td>

                    <td>
                      <span
                        className={`ot-lista-estado ot-lista-estado-${o.estado
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {o.estado}
                      </span>
                    </td>

                    <td className="ot-lista-acciones-col">
                      <div className="ot-lista-acciones">
                        <button
                          type="button"
                          className="ot-lista-btn-abrir"
                          onClick={() => abrirOT(o.actividadId)}
                          title="Abrir OT"
                        >
                          📂 Abrir
                        </button>

                        <button
                          type="button"
                          className="ot-lista-btn-eliminar"
                          onClick={() => pedirEliminar(o)}
                          title="Eliminar OT"
                          disabled={descargando}
                        >
                          🗑 Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="ot-lista-contador">
        Mostrando {listaFiltrada.length} de {listaOTs.length} OTs
      </p>

      {paraEliminar && (
        <div className="ot-confirm-overlay" onClick={cancelarEliminar}>
          <div
            className="ot-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ot-confirm-icono">⚠️</div>

            <h2>¿Seguro quieres eliminar esta OT?</h2>

            <p>
              Esta acción no se puede deshacer. La información de la orden de
              trabajo será eliminada permanentemente.
            </p>

            <div className="ot-confirm-botones">
              <button
                type="button"
                className="ot-confirm-btn-no"
                onClick={cancelarEliminar}
              >
                No
              </button>

              <button
                type="button"
                className="ot-confirm-btn-si"
                onClick={confirmarEliminar}
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

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

function OT() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const actividadId = searchParams.get("actividadId");
  const autoPrint = searchParams.get("autoPrint") === "1";
  const pdfMode = searchParams.get("pdfMode") === "1";

  const {
    actividades,
    obtenerOTPorActividad,
    guardarOT: guardarOTContext,
    eliminarOT,
  } = useActividades();

  const actividadSeleccionada =
    actividades.find((a) => String(a.id) === String(actividadId)) || null;

  const [ot, setOt] = useState(() => obtenerEstructuraOTVacia());
  const [mensajeGuardado, setMensajeGuardado] = useState("");
  const primeraCarga = useRef(true);
  const estadoAnteriorRef = useRef(null);
  const autoPrintEjecutado = useRef(false);
  const pdfGeneradoRef = useRef(false);
  const otActualRef = useRef(ot);
  otActualRef.current = ot;

  const obtenerFechaInput = (fecha) => {
    if (!fecha) return "";
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha))
      return fecha;
    const fechaConvertida = new Date(fecha);
    if (isNaN(fechaConvertida.getTime())) return "";
    const anio = fechaConvertida.getFullYear();
    const mes = String(fechaConvertida.getMonth() + 1).padStart(2, "0");
    const dia = String(fechaConvertida.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
  };

  const fechaHoy = () => {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
  };

  const fechaHoraAhora = () => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, "0");
    const dia = String(ahora.getDate()).padStart(2, "0");
    const hora = String(ahora.getHours()).padStart(2, "0");
    const min = String(ahora.getMinutes()).padStart(2, "0");
    return `${anio}-${mes}-${dia}T${hora}:${min}`;
  };

  const obtenerNombreCuadrilla = (actividad) => {
    if (!actividad) return "";
    const cuadrillaId = actividad.cuadrillaId || actividad.cuadrilla || "";
    const cuadrilla = cuadrillasData.find((item) => item.id === cuadrillaId);
    return (
      cuadrilla?.nombre || actividad.cuadrilla || actividad.cuadrillaId || ""
    );
  };

  useEffect(() => {
    if (primeraCarga.current) primeraCarga.current = false;
    if (!actividadId) {
      setOt(obtenerEstructuraOTVacia());
      return;
    }
    const otGuardada = obtenerOTPorActividad(actividadId);
    if (otGuardada) {
      setOt(fusionarConEstructura(otGuardada));
      return;
    }
    const nueva = obtenerEstructuraOTVacia();
    if (actividadSeleccionada) {
      nueva.fechaEmision = fechaHoy();
      nueva.numeroOT = actividadSeleccionada.codigoOT || "";
      nueva.actividad = actividadSeleccionada.tipo || "";
      nueva.descripcionOT = "";
      nueva.tipoMTTO = actividadSeleccionada.mantenimiento || "";
      nueva.equiposIntervenir = actividadSeleccionada.equipo || "";
      nueva.ubicacionGeografica = actividadSeleccionada.subestacion || "";
      nueva.cuadrillas = obtenerNombreCuadrilla(actividadSeleccionada);
      nueva.equipo = actividadSeleccionada.equipo || "";
      nueva.fechaPlaneada = obtenerFechaInput(actividadSeleccionada.fecha);
      nueva.fechaCreada = fechaHoy();
      nueva.descripcionActividades =
        actividadSeleccionada.descripcion ||
        actividadSeleccionada.nombre ||
        actividadSeleccionada.actividad ||
        "";
      if (actividadSeleccionada.responsable) {
        nueva.personalEjecutor = [
          {
            nombre: actividadSeleccionada.responsable,
            cargo: "Ingeniero de Cuadrilla",
            empresa: "CONTRATISTA",
            cedula: "",
            firma: "",
          },
        ];
      }
    } else {
      nueva.fechaEmision = fechaHoy();
    }
    setOt(nueva);
  }, [actividadId, actividadSeleccionada]);

  useEffect(() => {
    if (!autoPrint) return;
    if (autoPrintEjecutado.current) return;
    if (!actividadId) return;
    if (!actividadSeleccionada) return;
    autoPrintEjecutado.current = true;
    const timer = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(timer);
  }, [autoPrint, actividadId, actividadSeleccionada]);

  useEffect(() => {
    if (!pdfMode) return;
    if (pdfGeneradoRef.current) return;
    if (!actividadId) return;
    pdfGeneradoRef.current = true;

    console.log(
      "[PDF-iframe] 🎬 Iniciando generación dentro del iframe para actividadId:",
      actividadId,
    );

    const notificarPadre = (tipo) => {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ tipo, actividadId }, "*");
        }
      } catch (e) {}
    };

    const generar = async () => {
      // Esperar a que .ot-hoja exista Y que los datos de la OT estén cargados
      let hoja = null;
      let otActual = null;
      for (let i = 0; i < 40; i++) {
        hoja = document.querySelector(".ot-hoja");
        otActual = otActualRef.current;
        if (hoja && otActual && (otActual.numeroOT || otActual.fechaEmision)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      if (!hoja) {
        console.error(
          "[PDF-iframe] ❌ No apareció .ot-hoja después de esperar 10s",
        );
        notificarPadre("pdfError");
        return;
      }

      try {
        await new Promise((r) => setTimeout(r, 500));
        const numero = otActual.numeroOT || actividadId || "OT";
        console.log("[PDF-iframe] 🖨 Generando PDF con datos:", {
          numero,
          hojaEncontrada: !!hoja,
        });
        await generarPDFDeHoja(hoja, `OT-${numero}.pdf`, otActual);
        console.log("[PDF-iframe] ✅ PDF generado correctamente");
        notificarPadre("pdfOk");
      } catch (err) {
        console.error("[PDF-iframe] ❌ Error al generar PDF:", err);
        notificarPadre("pdfError");
      }
    };

    // Programar SIN cleanup para que no lo cancele un re-render
    setTimeout(generar, 1500);
    // ⚠️ No devolvemos cleanup: si el componente re-renderiza,
    // no queremos cancelar el timer de generación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfMode, actividadId]);

  useEffect(() => {
    const estadoCambio =
      estadoAnteriorRef.current !== null &&
      estadoAnteriorRef.current !== ot.estadoOT;
    estadoAnteriorRef.current = ot.estadoOT;
    if (!estadoCambio) return;
    if (ot.estadoOT !== "OT Cerrada") return;

    setOt((prev) => ({
      ...prev,
      informeRecibidoPor: prev.informeRecibidoPor || "YONER CAICEDO",
      informeAprobadoPor: prev.informeAprobadoPor || "SANDRA ARAGÓN",
      fechaAprobacionInforme: prev.fechaAprobacionInforme || fechaHoy(),
      fechaAutorizacion: prev.fechaAutorizacion || fechaHoy(),
      fechaCierre: prev.fechaCierre || fechaHoraAhora(),
      firmaAutorizacion: prev.firmaAutorizacion || "/firma-sandra.png",
      firmaRecibidoPor: prev.firmaRecibidoPor || "/firma-yoner.jpeg",
    }));
  }, [ot.estadoOT]);

  const actualizarCampo = (campo, valor) =>
    setOt((prev) => ({ ...prev, [campo]: valor }));

  const actualizarEjecucion = (dia, campo, valor) => {
    setOt((prev) => ({
      ...prev,
      ejecucion: {
        ...prev.ejecucion,
        [dia]: { ...prev.ejecucion[dia], [campo]: valor },
      },
    }));
  };

  const actualizarPreliminar = (campo, valor) => {
    setOt((prev) => ({
      ...prev,
      preliminares: { ...prev.preliminares, [campo]: valor },
    }));
  };

  const manejarCambioEstado = (nuevoEstado) => {
    if (nuevoEstado !== "OT Cerrada") {
      actualizarCampo("estadoOT", nuevoEstado);
      return;
    }
    if (ot.estadoOT === "OT Cerrada") return;
    const password = window.prompt(
      "🔒 Ingrese la contraseña para cerrar la OT:",
    );
    if (password === null) return;
    if (password !== CONTRASENA_CIERRE_OT) {
      alert("❌ Contraseña incorrecta. No se puede cerrar la OT.");
      return;
    }
    actualizarCampo("estadoOT", "OT Cerrada");
  };

  const calcularHoras = (inicio, fin) => {
    if (!inicio || !fin) return 0;
    const [hI, mI] = inicio.split(":").map(Number);
    const [hF, mF] = fin.split(":").map(Number);
    if ([hI, mI, hF, mF].some((n) => isNaN(n))) return 0;
    const minutosInicio = hI * 60 + mI;
    const minutosFin = hF * 60 + mF;
    let diferencia = minutosFin - minutosInicio;
    if (diferencia < 0) diferencia += 24 * 60;
    return diferencia / 60;
  };

  const formatearHoras = (horas) => {
    if (!horas || horas <= 0) return "0:00";
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  const calcularDia = (dia) => {
    const d = ot.ejecucion[dia];
    const desplazamiento1 = calcularHoras(d.iniDesp1, d.finDesp1);
    const desplazamiento2 = calcularHoras(d.iniDesp2, d.finDesp2);
    const trabajo1 = calcularHoras(d.iniAct1, d.finAct1);
    const totalDesplazamiento = desplazamiento1 + desplazamiento2;
    const totalTrabajo = trabajo1;
    return {
      totalDesplazamiento,
      totalTrabajo,
      total: totalDesplazamiento + totalTrabajo,
    };
  };

  const dia1 = calcularDia("dia1");
  const dia2 = calcularDia("dia2");
  const dia3 = calcularDia("dia3");

  const totalHorasDesplazamiento =
    dia1.totalDesplazamiento +
    dia2.totalDesplazamiento +
    dia3.totalDesplazamiento;

  const totalHorasTrabajo =
    dia1.totalTrabajo + dia2.totalTrabajo + dia3.totalTrabajo;

  const calcularTotalPreliminares = () => {
    const p = ot.preliminares;
    const convertir = (str) => {
      if (!str) return 0;
      const limpio = String(str).trim();
      if (limpio.includes(":")) {
        const partes = limpio.split(":").map(Number);
        const h = partes[0] || 0;
        const m = partes[1] || 0;
        const s = partes[2] || 0;
        return h + m / 60 + s / 3600;
      }
      const num = Number(limpio);
      return isNaN(num) ? 0 : num;
    };
    const suma = [
      p.charlaSeguridad,
      p.admonDocumentacion,
      p.esperaMateriales,
      p.esperaHerramienta,
      p.esperaPermiso,
      p.aislamiento,
      p.cambioCondiciones,
      p.climatologia,
      p.ordenPublico,
    ].reduce((acc, v) => acc + convertir(v), 0);
    return suma + totalHorasDesplazamiento;
  };

  const totalPreliminares = calcularTotalPreliminares();

  const agregarPersonalEjecutor = () => {
    setOt((prev) => ({
      ...prev,
      personalEjecutor: [
        ...prev.personalEjecutor,
        { nombre: "", cargo: "", empresa: "", cedula: "", firma: "" },
      ],
    }));
  };

  const actualizarPersonalEjecutor = (index, campo, valor) => {
    setOt((prev) => ({
      ...prev,
      personalEjecutor: prev.personalEjecutor.map((p, i) =>
        i === index ? { ...p, [campo]: valor } : p,
      ),
    }));
  };

  const eliminarPersonalEjecutor = (index) => {
    setOt((prev) => ({
      ...prev,
      personalEjecutor: prev.personalEjecutor.filter((_, i) => i !== index),
    }));
  };

  const manejarFirmaPersonal = (index, file) => {
    if (!file) return;
    const lector = new FileReader();
    lector.onload = (e) => {
      actualizarPersonalEjecutor(index, "firma", e.target?.result || "");
    };
    lector.readAsDataURL(file);
  };

  const eliminarFirmaPersonal = (index) =>
    actualizarPersonalEjecutor(index, "firma", "");

  const agregarMaterial = () => {
    setOt((prev) => ({
      ...prev,
      materiales: [
        ...prev.materiales,
        { descripcion: "", cantidad: "", referencia: "" },
      ],
    }));
  };

  const actualizarMaterial = (index, campo, valor) => {
    setOt((prev) => ({
      ...prev,
      materiales: prev.materiales.map((m, i) =>
        i === index ? { ...m, [campo]: valor } : m,
      ),
    }));
  };

  const eliminarMaterial = (index) => {
    setOt((prev) => ({
      ...prev,
      materiales: prev.materiales.filter((_, i) => i !== index),
    }));
  };

  const manejarFoto = (tipo, index, file) => {
    if (!file) return;
    const lector = new FileReader();
    lector.onload = (e) => {
      const base64 = e.target?.result || "";
      if (tipo === "diagrama") actualizarCampo("diagramaUnifilar", base64);
      else if (tipo === "cierre") {
        setOt((prev) => {
          const fotos = [...prev.fotosCierre];
          fotos[index] = base64;
          return { ...prev, fotosCierre: fotos };
        });
      }
    };
    lector.readAsDataURL(file);
  };

  const eliminarFoto = (tipo, index) => {
    if (tipo === "diagrama") actualizarCampo("diagramaUnifilar", "");
    else if (tipo === "cierre") {
      setOt((prev) => {
        const fotos = [...prev.fotosCierre];
        fotos[index] = "";
        return { ...prev, fotosCierre: fotos };
      });
    }
  };

  const guardarOTManual = () => {
    if (!actividadId) return;
    const ok = guardarOTContext(actividadId, ot);
    setMensajeGuardado(ok ? "✓ Guardado" : "✕ Error");
    setTimeout(() => setMensajeGuardado(""), 2500);
  };

  const imprimirOT = async () => {
    try {
      const hoja = document.querySelector(".ot-hoja");
      const numero = ot.numeroOT || actividadId || "OT";
      await generarPDFDeHoja(hoja, `OT-${numero}.pdf`, ot);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      alert("No se pudo generar el PDF. Intenta de nuevo.");
    }
  };

  const volverListado = () => navigate("/ot");

  if (!actividadId) {
    return (
      <OTListado
        actividades={actividades}
        obtenerOTPorActividad={obtenerOTPorActividad}
        eliminarOT={eliminarOT}
        navigate={navigate}
      />
    );
  }

  if (!actividadSeleccionada) {
    return (
      <div className="ot-hoja-wrapper">
        <div className="ot-vacio-pantalla">
          <div className="ot-vacio-pantalla-icono">📋</div>
          <h2>Actividad no encontrada</h2>
          <p>
            La actividad indicada en la dirección no existe actualmente en
            SIGPAS.
          </p>
          <button
            type="button"
            className="ot-btn ot-btn-primario"
            onClick={volverListado}
          >
            Ir al listado de OTs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ot-hoja-wrapper">
      <div className="ot-barra-acciones">
        <div className="ot-barra-info">
          <strong>
            Orden de Trabajo · OT : {ot.numeroOT || "Sin Información"}
          </strong>
        </div>
        <div className="ot-barra-botones">
          {mensajeGuardado && (
            <span className="ot-autoguardado">{mensajeGuardado}</span>
          )}
          <button
            type="button"
            className="ot-btn"
            onClick={volverListado}
            title="Volver al listado de OTs"
          >
            ← Listado
          </button>
          <button
            type="button"
            className="ot-btn ot-btn-guardar-manual"
            onClick={guardarOTManual}
          >
            💾 Guardar
          </button>
          <button
            type="button"
            className="ot-btn ot-btn-primario"
            onClick={imprimirOT}
          >
            🖨 Imprimir / Guardar PDF
          </button>
          <select
            className="ot-select-estado"
            data-estado={ot.estadoOT || "Pendiente"}
            value={ot.estadoOT || "Pendiente"}
            onChange={(e) => manejarCambioEstado(e.target.value)}
            title="Estado de la OT"
          >
            <option value="Pendiente">Pendiente</option>
            <option value="En revisión">En revisión</option>
            <option value="OT Cerrada">OT Cerrada</option>
          </select>
        </div>
      </div>

      <div className="ot-hoja">
        <div className="ot-cabecera">
          <img
            src="/logo-emsa.png"
            alt="Logo EMSA"
            className="ot-cabecera-logo"
          />
          <div className="ot-cabecera-titulo">
            REPORTE ACTIVIDADES MANTENIMIENTO
            <small>ORDEN DE TRABAJO (OT)</small>
          </div>
          <div className="ot-cabecera-metadata">
            <div>
              <span>Código</span>
              <strong>FO-GD-MS-23</strong>
            </div>
            <div>
              <span>Versión</span>
              <strong>04</strong>
            </div>
            <div>
              <span>Fecha</span>
              <strong>2024-07-12</strong>
            </div>
          </div>
        </div>

        {/* DATOS OT */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Datos OT</div>
          <div className="ot-grid ot-grid-4">
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Fecha emisión OT</span>
              <input
                type="date"
                className="ot-campo-input"
                value={ot.fechaEmision}
                onChange={(e) =>
                  actualizarCampo("fechaEmision", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">N° OT</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.numeroOT}
                onChange={(e) => actualizarCampo("numeroOT", e.target.value)}
                placeholder="xxxxxx"
              />
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Tipo OT</span>
              <input
                type="text"
                className="ot-campo-input"
                list="lista-tipos-ot"
                value={ot.tipoOT}
                onChange={(e) => actualizarCampo("tipoOT", e.target.value)}
              />
              <datalist id="lista-tipos-ot">
                {TIPOS_OT.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Actividad</span>
              <input
                type="text"
                className="ot-campo-input"
                list="lista-actividades-ot"
                value={ot.actividad}
                onChange={(e) => actualizarCampo("actividad", e.target.value)}
              />
              <datalist id="lista-actividades-ot">
                {ACTIVIDADES_OT.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="ot-grid ot-grid-1">
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Descripción OT</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.descripcionOT}
                onChange={(e) =>
                  actualizarCampo("descripcionOT", e.target.value)
                }
              />
            </div>
          </div>

          <div className="ot-grid ot-grid-1">
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Tipo de MTTO</span>
              <input
                type="text"
                className="ot-campo-input"
                list="lista-tipos-mtto"
                value={ot.tipoMTTO}
                onChange={(e) => actualizarCampo("tipoMTTO", e.target.value)}
              />
              <datalist id="lista-tipos-mtto">
                {TIPOS_MTTO.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="ot-grid ot-grid-1">
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Equipo(s) a intervenir</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.equiposIntervenir}
                onChange={(e) =>
                  actualizarCampo("equiposIntervenir", e.target.value)
                }
              />
            </div>
          </div>

          <div className="ot-grid ot-grid-3">
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Ubicación Geográfica</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.ubicacionGeografica}
                onChange={(e) =>
                  actualizarCampo("ubicacionGeografica", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Inicio Actividad</span>
              <input
                type="date"
                className="ot-campo-input"
                value={ot.inicioActividadFecha}
                onChange={(e) =>
                  actualizarCampo("inicioActividadFecha", e.target.value)
                }
              />
              <input
                type="time"
                className="ot-campo-input"
                value={ot.inicioActividadHora}
                onChange={(e) =>
                  actualizarCampo("inicioActividadHora", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Fin Actividad</span>
              <input
                type="date"
                className="ot-campo-input"
                value={ot.finActividadFecha}
                onChange={(e) =>
                  actualizarCampo("finActividadFecha", e.target.value)
                }
              />
              <input
                type="time"
                className="ot-campo-input"
                value={ot.finActividadHora}
                onChange={(e) =>
                  actualizarCampo("finActividadHora", e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* PLANEACIÓN */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Planeación de Actividades</div>
          <div className="ot-grid ot-grid-3">
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Planeador</span>
              <input
                type="text"
                className="ot-campo-input"
                list="lista-planeadores"
                value={ot.planeador}
                onChange={(e) => actualizarCampo("planeador", e.target.value)}
              />
              <datalist id="lista-planeadores">
                {PLANEADORES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Cuadrilla(s)</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.cuadrillas}
                onChange={(e) => actualizarCampo("cuadrillas", e.target.value)}
              />
            </div>
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Fecha Planeada</span>
              <input
                type="date"
                className="ot-campo-input"
                value={ot.fechaPlaneada}
                onChange={(e) =>
                  actualizarCampo("fechaPlaneada", e.target.value)
                }
              />
            </div>
          </div>
          <div className="ot-grid ot-grid-3">
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Documentación</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.documentacion}
                onChange={(e) =>
                  actualizarCampo("documentacion", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Hrs. Estimadas</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.horasEstimadas}
                onChange={(e) =>
                  actualizarCampo("horasEstimadas", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Fecha Creada</span>
              <input
                type="date"
                className="ot-campo-input"
                value={ot.fechaCreada}
                onChange={(e) => actualizarCampo("fechaCreada", e.target.value)}
              />
            </div>
          </div>
          <div className="ot-grid ot-grid-2">
            <div className="ot-campo-ot">
              <span className="ot-campo-label">N° Cuadrilla(s)</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.nCuadrillas}
                onChange={(e) => actualizarCampo("nCuadrillas", e.target.value)}
              />
            </div>
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Equipo</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.equipo}
                onChange={(e) => actualizarCampo("equipo", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* PERSONAL */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Personal</div>
          <div className="ot-grid-personal">
            <table className="ot-tabla-interna ot-tabla-personal">
              <thead>
                <tr>
                  <th style={{ width: "65%" }}>Personal</th>
                  <th style={{ width: "35%" }}>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ingeniero(s)</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ot-input-num"
                      value={ot.cantIngenieros}
                      onChange={(e) =>
                        actualizarCampo("cantIngenieros", e.target.value)
                      }
                    />
                  </td>
                </tr>
                <tr>
                  <td>Asistente(s) EMSA / Cuadrillero(s)</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ot-input-num"
                      value={ot.cantAsistentes}
                      onChange={(e) =>
                        actualizarCampo("cantAsistentes", e.target.value)
                      }
                    />
                  </td>
                </tr>
                <tr>
                  <td>Técnico(s) Electricista(s)</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ot-input-num"
                      value={ot.cantTecnicos}
                      onChange={(e) =>
                        actualizarCampo("cantTecnicos", e.target.value)
                      }
                    />
                  </td>
                </tr>
                <tr>
                  <td>Auxiliar(es) MTTO</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ot-input-num"
                      value={ot.cantAuxiliares}
                      onChange={(e) =>
                        actualizarCampo("cantAuxiliares", e.target.value)
                      }
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="ot-tabla-interna ot-tabla-personal">
              <tbody>
                <tr>
                  <td style={{ width: "50%", fontWeight: 700 }}>
                    ORDEN SAP #:
                  </td>
                  <td>
                    <input
                      type="text"
                      value={ot.ordenSAP}
                      onChange={(e) =>
                        actualizarCampo("ordenSAP", e.target.value)
                      }
                    />
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Memorando / Formato #:</td>
                  <td>
                    <input
                      type="text"
                      value={ot.memorandoFormato}
                      onChange={(e) =>
                        actualizarCampo("memorandoFormato", e.target.value)
                      }
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* DESCRIPCIÓN ACTIVIDADES + DIAGRAMA */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Descripción de Actividades</div>
          <div className="ot-grid-actividades">
            <div className="ot-bloque-actividades">
              <span className="ot-bloque-etiqueta">
                DESCRIPCIÓN DE ACTIVIDADES:
              </span>
              <textarea
                className="ot-textarea ot-textarea-grande"
                rows="3"
                style={{ minHeight: "55px", height: "55px" }}
                value={ot.descripcionActividades}
                onChange={(e) =>
                  actualizarCampo("descripcionActividades", e.target.value)
                }
                placeholder="Describa las actividades a realizar..."
              />
            </div>
            <div className="ot-bloque-diagrama">
              <span className="ot-bloque-etiqueta">DIAGRAMA UNIFILAR</span>
              <div
                className="ot-foto-zona"
                onClick={() =>
                  document.getElementById("input-diagrama-unifilar")?.click()
                }
                style={{ minHeight: "55px", height: "55px" }}
              >
                {ot.diagramaUnifilar ? (
                  <>
                    <img
                      src={ot.diagramaUnifilar}
                      alt="Diagrama unifilar"
                      className="ot-foto-zona-imagen"
                    />
                    <span className="ot-foto-zona-texto">
                      Clic para cambiar
                    </span>
                  </>
                ) : (
                  <>
                    <span className="ot-foto-zona-icono">📷</span>
                    <span className="ot-foto-zona-texto">
                      Anexar fotografía
                    </span>
                  </>
                )}
                <input
                  id="input-diagrama-unifilar"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    manejarFoto("diagrama", 0, e.target.files?.[0])
                  }
                />
              </div>
              {ot.diagramaUnifilar && (
                <button
                  type="button"
                  className="ot-btn-mini"
                  onClick={() => eliminarFoto("diagrama")}
                >
                  Eliminar foto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* EJECUCIÓN */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Ejecución de Actividades</div>
          <table className="ot-tabla-interna">
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Descripción</th>
                <th style={{ width: "9%" }}>Inicio</th>
                <th style={{ width: "9%" }}>Fin</th>
                <th style={{ width: "22%" }}>Descripción</th>
                <th style={{ width: "9%" }}>Inicio</th>
                <th style={{ width: "9%" }}>Fin</th>
                <th style={{ width: "10%" }}>Total desplaz.</th>
                <th style={{ width: "10%" }}>Total trabajo</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((num) => {
                const clave = `dia${num}`;
                const d = ot.ejecucion[clave];
                const calc = calcularDia(clave);
                return (
                  <tr key={clave}>
                    <td>
                      <div className="ot-celda-dia">
                        <strong>Día {num}</strong>
                        <small>Inicio desplazamiento</small>
                      </div>
                    </td>
                    <td>
                      <input
                        type="time"
                        className="ot-input-hora"
                        value={d.iniDesp1}
                        onChange={(e) =>
                          actualizarEjecucion(clave, "iniDesp1", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="ot-input-hora"
                        value={d.finDesp1}
                        onChange={(e) =>
                          actualizarEjecucion(clave, "finDesp1", e.target.value)
                        }
                      />
                    </td>
                    <td>Fin desplazamiento</td>
                    <td colSpan="2"></td>
                    <td className="ot-celda-total" rowSpan="3">
                      {formatearHoras(calc.totalDesplazamiento)}
                    </td>
                    <td className="ot-celda-total" rowSpan="3">
                      {formatearHoras(calc.totalTrabajo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {[1, 2, 3].map((num) => {
            const clave = `dia${num}`;
            const d = ot.ejecucion[clave];
            const calc = calcularDia(clave);
            return (
              <table
                key={clave}
                className="ot-tabla-interna ot-tabla-dia-detalle"
              >
                <tbody>
                  <tr>
                    <td style={{ width: "30%" }}>
                      <strong>Día {num}</strong> · Inicio actividad
                    </td>
                    <td style={{ width: "15%" }}>
                      <input
                        type="time"
                        className="ot-input-hora"
                        value={d.iniAct1}
                        onChange={(e) =>
                          actualizarEjecucion(clave, "iniAct1", e.target.value)
                        }
                      />
                    </td>
                    <td style={{ width: "15%" }}>
                      <input
                        type="time"
                        className="ot-input-hora"
                        value={d.finAct1}
                        onChange={(e) =>
                          actualizarEjecucion(clave, "finAct1", e.target.value)
                        }
                      />
                    </td>
                    <td style={{ width: "20%" }}>Fin actividad</td>
                    <td style={{ width: "10%" }}>
                      <span className="ot-celda-total-inline">
                        {formatearHoras(calc.totalTrabajo)} h
                      </span>
                    </td>
                    <td style={{ width: "10%" }}></td>
                  </tr>
                  <tr>
                    <td>Inicio desplazamiento (regreso)</td>
                    <td>
                      <input
                        type="time"
                        className="ot-input-hora"
                        value={d.iniDesp2}
                        onChange={(e) =>
                          actualizarEjecucion(clave, "iniDesp2", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="ot-input-hora"
                        value={d.finDesp2}
                        onChange={(e) =>
                          actualizarEjecucion(clave, "finDesp2", e.target.value)
                        }
                      />
                    </td>
                    <td>Fin desplazamiento</td>
                    <td>
                      <span className="ot-celda-total-inline">
                        {formatearHoras(calc.totalDesplazamiento)} h
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            );
          })}

          <table className="ot-tabla-interna ot-tabla-totales">
            <tbody>
              <tr>
                <td
                  style={{ width: "70%", textAlign: "right", fontWeight: 700 }}
                >
                  Total horas desplazamiento:
                </td>
                <td className="ot-celda-total">
                  {formatearHoras(totalHorasDesplazamiento)}
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  Total horas trabajo efectivo:
                </td>
                <td className="ot-celda-total">
                  {formatearHoras(totalHorasTrabajo)}
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  Total horas actividad (desplazamiento + trabajo):
                </td>
                <td className="ot-celda-total">
                  {formatearHoras(totalHorasDesplazamiento + totalHorasTrabajo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ACTIVIDADES PRELIMINARES */}
        <div className="ot-seccion">
          <table className="ot-tabla-interna ot-tabla-preliminares">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Actividades preliminares</th>
                <th style={{ width: "15%" }}>Tiempo (Horas)</th>
                <th style={{ width: "55%" }}>
                  Descripción de actividades realizadas
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["charlaSeguridad", "CHARLA SEGURIDAD"],
                ["admonDocumentacion", "ADMÓN DOCUMENTACIÓN"],
                ["esperaMateriales", "ESPERA DE MATERIALES"],
                ["esperaHerramienta", "ESPERA DE HERRAMIENTA"],
                ["__desplazamiento", "DESPLAZAMIENTO"],
                ["esperaPermiso", "ESPERA PERMISO DE TRABAJO"],
                ["aislamiento", "AISLAM / DES-AISLAM"],
              ].map(([campo, etiqueta]) => (
                <tr key={campo}>
                  <td>{etiqueta}</td>
                  <td>
                    {campo === "__desplazamiento" ? (
                      <span className="ot-celda-total-inline">
                        {formatearHoras(totalHorasDesplazamiento)}
                      </span>
                    ) : (
                      <input
                        type="text"
                        className="ot-input-hora"
                        placeholder="00:00"
                        value={ot.preliminares[campo]}
                        onChange={(e) =>
                          actualizarPreliminar(campo, e.target.value)
                        }
                      />
                    )}
                  </td>
                  {campo === "charlaSeguridad" && (
                    <td rowSpan={13} className="ot-celda-descripcion">
                      <div className="ot-celda-descripcion-wrapper">
                        <textarea
                          className="ot-textarea-inline"
                          value={ot.descripcionActividadesRealizadas}
                          onChange={(e) =>
                            actualizarCampo(
                              "descripcionActividadesRealizadas",
                              e.target.value,
                            )
                          }
                          placeholder="Describa las actividades realizadas..."
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              <tr className="ot-fila-subtitulo">
                <td colSpan="2">
                  <strong>TIEMPO EFECTIVO MTTO</strong>
                </td>
              </tr>

              {[
                ["cambioCondiciones", "CAMBIO DE CONDICIONES"],
                ["climatologia", "CLIMATOLOGÍA ADVERSA"],
                ["ordenPublico", "ORDEN PÚBLICO"],
              ].map(([campo, etiqueta]) => (
                <tr key={campo}>
                  <td>{etiqueta}</td>
                  <td>
                    <input
                      type="text"
                      className="ot-input-hora"
                      placeholder="00:00"
                      value={ot.preliminares[campo]}
                      onChange={(e) =>
                        actualizarPreliminar(campo, e.target.value)
                      }
                    />
                  </td>
                </tr>
              ))}

              <tr>
                <td>
                  <strong>TIEMPO EJECUCIÓN OT</strong>
                </td>
                <td className="ot-celda-total">
                  {formatearHoras(totalHorasTrabajo)}
                </td>
              </tr>
              <tr>
                <td>
                  <strong>TOTAL DURACIÓN TRABAJO</strong>
                </td>
                <td className="ot-celda-total">
                  {formatearHoras(totalPreliminares + totalHorasTrabajo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PERSONAL EJECUTOR */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Personal Ejecutor OT</div>
          <table className="ot-tabla-interna">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Nombre</th>
                <th style={{ width: "20%" }}>Cargo</th>
                <th style={{ width: "14%" }}>Empresa</th>
                <th style={{ width: "14%" }}>Cédula</th>
                <th style={{ width: "19%" }}>Firma</th>
                <th style={{ width: "5%" }}></th>
              </tr>
            </thead>
            <tbody>
              {ot.personalEjecutor.map((p, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="text"
                      value={p.nombre}
                      onChange={(e) =>
                        actualizarPersonalEjecutor(i, "nombre", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={p.cargo}
                      onChange={(e) =>
                        actualizarPersonalEjecutor(i, "cargo", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      list="lista-empresas"
                      value={p.empresa}
                      onChange={(e) =>
                        actualizarPersonalEjecutor(i, "empresa", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={p.cedula}
                      onChange={(e) =>
                        actualizarPersonalEjecutor(i, "cedula", e.target.value)
                      }
                    />
                  </td>
                  <td className="ot-celda-firma">
                    <div
                      className="ot-firma-personal-zona"
                      onClick={() =>
                        document
                          .getElementById(`input-firma-personal-${i}`)
                          ?.click()
                      }
                    >
                      {p.firma ? (
                        <img
                          src={p.firma}
                          alt={`Firma ${p.nombre || i + 1}`}
                          className="ot-firma-personal-imagen"
                        />
                      ) : (
                        <span className="ot-firma-personal-texto">
                          Anexar firma
                        </span>
                      )}
                      <input
                        id={`input-firma-personal-${i}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          manejarFirmaPersonal(i, e.target.files?.[0])
                        }
                      />
                    </div>
                    {p.firma && (
                      <button
                        type="button"
                        className="ot-btn-mini"
                        onClick={() => eliminarFirmaPersonal(i)}
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ot-btn-eliminar"
                      onClick={() => eliminarPersonalEjecutor(i)}
                      title="Eliminar fila"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="lista-empresas">
            {EMPRESAS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <button
            type="button"
            className="ot-btn-agregar-fila"
            onClick={agregarPersonalEjecutor}
          >
            + Agregar persona
          </button>
        </div>

        {/* MATERIALES */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">
            Materiales y Equipos Utilizados
          </div>
          <table className="ot-tabla-interna">
            <thead>
              <tr>
                <th style={{ width: "55%" }}>Descripción</th>
                <th style={{ width: "15%" }}>Cantidad</th>
                <th style={{ width: "25%" }}>SAP / Memorando / Otro</th>
                <th style={{ width: "5%" }}></th>
              </tr>
            </thead>
            <tbody>
              {ot.materiales.map((m, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="text"
                      value={m.descripcion}
                      onChange={(e) =>
                        actualizarMaterial(i, "descripcion", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="ot-input-num"
                      value={m.cantidad}
                      onChange={(e) =>
                        actualizarMaterial(i, "cantidad", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={m.referencia}
                      onChange={(e) =>
                        actualizarMaterial(i, "referencia", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ot-btn-eliminar"
                      onClick={() => eliminarMaterial(i)}
                      title="Eliminar fila"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="ot-btn-agregar-fila"
            onClick={agregarMaterial}
          >
            + Agregar material
          </button>
        </div>

        {/* DOCUMENTOS SOPORTE */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Documentos Soporte OT</div>
          <div className="ot-grid ot-grid-2">
            <div className="ot-campo-ot">
              <span className="ot-campo-label">Número de Informe</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.numeroInforme}
                onChange={(e) =>
                  actualizarCampo("numeroInforme", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Informe recibido por</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.informeRecibidoPor}
                onChange={(e) =>
                  actualizarCampo("informeRecibidoPor", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot">
              <span className="ot-campo-label">
                Fecha aprobación del informe
              </span>
              <input
                type="date"
                className="ot-campo-input"
                value={ot.fechaAprobacionInforme}
                onChange={(e) =>
                  actualizarCampo("fechaAprobacionInforme", e.target.value)
                }
              />
            </div>
            <div className="ot-campo-ot ot-campo-sin-borde-derecho">
              <span className="ot-campo-label">Informe aprobado por</span>
              <input
                type="text"
                className="ot-campo-input"
                value={ot.informeAprobadoPor}
                onChange={(e) =>
                  actualizarCampo("informeAprobadoPor", e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* CIERRE */}
        <div className="ot-seccion">
          <div className="ot-seccion-titulo">Cierre OT</div>
          <div className="ot-cierre-grid">
            <div className="ot-cierre-bloque">
              <div className="ot-foto-zona ot-foto-cierre">
                {ot.firmaAutorizacion ? (
                  <img
                    src={ot.firmaAutorizacion}
                    alt="Firma autorización ejecución OT"
                    className="ot-foto-zona-imagen"
                  />
                ) : (
                  <>
                    <span className="ot-foto-zona-icono">✍️</span>
                    <span className="ot-foto-zona-texto">
                      Firma autorización
                    </span>
                  </>
                )}
              </div>
              <div className="ot-firma-linea"></div>
              <span className="ot-firma-label">
                Firma autorización ejecución OT
              </span>
              <input
                type="date"
                className="ot-campo-input"
                style={{ textAlign: "center", fontSize: 8 }}
                value={ot.fechaAutorizacion}
                onChange={(e) =>
                  actualizarCampo("fechaAutorizacion", e.target.value)
                }
              />
              <span className="ot-firma-sub">Fecha Autorización OT</span>
            </div>

            <div className="ot-cierre-bloque">
              <div
                className="ot-foto-zona ot-foto-cierre"
                onClick={() =>
                  document.getElementById("input-foto-cierre-1")?.click()
                }
              >
                {ot.fotosCierre[1] ? (
                  <>
                    <img
                      src={ot.fotosCierre[1]}
                      alt="Foto cierre 2"
                      className="ot-foto-zona-imagen"
                    />
                    <span className="ot-foto-zona-texto">
                      Clic para cambiar
                    </span>
                  </>
                ) : (
                  <>
                    <span className="ot-foto-zona-icono">📷</span>
                    <span className="ot-foto-zona-texto">Anexar foto</span>
                  </>
                )}
                <input
                  id="input-foto-cierre-1"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    manejarFoto("cierre", 1, e.target.files?.[0])
                  }
                />
              </div>
              {ot.fotosCierre[1] && (
                <button
                  type="button"
                  className="ot-btn-mini"
                  onClick={() => eliminarFoto("cierre", 1)}
                >
                  Eliminar foto
                </button>
              )}
              <div className="ot-firma-linea"></div>
              <span className="ot-firma-label">Ejecutado por</span>
              <div className="ot-tarea-100">
                <label>
                  <input
                    type="radio"
                    name="tarea100"
                    value="SI"
                    checked={ot.tarea100 === "SI"}
                    onChange={(e) =>
                      actualizarCampo("tarea100", e.target.value)
                    }
                  />{" "}
                  Tarea 100% SI
                </label>
                <label>
                  <input
                    type="radio"
                    name="tarea100"
                    value="NO"
                    checked={ot.tarea100 === "NO"}
                    onChange={(e) =>
                      actualizarCampo("tarea100", e.target.value)
                    }
                  />{" "}
                  NO
                </label>
                <input
                  type="text"
                  placeholder="%"
                  className="ot-campo-input ot-input-porcentaje"
                  value={ot.porcentajeTarea}
                  onChange={(e) =>
                    actualizarCampo("porcentajeTarea", e.target.value)
                  }
                  disabled={ot.tarea100 !== "NO"}
                />
              </div>
            </div>

            <div className="ot-cierre-bloque">
              <div className="ot-foto-zona ot-foto-cierre">
                {ot.firmaRecibidoPor ? (
                  <img
                    src={ot.firmaRecibidoPor}
                    alt="Firma recibido por"
                    className="ot-foto-zona-imagen"
                  />
                ) : (
                  <>
                    <span className="ot-foto-zona-icono">✍️</span>
                    <span className="ot-foto-zona-texto">
                      Firma recibido por
                    </span>
                  </>
                )}
              </div>
              <div className="ot-firma-linea"></div>
              <span className="ot-firma-label">Recibido por</span>
              <input
                type="datetime-local"
                className="ot-campo-input"
                style={{ textAlign: "center", fontSize: 8 }}
                value={ot.fechaCierre}
                onChange={(e) => actualizarCampo("fechaCierre", e.target.value)}
              />
              <span className="ot-firma-sub">Fecha Cierre OT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OT;
