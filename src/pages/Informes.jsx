import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useActividades } from "../context/ActividadesContext";
import { supabase } from "../lib/supabase";
import { cuadrillas } from "../data/cuadrillas";
import "./Informes.css";

const FILAS_ANOMALIAS_POR_HOJA = 6;
const ESPACIOS_FOTOGRAFICOS_POR_HOJA = 4;

const STORAGE_BUCKET = "sigpas-documentos";
const URL_EXPIRACION = 60 * 60 * 24; // 24 horas en segundos

const MESES = [
  "Todos",
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

const CAMPOS_METADATOS = [
  "id",
  "numeroInforme",
  "estado",
  "fechaCreacion",
  "fechaActualizacion",
  "actividadId",
  "numeroOrdenTrabajo",
  "fechaInicio",
  "fechaFin",
  "subestacion",
  "cuadrillaId",
  "actividadSnapshot",
];

function extraerMetadatos(informe) {
  const meta = {};
  CAMPOS_METADATOS.forEach((campo) => {
    if (informe[campo] !== undefined && informe[campo] !== null) {
      meta[campo] = informe[campo];
    }
  });
  return meta;
}

function quitarMarcadoresDeCursor(html) {
  return html.replace(/<span[^>]*data-caret-marker[^>]*><\/span>/gi, "");
}

function esNodoVacioDePagina(nodo) {
  if (nodo.nodeType === Node.TEXT_NODE) {
    return !nodo.textContent?.trim();
  }

  if (nodo.nodeType !== Node.ELEMENT_NODE) {
    return true;
  }

  return (
    !nodo.querySelector("img, table, [data-caret-marker]") &&
    !nodo.textContent?.trim()
  );
}

/* ============================================================
   UTILIDADES
   ============================================================ */

function insertarMarcadorDeCursor(editor) {
  const seleccion = window.getSelection();
  if (
    !editor ||
    !seleccion?.rangeCount ||
    !editor.contains(seleccion.anchorNode) ||
    !seleccion.isCollapsed
  ) {
    return false;
  }

  document
    .querySelectorAll(".descripcion-pagina-editor [data-caret-marker]")
    .forEach((marcador) => {
      marcador.remove();
    });

  const rango = seleccion.getRangeAt(0).cloneRange();
  rango.deleteContents();
  const marcador = document.createElement("span");
  marcador.dataset.caretMarker = "true";
  marcador.setAttribute("aria-hidden", "true");
  rango.insertNode(marcador);
  rango.setStartAfter(marcador);
  rango.collapse(true);
  seleccion.removeAllRanges();
  seleccion.addRange(rango);
  return true;
}

function restaurarCursorDesdeMarcador() {
  const marcador = document.querySelector("[data-caret-marker]");
  if (!marcador) return false;

  const rango = document.createRange();
  rango.setStartBefore(marcador);
  rango.collapse(true);
  const seleccion = window.getSelection();
  seleccion.removeAllRanges();
  seleccion.addRange(rango);
  const editor = marcador.closest(".descripcion-pagina-editor");
  if (editor) editor.focus();
  marcador.remove();
  return true;
}

function generarIdInforme() {
  return `INF-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

function generarIdFoto() {
  return `FOTO-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

function formatearFecha(fecha) {
  if (!fecha) {
    return "";
  }

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return "";
  }

  return fechaObj.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function obtenerAnio(fecha) {
  if (!fecha) {
    return new Date().getFullYear();
  }

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return new Date().getFullYear();
  }

  return fechaObj.getFullYear();
}

function obtenerMes(fecha) {
  if (!fecha) {
    return 0;
  }

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return 0;
  }

  return fechaObj.getMonth() + 1;
}

function obtenerNumeroSemanaISO(fecha) {
  const fechaUTC = new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
  );

  const diaSemana = fechaUTC.getUTCDay() || 7;

  fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - diaSemana);

  const inicioAnio = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));

  return Math.ceil(((fechaUTC - inicioAnio) / 86400000 + 1) / 7);
}

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

function obtenerSemanaInforme(informe) {
  if (!informe) return null;

  const fecha =
    informe.actividadSnapshot?.fecha ||
    informe.fechaInicio ||
    informe.fechaCreacion;

  return obtenerSemanaDeFecha(fecha);
}

function crearAnomaliasIniciales(cantidad = 1) {
  return Array.from({ length: cantidad }, () => ({
    numeroAnomalia: "",
    equipo: "",
    serie: "",
    numeroInventario: "",
    nt: "",
    observacion: "",
    estado: "",
    numeroFoto: "",
  }));
}

function crearEspaciosFotograficosIniciales(
  cantidad = ESPACIOS_FOTOGRAFICOS_POR_HOJA,
) {
  return Array.from({ length: cantidad }, () => ({
    src: "",
    descripcion: "",
  }));
}

function dividirEnBloques(items, tamano) {
  const bloques = [];

  for (let indice = 0; indice < items.length; indice += tamano) {
    bloques.push(items.slice(indice, indice + tamano));
  }

  return bloques.length ? bloques : [[]];
}

/* ============================================================
   PERSISTENCIA EN SUPABASE (tabla + storage)
   ============================================================ */

async function cargarInformesDesdeSupabase() {
  const { data, error } = await supabase
    .from("informes")
    .select("id, metadatos, fecha_creacion, fecha_actualizacion")
    .order("fecha_creacion", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((fila) => {
    const meta = fila.metadatos || {};
    return {
      ...meta,
      id: fila.id,
      fechaCreacion: meta.fechaCreacion || fila.fecha_creacion,
      fechaActualizacion: meta.fechaActualizacion || fila.fecha_actualizacion,
      __contenidoCargado: false,
    };
  });
}

async function subirJsonAStorage(informeId, contenido) {
  const path = `informes/${informeId}/datos.json`;

  const blob = new Blob([JSON.stringify(contenido, null, 2)], {
    type: "application/json",
  });

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, {
      contentType: "application/json",
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    throw error;
  }

  return path;
}

async function subirPdfAStorage(informeId, pdfBlob) {
  const path = `informes/${informeId}/informe.pdf`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    throw error;
  }

  return path;
}

async function descargarJsonDeStorage(informeId) {
  const path = `informes/${informeId}/datos.json`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(path);

  if (error) {
    throw error;
  }

  const texto = await data.text();
  return JSON.parse(texto);
}

async function obtenerUrlFirmada(path) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, URL_EXPIRACION);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

async function eliminarArchivosDeStorage(informeId) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([
      `informes/${informeId}/datos.json`,
      `informes/${informeId}/informe.pdf`,
    ]);

  if (error) {
    // No bloqueamos el borrado de la fila si algún archivo no existe.
    console.warn("No se pudieron eliminar todos los archivos:", error);
  }
}

async function persistirInformeEnSupabase(informe) {
  const metadatos = extraerMetadatos(informe);

  // 1. Subir JSON completo a Storage
  await subirJsonAStorage(informe.id, informe);

  // 2. Guardar metadatos en la tabla (datos queda null)
  const { error } = await supabase.from("informes").upsert(
    {
      id: informe.id,
      metadatos,
      datos: null,
      fecha_actualizacion: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

async function eliminarInformeEnSupabase(id) {
  // 1. Borrar archivos de Storage
  await eliminarArchivosDeStorage(id);

  // 2. Borrar fila de la tabla
  const { error } = await supabase.from("informes").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

/* ============================================================
   GENERAR PDF COMO BLOB (reutilizable)
   ============================================================ */

async function generarPdfBlob(contenedor) {
  await document.fonts?.ready;

  const imagenes = Array.from(contenedor.querySelectorAll("img"));
  await Promise.all(
    imagenes.map((imagen) =>
      imagen.complete
        ? Promise.resolve()
        : new Promise((resolver) => {
            imagen.addEventListener("load", resolver, { once: true });
            imagen.addEventListener("error", resolver, { once: true });
          }),
    ),
  );

  const hojas = Array.from(
    contenedor.querySelectorAll(
      ":scope > .informe-hoja, :scope > .informe-hoja-pagina",
    ),
  );

  if (!hojas.length) {
    throw new Error("El informe no contiene hojas para exportar.");
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
    compress: true,
  });

  const anchoPagina = 215.9;
  const altoPagina = 279.4;

  for (const [indice, hoja] of hojas.entries()) {
    const canvas = await html2canvas(hoja, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (documentoClonado) => {
        documentoClonado
          .querySelectorAll(
            ".btn-eliminar-foto, .btn-eliminar-imagen-editor, .registro-fotografico-cargar, .cargar-firma-digital",
          )
          .forEach((elemento) => {
            elemento.style.display = "none";
          });
      },
    });

    let lienzoFinal = canvas;
    if (canvas.width > canvas.height) {
      lienzoFinal = document.createElement("canvas");
      lienzoFinal.width = canvas.height;
      lienzoFinal.height = canvas.width;
      const contexto = lienzoFinal.getContext("2d");
      contexto.translate(lienzoFinal.width, 0);
      contexto.rotate(Math.PI / 2);
      contexto.drawImage(canvas, 0, 0);
    }

    const escala = Math.min(
      anchoPagina / lienzoFinal.width,
      altoPagina / lienzoFinal.height,
    );
    const anchoImagen = lienzoFinal.width * escala;
    const altoImagen = lienzoFinal.height * escala;

    if (indice > 0) {
      pdf.addPage("letter", "portrait");
    }
    pdf.addImage(
      lienzoFinal.toDataURL("image/png"),
      "PNG",
      (anchoPagina - anchoImagen) / 2,
      (altoPagina - altoImagen) / 2,
      anchoImagen,
      altoImagen,
      undefined,
      "FAST",
    );
  }

  return pdf.output("blob");
}

/* ============================================================
   CONVERTIR DESCRIPCIÓN ANTIGUA A HTML
   ============================================================ */

function convertirDescripcionAntiguaAHtml(texto) {
  if (!texto) {
    return "";
  }

  const textoSeguro = String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return textoSeguro
    .split(/\r?\n/)
    .map((linea) => `<div>${linea || "<br />"}</div>`)
    .join("");
}

function dividirDescripcionEnPaginas(
  html,
  primeraAltura = 330,
  otrasAlturas = 774,
  ancho = 650,
) {
  if (!html) return [""];

  const documento = new DOMParser().parseFromString(
    `<div>${html}</div>`,
    "text/html",
  );
  const nodos = Array.from(documento.body.firstElementChild?.childNodes || []);
  const host = document.createElement("div");
  host.className = "descripcion-editor descripcion-medicion";
  host.style.width = `${ancho}px`;
  host.style.position = "absolute";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.height = `${primeraAltura}px`;
  host.style.minHeight = "0";
  host.style.maxHeight = "none";
  host.style.boxSizing = "border-box";
  host.style.overflow = "hidden";
  document.body.appendChild(host);

  const paginas = [];
  let pagina = document.createElement("div");
  let altura = primeraAltura;
  const agregarPaginaActual = () => {
    while (pagina.lastChild && esNodoVacioDePagina(pagina.lastChild)) {
      pagina.lastChild.remove();
    }

    if (pagina.childNodes.length) {
      paginas.push(pagina.innerHTML);
    }
  };

  const medir = (nodo) => {
    host.innerHTML = pagina.innerHTML;
    const prueba = nodo.cloneNode(true);
    host.appendChild(prueba);
    const excede = host.scrollHeight > host.clientHeight + 1;
    host.removeChild(prueba);
    return excede;
  };

  nodos.forEach((nodo) => {
    if (!medir(nodo)) {
      pagina.appendChild(nodo.cloneNode(true));
      return;
    }

    if (pagina.childNodes.length) {
      agregarPaginaActual();
      pagina = document.createElement("div");
      altura = otrasAlturas;
      host.style.height = `${altura}px`;
    }

    if (!medir(nodo)) {
      pagina.appendChild(nodo.cloneNode(true));
      return;
    }

    const texto = nodo.textContent || "";
    if (texto && nodo.nodeType === Node.TEXT_NODE) {
      let parte = "";
      texto.split(/(\s+)/).forEach((palabra) => {
        host.innerHTML = pagina.innerHTML;
        const prueba = document.createTextNode(parte + palabra);
        host.appendChild(prueba);
        const cabe = host.scrollHeight <= altura + 1;
        host.removeChild(prueba);
        if (cabe) parte += palabra;
        else {
          if (parte) {
            pagina.appendChild(
              document.createTextNode(palabra.trim() ? parte : `${parte} `),
            );
          }
          agregarPaginaActual();
          pagina = document.createElement("div");
          altura = otrasAlturas;
          host.style.height = `${altura}px`;
          parte = palabra.trim() ? palabra : "";
        }
      });
      if (parte) pagina.appendChild(document.createTextNode(parte));
    } else if (
      nodo.nodeType === Node.ELEMENT_NODE &&
      texto &&
      !nodo.querySelector("img")
    ) {
      const palabras = texto.split(/(\s+)/);
      const marcador = nodo.querySelector("[data-caret-marker]");
      let bloque = nodo.cloneNode(false);
      let parte = "";
      palabras.forEach((palabra) => {
        const prueba = bloque.cloneNode(false);
        prueba.textContent = parte + palabra;
        host.innerHTML = pagina.innerHTML;
        host.appendChild(prueba);
        if (host.scrollHeight <= altura + 1) {
          parte += palabra;
        } else {
          if (parte) {
            bloque.textContent = palabra.trim() ? parte : `${parte} `;
          }
          if (parte) {
            pagina.appendChild(bloque);
          }
          agregarPaginaActual();
          pagina = document.createElement("div");
          altura = otrasAlturas;
          host.style.height = `${altura}px`;
          bloque = nodo.cloneNode(false);
          parte = palabra.trim() ? palabra : "";
        }
      });
      if (parte) {
        bloque.textContent = parte;
        if (marcador) bloque.appendChild(marcador.cloneNode(true));
        pagina.appendChild(bloque);
      }
    } else {
      pagina.appendChild(nodo.cloneNode(true));
    }
  });

  agregarPaginaActual();
  if (!paginas.length) {
    paginas.push(pagina.innerHTML);
  }
  host.remove();
  return paginas;
}

function obtenerAlturaDisponiblePrimeraDescripcion(editor) {
  const hoja = editor?.closest(".informe-hoja");
  const seccion = editor?.closest(".informe-descripcion-seccion");

  if (!hoja || !seccion) {
    return editor?.clientHeight || 330;
  }

  const estiloHoja = window.getComputedStyle(hoja);
  const hojaRect = hoja.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  const paddingInferior = parseFloat(estiloHoja.paddingBottom) || 0;
  const bordeInferior = parseFloat(estiloHoja.borderBottomWidth) || 0;
  const ayuda = seccion.querySelector(".descripcion-ayuda-editor");

  let contenidoPosterior = ayuda?.getBoundingClientRect().height || 0;
  let siguiente = seccion.nextElementSibling;

  while (siguiente) {
    const estilo = window.getComputedStyle(siguiente);
    contenidoPosterior +=
      siguiente.getBoundingClientRect().height +
      (parseFloat(estilo.marginTop) || 0) +
      (parseFloat(estilo.marginBottom) || 0);
    siguiente = siguiente.nextElementSibling;
  }

  const altura = Math.floor(
    hoja.clientHeight -
      paddingInferior -
      bordeInferior -
      (editorRect.top - hojaRect.top) -
      contenidoPosterior -
      1,
  );

  return Math.max(20, altura);
}

function ajustarAlturaPrimeraDescripcion(editor) {
  const altura = obtenerAlturaDisponiblePrimeraDescripcion(editor);
  editor.style.height = "auto";
  editor.style.minHeight = "";
  editor.style.maxHeight = "";
  return altura;
}

/* ============================================================
   INFORME INICIAL
   ============================================================ */

function crearInformeInicial(actividad = null) {
  const ahora = new Date().toISOString();

  return {
    id: generarIdInforme(),

    actividadId: actividad?.id ?? null,

    numeroInforme: "",

    estado: "Borrador",

    fechaCreacion: ahora,
    fechaActualizacion: ahora,

    contrato: "4500010069",

    electrificadora: "ELECTRIFICADORA DEL META S.A. E.S.P.",

    numeroOrdenTrabajo: actividad?.codigoOT ?? "",

    fechaInicio: actividad?.fecha ?? "",

    fechaFin: "",

    subestacion: actividad?.subestacion ?? "",

    reconectador: "",

    personalEjecutor: ["", "", ""],

    cedulas: ["", "", ""],

    elaboradoPor: "",

    revisadoPor: "",

    aprobadoPor: "",

    firmasDigitales: ["", "", ""],

    descripcionActividad: "",

    descripcionHtml: "",

    anomalias: crearAnomaliasIniciales(),

    anomaliasCorregidas: crearAnomaliasIniciales(),

    registroFotografico: crearEspaciosFotograficosIniciales(),

    comentariosObservaciones: "",
    anexos: "",
    equiposRecursos: "",
    tiemposActividad: [
      {
        subestacion: "",
        actividades: "",
        horaInicialDesplazamiento: "",
        horaInicialActividad: "",
        horaFinalActividad: "",
        horaFinalDesplazamiento: "",
      },
    ],

    fotosActividad: [],

    actividadSnapshot: actividad
      ? {
          id: actividad.id,
          codigoOT: actividad.codigoOT ?? "",
          fecha: actividad.fecha ?? "",
          nombre: actividad.nombre ?? "",
          tipo: actividad.tipo ?? "",
          subestacion: actividad.subestacion ?? "",
          zona: actividad.zona ?? "",
          cuadrillaId: actividad.cuadrillaId ?? "",
          responsable: actividad.responsable ?? "",
          camioneta: actividad.camioneta ?? "",
          mantenimiento: actividad.mantenimiento ?? "",
          nt: actividad.nt ?? "",
        }
      : null,
  };
}

/* ============================================================
   COMPONENTE
   ============================================================ */

function Informes() {
  const { actividades = [] } = useActividades();

  const [searchParams, setSearchParams] = useSearchParams();

  const actividadId = searchParams.get("actividadId");
  const informeId = searchParams.get("informeId");

  const [informes, setInformes] = useState([]);

  const [cargandoInformes, setCargandoInformes] = useState(true);

  const [informeActual, setInformeActual] = useState(null);

  const [cargandoInformeId, setCargandoInformeId] = useState(null);

  const [guardando, setGuardando] = useState(false);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [busqueda, setBusqueda] = useState("");

  const [filtroAnio, setFiltroAnio] = useState("Todos");

  const [filtroMes, setFiltroMes] = useState("Todos");

  const [filtroSemana, setFiltroSemana] = useState("Todos");

  const [filtroSubestacion, setFiltroSubestacion] = useState("Todas");

  const [filtroCuadrilla, setFiltroCuadrilla] = useState("Todas");

  const [informesSeleccionados, setInformesSeleccionados] = useState([]);

  const editorDescripcionRef = useRef(null);
  const documentoInformeRef = useRef(null);
  const paginasEditorRefs = useRef([]);
  const paginacionDescripcionTimerRef = useRef(null);

  const seleccionDescripcionRef = useRef(null);

  const imagenSeleccionadaRef = useRef(null);

  const ultimoInformeEditorRef = useRef(null);

  const descargaEnCursoRef = useRef(null);

  const [paginasDescripcion, setPaginasDescripcion] = useState([""]);

  const [imagenSeleccionada, setImagenSeleccionada] = useState(false);

  const [anchoImagen, setAnchoImagen] = useState(60);
  const [fotoRegistroSeleccionada, setFotoRegistroSeleccionada] =
    useState(null);

  /* ============================================================
     CARGA INICIAL DE INFORMES DESDE SUPABASE
     ============================================================ */

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const lista = await cargarInformesDesdeSupabase();
        if (!activo) return;
        setInformes(lista);
      } catch (error) {
        console.error("Error cargando informes desde Supabase:", error);
        if (activo) {
          window.alert(
            "No fue posible cargar los informes desde el servidor. Verifique su conexión.",
          );
        }
      } finally {
        if (activo) {
          setCargandoInformes(false);
        }
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  /* ============================================================
     AÑOS DISPONIBLES
     ============================================================ */

  const aniosDisponibles = useMemo(() => {
    const conjunto = new Set();

    informes.forEach((informe) => {
      const fecha = informe.fechaCreacion || informe.fechaInicio;

      if (fecha) {
        conjunto.add(obtenerAnio(fecha));
      }
    });

    actividades.forEach((actividad) => {
      if (actividad.fecha) {
        conjunto.add(obtenerAnio(actividad.fecha));
      }
    });

    const anios = Array.from(conjunto);

    if (anios.length === 0) {
      anios.push(new Date().getFullYear());
    }

    return anios.sort((a, b) => b - a);
  }, [informes, actividades]);

  /* ============================================================
     SEMANAS DISPONIBLES
     ============================================================ */

  const semanasDisponibles = useMemo(() => {
    const conjunto = new Set();

    informes.forEach((informe) => {
      const semana = obtenerSemanaInforme(informe);

      if (semana != null) {
        conjunto.add(semana);
      }
    });

    return Array.from(conjunto).sort((a, b) => a - b);
  }, [informes]);

  /* ============================================================
     SUBESTACIONES DISPONIBLES
     ============================================================ */

  const subestacionesDisponibles = useMemo(() => {
    const conjunto = new Set();

    informes.forEach((informe) => {
      if (informe.subestacion) {
        conjunto.add(informe.subestacion);
      }
    });

    actividades.forEach((actividad) => {
      if (actividad.subestacion) {
        conjunto.add(actividad.subestacion);
      }
    });

    return Array.from(conjunto).sort((a, b) => a.localeCompare(b));
  }, [informes, actividades]);

  /* ============================================================
     CARGAR INFORME DESDE URL
     ============================================================ */

  useEffect(() => {
    if (cargandoInformes) {
      return undefined;
    }

    let cancelado = false;

    const ejecutar = async () => {
      if (informeId) {
        // Ya está cargado en memoria
        if (
          informeActual?.id === informeId &&
          informeActual.__contenidoCargado
        ) {
          setMostrarFormulario(true);
          return;
        }

        // Evitar descargas paralelas del mismo id
        if (descargaEnCursoRef.current === informeId) {
          return;
        }

        const encontrado = informes.find((informe) => informe.id === informeId);

        if (encontrado) {
          descargaEnCursoRef.current = informeId;
          setCargandoInformeId(informeId);

          try {
            const contenidoCompleto = await descargarJsonDeStorage(
              encontrado.id,
            );

            if (cancelado) return;

            const fusionado = {
              ...contenidoCompleto,
              __contenidoCargado: true,
            };

            setInformeActual(fusionado);
            setMostrarFormulario(true);
          } catch (error) {
            console.error("Error descargando informe:", error);
            if (!cancelado) {
              window.alert(
                "No fue posible abrir el informe. Verifique su conexión.",
              );
              setSearchParams({});
            }
          } finally {
            descargaEnCursoRef.current = null;
            if (!cancelado) setCargandoInformeId(null);
          }
          return;
        }
      }

      if (actividadId) {
        const actividad = actividades.find(
          (item) => String(item.id) === String(actividadId),
        );

        if (actividad) {
          const informeExistente = informes.find(
            (informe) => String(informe.actividadId) === String(actividadId),
          );

          if (informeExistente) {
            if (descargaEnCursoRef.current === informeExistente.id) {
              return;
            }

            descargaEnCursoRef.current = informeExistente.id;
            setCargandoInformeId(informeExistente.id);

            try {
              const contenidoCompleto = await descargarJsonDeStorage(
                informeExistente.id,
              );

              if (cancelado) return;

              const fusionado = {
                ...contenidoCompleto,
                __contenidoCargado: true,
              };

              setInformeActual(fusionado);
              setMostrarFormulario(true);
            } catch (error) {
              console.error("Error descargando informe existente:", error);
              if (!cancelado) {
                window.alert(
                  "No fue posible abrir el informe. Verifique su conexión.",
                );
              }
            } finally {
              descargaEnCursoRef.current = null;
              if (!cancelado) setCargandoInformeId(null);
            }
            return;
          }

          const nuevo = crearInformeInicial(actividad);
          setInformeActual(nuevo);
          setMostrarFormulario(true);
          setSearchParams({ informeId: nuevo.id });
          return;
        }
      }

      if (!informeId && !actividadId) {
        if (window.location.search) {
          return;
        }

        setMostrarFormulario(false);
        setInformeActual(null);
      }
    };

    ejecutar();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    informeId,
    actividadId,
    actividades,
    informes,
    informeActual?.id,
    informeActual?.__contenidoCargado,
    setSearchParams,
    cargandoInformes,
  ]);

  /* ============================================================
     INICIALIZAR EDITOR DE DESCRIPCIÓN
     ============================================================ */

  useEffect(() => {
    if (!mostrarFormulario || !informeActual || !editorDescripcionRef.current) {
      return;
    }

    const claveEditor = informeActual.id;
    if (ultimoInformeEditorRef.current === claveEditor) {
      return;
    }

    let contenido = informeActual.descripcionHtml || "";

    if (!contenido && informeActual.descripcionActividad) {
      contenido = convertirDescripcionAntiguaAHtml(
        informeActual.descripcionActividad,
      );
    }

    window.requestAnimationFrame(() => {
      const editor = editorDescripcionRef.current;
      if (editor) {
        const alturaPrimera = ajustarAlturaPrimeraDescripcion(editor);
        setPaginasDescripcion(
          dividirDescripcionEnPaginas(
            contenido,
            alturaPrimera,
            774,
            editor.clientWidth || 650,
          ),
        );
      }
    });

    ultimoInformeEditorRef.current = claveEditor;

    setImagenSeleccionada(false);
    imagenSeleccionadaRef.current = null;
  }, [mostrarFormulario, informeActual]);

  useEffect(
    () => () => {
      if (paginacionDescripcionTimerRef.current) {
        window.clearTimeout(paginacionDescripcionTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    paginasEditorRefs.current.length = paginasDescripcion.length;

    paginasDescripcion.forEach((contenido, indice) => {
      const editor = paginasEditorRefs.current[indice];

      if (editor && editor.innerHTML !== contenido) {
        editor.innerHTML = contenido;
      }
    });
  }, [paginasDescripcion]);

  /* ============================================================
     FILTRAR INFORMES
     ============================================================ */

  const informesFiltrados = useMemo(() => {
    return informes.filter((informe) => {
      const actividad = informe.actividadSnapshot || {};

      const textoBusqueda = busqueda.trim().toLowerCase();

      const coincideBusqueda =
        !textoBusqueda ||
        String(informe.numeroInforme || "")
          .toLowerCase()
          .includes(textoBusqueda) ||
        String(informe.id || "")
          .toLowerCase()
          .includes(textoBusqueda) ||
        String(actividad.codigoOT || "")
          .toLowerCase()
          .includes(textoBusqueda) ||
        String(informe.subestacion || "")
          .toLowerCase()
          .includes(textoBusqueda);

      const anioInforme = obtenerAnio(
        informe.fechaCreacion || informe.fechaInicio,
      );

      const coincideAnio =
        filtroAnio === "Todos" || String(anioInforme) === String(filtroAnio);

      const mesInforme = obtenerMes(
        informe.fechaCreacion || informe.fechaInicio,
      );

      const coincideMes =
        filtroMes === "Todos" || mesInforme === Number(filtroMes);

      const semanaInforme = obtenerSemanaInforme(informe);

      const coincideSemana =
        filtroSemana === "Todos" ||
        String(semanaInforme ?? "") === String(filtroSemana);

      const coincideSubestacion =
        filtroSubestacion === "Todas" ||
        informe.subestacion === filtroSubestacion;

      const cuadrillaId = informe.cuadrillaId || actividad.cuadrillaId || "";
      const coincideCuadrilla =
        filtroCuadrilla === "Todas" || cuadrillaId === filtroCuadrilla;

      return (
        coincideBusqueda &&
        coincideAnio &&
        coincideMes &&
        coincideSemana &&
        coincideSubestacion &&
        coincideCuadrilla
      );
    });
  }, [
    informes,
    busqueda,
    filtroAnio,
    filtroMes,
    filtroSemana,
    filtroSubestacion,
    filtroCuadrilla,
  ]);

  /* ============================================================
     ACTUALIZAR CAMPO
     ============================================================ */

  function actualizarCampo(campo, valor) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      return {
        ...actual,
        [campo]: valor,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function actualizarPersonal(indice, valor) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      const personalActual = [...(actual.personalEjecutor || ["", "", ""])];

      personalActual[indice] = valor;

      return {
        ...actual,
        personalEjecutor: personalActual,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function actualizarCedula(indice, valor) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      const cedulasActuales = [...(actual.cedulas || ["", "", ""])];

      cedulasActuales[indice] = valor;

      return {
        ...actual,
        cedulas: cedulasActuales,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function actualizarFirmaDigital(indice, event) {
    const archivo = Array.from(event.target.files || [])[0];
    if (!archivo || !archivo.type.startsWith("image/")) return;
    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result !== "string") return;
      setInformeActual((actual) => {
        if (!actual) return actual;
        const firmas = [...(actual.firmasDigitales || ["", "", ""])];
        firmas[indice] = lector.result;
        return {
          ...actual,
          firmasDigitales: firmas,
          fechaActualizacion: new Date().toISOString(),
        };
      });
    };
    lector.readAsDataURL(archivo);
    event.target.value = "";
  }

  function eliminarFirmaDigital(indice) {
    setInformeActual((actual) => {
      if (!actual) return actual;
      const firmas = [...(actual.firmasDigitales || ["", "", ""])];
      firmas[indice] = "";
      return {
        ...actual,
        firmasDigitales: firmas,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function actualizarCampoTiempo(indice, campo, valor) {
    setInformeActual((actual) => {
      if (!actual) return actual;
      const tiempos = [...(actual.tiemposActividad || [])];
      tiempos[indice] = { ...tiempos[indice], [campo]: valor };
      return {
        ...actual,
        tiemposActividad: tiempos,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function actualizarAnomalia(
    indice,
    campo,
    valor,
    nombreColeccion = "anomalias",
  ) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      const anomaliasActuales = (
        actual[nombreColeccion]?.length
          ? actual[nombreColeccion]
          : crearAnomaliasIniciales()
      ).map((anomalia) => ({
        equipo: "",
        serie: "",
        numeroInventario: "",
        observacion: "",
        estado: "",
        ...anomalia,
      }));

      anomaliasActuales[indice] = {
        ...anomaliasActuales[indice],
        [campo]: valor,
      };

      return {
        ...actual,
        [nombreColeccion]: anomaliasActuales,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function agregarFilaAnomalia(nombreColeccion = "anomalias") {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      return {
        ...actual,
        [nombreColeccion]: [
          ...(actual[nombreColeccion]?.length
            ? actual[nombreColeccion]
            : crearAnomaliasIniciales()),
          ...crearAnomaliasIniciales(),
        ],
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function eliminarFilaAnomalia(indice, nombreColeccion) {
    setInformeActual((actual) => {
      if (!actual || (actual[nombreColeccion]?.length || 0) <= 1) {
        return actual;
      }

      return {
        ...actual,
        [nombreColeccion]: actual[nombreColeccion].filter(
          (_, posicion) => posicion !== indice,
        ),
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function ajustarAlturaAnomalia(event) {
    const campo = event.currentTarget;
    campo.style.height = "auto";
    campo.style.height = `${campo.scrollHeight}px`;
  }

  function actualizarDescripcionFotografica(indice, valor) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      const registro = actual.registroFotografico?.length
        ? [...actual.registroFotografico]
        : crearEspaciosFotograficosIniciales();

      registro[indice] = {
        ...registro[indice],
        descripcion: valor,
      };

      return {
        ...actual,
        registroFotografico: registro,
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function agregarPaginaFotografica() {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      return {
        ...actual,
        registroFotografico: [
          ...(actual.registroFotografico?.length
            ? actual.registroFotografico
            : crearEspaciosFotograficosIniciales()),
          ...crearEspaciosFotograficosIniciales(),
        ],
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  function cargarImagenFotografica(indice, event) {
    const archivo = Array.from(event.target.files || [])[0];

    if (!archivo || !archivo.type.startsWith("image/")) {
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      const src = lector.result;

      if (typeof src !== "string") {
        return;
      }

      setInformeActual((actual) => {
        if (!actual) {
          return actual;
        }

        const registro = actual.registroFotografico?.length
          ? [...actual.registroFotografico]
          : crearEspaciosFotograficosIniciales();

        registro[indice] = {
          ...registro[indice],
          src,
        };

        return {
          ...actual,
          registroFotografico: registro,
          fechaActualizacion: new Date().toISOString(),
        };
      });
    };
    lector.readAsDataURL(archivo);
    event.target.value = "";
  }

  function eliminarImagenFotografica(indice) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      const registro = actual.registroFotografico?.length
        ? [...actual.registroFotografico]
        : crearEspaciosFotograficosIniciales();

      registro[indice] = {
        ...registro[indice],
        src: "",
      };

      return {
        ...actual,
        registroFotografico: registro,
        fechaActualizacion: new Date().toISOString(),
      };
    });
    setFotoRegistroSeleccionada(null);
  }

  function eliminarPaginaFotografica() {
    setInformeActual((actual) => {
      if (!actual || (actual.registroFotografico?.length || 0) <= 4) {
        return actual;
      }

      return {
        ...actual,
        registroFotografico: actual.registroFotografico.slice(0, -4),
        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  /* ============================================================
     GUARDAR POSICIÓN DEL CURSOR
     ============================================================ */

  function guardarSeleccionDescripcion(event) {
    const editor = event?.currentTarget?.classList?.contains(
      "descripcion-pagina-editor",
    )
      ? event.currentTarget
      : editorDescripcionRef.current;

    if (!editor) {
      return;
    }
    editorDescripcionRef.current = editor;

    const seleccion = window.getSelection();

    if (!seleccion || seleccion.rangeCount === 0) {
      return;
    }

    const rango = seleccion.getRangeAt(0);

    if (editor.contains(rango.commonAncestorContainer)) {
      seleccionDescripcionRef.current = rango.cloneRange();
    }
  }

  function restaurarSeleccionDescripcion() {
    const editor = editorDescripcionRef.current;

    const rangoGuardado = seleccionDescripcionRef.current;

    if (!editor || !rangoGuardado) {
      return false;
    }

    try {
      const seleccion = window.getSelection();

      editor.focus();
      seleccion.removeAllRanges();
      seleccion.addRange(rangoGuardado);

      return true;
    } catch (error) {
      console.warn("No fue posible restaurar la posición del cursor:", error);

      return false;
    }
  }

  function obtenerHtmlDePaginas() {
    const editores = paginasEditorRefs.current
      .slice(0, paginasDescripcion.length)
      .filter(Boolean);

    return editores
      .map((editor, indice) => {
        const siguiente = editores[indice + 1];
        const textoActual = editor.innerText || "";
        const textoSiguiente = siguiente?.innerText || "";
        const necesitaSeparador =
          siguiente &&
          textoActual &&
          textoSiguiente &&
          !/\s$/.test(textoActual) &&
          !/^\s/.test(textoSiguiente);

        return `${editor.innerHTML}${necesitaSeparador ? " " : ""}`;
      })
      .join("");
  }

  function restaurarPosicionGlobal(posicion) {
    if (posicion == null) return;
    let restante = posicion;
    for (const pagina of paginasEditorRefs.current.slice(
      0,
      paginasDescripcion.length,
    )) {
      if (!pagina) continue;
      const walker = document.createTreeWalker(pagina, NodeFilter.SHOW_TEXT);
      let nodo;
      while ((nodo = walker.nextNode())) {
        if (restante <= nodo.nodeValue.length) {
          const rango = document.createRange();
          rango.setStart(nodo, restante);
          rango.collapse(true);
          const seleccion = window.getSelection();
          seleccion.removeAllRanges();
          seleccion.addRange(rango);
          pagina.focus();
          return;
        }
        restante -= nodo.nodeValue.length;
      }
      if (!pagina.textContent && restante === 0) {
        pagina.focus();
        return;
      }
    }
    const ultima = paginasEditorRefs.current
      .slice(0, paginasDescripcion.length)
      .filter(Boolean)
      .pop();
    if (ultima) {
      ultima.focus();
      const rango = document.createRange();
      rango.selectNodeContents(ultima);
      rango.collapse(false);
      const seleccion = window.getSelection();
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }
  }

  function actualizarDescripcionDesdeEditor(
    editorOrigen = editorDescripcionRef.current,
  ) {
    if (!editorOrigen) {
      return;
    }

    const tieneMarcador = insertarMarcadorDeCursor(editorOrigen);
    const htmlConMarcador = obtenerHtmlDePaginas();
    const html = quitarMarcadoresDeCursor(htmlConMarcador);
    const texto = paginasEditorRefs.current
      .slice(0, paginasDescripcion.length)
      .filter(Boolean)
      .map((editor) => editor.innerText || "")
      .join(" ");
    const alturaPrimera = ajustarAlturaPrimeraDescripcion(
      paginasEditorRefs.current[0] || editorOrigen,
    );
    const paginas = dividirDescripcionEnPaginas(
      htmlConMarcador,
      alturaPrimera,
      774,
      editorOrigen.clientWidth || 650,
    );

    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      return {
        ...actual,

        descripcionHtml: html,

        descripcionActividad: texto,

        fechaActualizacion: new Date().toISOString(),
      };
    });

    setPaginasDescripcion(paginas);
    window.requestAnimationFrame(() => {
      if (!tieneMarcador || !restaurarCursorDesdeMarcador()) {
        restaurarPosicionGlobal(null);
      }
    });
  }

  function manejarInputDescripcion(event) {
    editorDescripcionRef.current = event.currentTarget;
    actualizarDescripcionDesdeEditor(event.currentTarget);
  }

  function manejarKeyUpDescripcion() {
    guardarSeleccionDescripcion();
  }

  function seleccionEstaAlInicio(editor) {
    const seleccion = window.getSelection();

    if (!seleccion?.rangeCount || !seleccion.isCollapsed) {
      return false;
    }

    const rango = seleccion.getRangeAt(0);
    const previo = rango.cloneRange();
    previo.selectNodeContents(editor);
    previo.setEnd(rango.startContainer, rango.startOffset);
    return previo.toString().length === 0;
  }

  function seleccionEstaAlFinal(editor) {
    const seleccion = window.getSelection();

    if (!seleccion?.rangeCount || !seleccion.isCollapsed) {
      return false;
    }

    const rango = seleccion.getRangeAt(0);
    const posterior = rango.cloneRange();
    posterior.selectNodeContents(editor);
    posterior.setStart(rango.endContainer, rango.endOffset);
    return posterior.toString().length === 0;
  }

  function moverCursorAlFinal(editor) {
    editor.focus();
    const rango = document.createRange();
    rango.selectNodeContents(editor);
    rango.collapse(false);
    const seleccion = window.getSelection();
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
  }

  function manejarKeyDownDescripcion(event) {
    const editor = event.currentTarget;
    const indicePagina = paginasEditorRefs.current.indexOf(editor);

    if (
      event.key === "Backspace" &&
      indicePagina > 0 &&
      seleccionEstaAlInicio(editor)
    ) {
      event.preventDefault();
      const paginaAnterior = paginasEditorRefs.current[indicePagina - 1];

      if (paginaAnterior) {
        moverCursorAlFinal(paginaAnterior);
        document.execCommand("delete", false);
        actualizarDescripcionDesdeEditor(paginaAnterior);
      }

      return;
    }

    if (
      event.key === "Delete" &&
      indicePagina >= 0 &&
      indicePagina < paginasDescripcion.length - 1 &&
      seleccionEstaAlFinal(editor)
    ) {
      event.preventDefault();
      const paginaSiguiente = paginasEditorRefs.current[indicePagina + 1];

      if (paginaSiguiente) {
        paginaSiguiente.focus();
        const seleccion = window.getSelection();
        const rango = document.createRange();
        rango.selectNodeContents(paginaSiguiente);
        rango.collapse(true);
        seleccion.removeAllRanges();
        seleccion.addRange(rango);
        document.execCommand("forwardDelete", false);
        actualizarDescripcionDesdeEditor(paginaSiguiente);
      }

      return;
    }

    if (event.key === "Enter") {
      editorDescripcionRef.current = editor;
      return;
    }

    if (event.key !== "Delete") {
      return;
    }

    event.preventDefault();
    editorDescripcionRef.current = editor;

    const eliminado = document.execCommand("forwardDelete", false);

    if (!eliminado) {
      const seleccion = window.getSelection();

      if (seleccion?.rangeCount) {
        const rango = seleccion.getRangeAt(0);
        rango.deleteContents();
        rango.collapse(true);
      }
    }

    actualizarDescripcionDesdeEditor(editor);
  }

  function ejecutarFormatoDescripcion(comando, valor = null) {
    const editor = editorDescripcionRef.current;
    const seleccionRestaurada = restaurarSeleccionDescripcion();
    const posicionScroll = {
      x: window.scrollX,
      y: window.scrollY,
    };

    if (
      !editor ||
      !seleccionRestaurada ||
      !window.getSelection()?.rangeCount ||
      window.getSelection().isCollapsed
    ) {
      return;
    }

    editor.focus();
    document.execCommand(comando, false, valor);
    actualizarDescripcionDesdeEditor();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo(posicionScroll.x, posicionScroll.y);
      });
    });
  }

  function insertarTablaDescripcion() {
    const filas = Number.parseInt(
      window.prompt("¿Cuántas filas desea crear?", "2") || "",
      10,
    );
    const columnas = Number.parseInt(
      window.prompt("¿Cuántas columnas desea crear?", "2") || "",
      10,
    );

    if (
      !Number.isInteger(filas) ||
      !Number.isInteger(columnas) ||
      filas < 1 ||
      columnas < 1 ||
      filas > 20 ||
      columnas > 10
    ) {
      return;
    }

    const celdas = Array.from(
      { length: filas },
      () =>
        `<tr>${Array.from({ length: columnas }, () => "<td>&nbsp;</td>").join(
          "",
        )}</tr>`,
    ).join("");

    restaurarSeleccionDescripcion();
    document.execCommand(
      "insertHTML",
      false,
      `<table class="tabla-descripcion"><tbody>${celdas}</tbody></table><p><br></p>`,
    );
    actualizarDescripcionDesdeEditor();
  }

  function manejarClickDescripcion(event) {
    editorDescripcionRef.current = event.currentTarget;
    const objetivo = event.target;

    if (
      objetivo instanceof HTMLImageElement &&
      objetivo.dataset.sigpasImage === "true"
    ) {
      event.preventDefault();

      imagenSeleccionadaRef.current = objetivo;

      const anchoActual =
        parseFloat(objetivo.style.width) || objetivo.width || 60;

      setAnchoImagen(Math.min(100, Math.max(10, Number(anchoActual))));

      setImagenSeleccionada(true);

      const editor = editorDescripcionRef.current;

      if (editor) {
        editor.focus();
      }

      return;
    }

    setImagenSeleccionada(false);
    imagenSeleccionadaRef.current = null;

    guardarSeleccionDescripcion();
  }

  function insertarFotografias(event) {
    const archivos = Array.from(event.target.files || []);

    if (archivos.length === 0) {
      return;
    }

    const editor = editorDescripcionRef.current;

    if (!editor) {
      return;
    }

    guardarSeleccionDescripcion();

    archivos.forEach((archivo) => {
      if (!archivo.type.startsWith("image/")) {
        return;
      }

      const lector = new FileReader();

      lector.onload = () => {
        const src = lector.result;

        if (!src) {
          return;
        }

        editor.focus();

        const seleccionRestaurada = restaurarSeleccionDescripcion();

        let rango;

        if (seleccionRestaurada) {
          const seleccion = window.getSelection();

          if (seleccion && seleccion.rangeCount > 0) {
            rango = seleccion.getRangeAt(0);
          }
        }

        if (!rango) {
          rango = document.createRange();
          rango.selectNodeContents(editor);
          rango.collapse(false);
        }

        const nodoContenedor = rango.commonAncestorContainer;

        const imagenDentro =
          nodoContenedor.nodeType === Node.ELEMENT_NODE
            ? nodoContenedor.closest?.('img[data-sigpas-image="true"]')
            : nodoContenedor.parentElement?.closest?.(
                'img[data-sigpas-image="true"]',
              );

        if (imagenDentro) {
          rango.setStartAfter(imagenDentro);
          rango.collapse(true);
        }

        const imagen = document.createElement("img");

        imagen.src = src;
        imagen.alt = archivo.name || "Fotografía de actividad";

        imagen.dataset.sigpasImage = "true";
        imagen.dataset.fotoId = generarIdFoto();

        imagen.style.width = "60%";
        imagen.style.height = "auto";
        imagen.style.display = "block";
        imagen.style.margin = "10px auto";
        imagen.style.maxWidth = "100%";

        const salto = document.createElement("div");

        salto.innerHTML = "<br />";

        rango.deleteContents();
        rango.insertNode(imagen);

        const nuevoRango = document.createRange();

        nuevoRango.setStartAfter(imagen);
        nuevoRango.collapse(true);

        seleccionDescripcionRef.current = nuevoRango.cloneRange();

        const seleccion = window.getSelection();

        seleccion.removeAllRanges();
        seleccion.addRange(nuevoRango);

        actualizarDescripcionDesdeEditor();

        setImagenSeleccionada(false);
        imagenSeleccionadaRef.current = null;
      };

      lector.readAsDataURL(archivo);
    });

    event.target.value = "";
  }

  function cambiarTamanoImagen(valor) {
    const imagen = imagenSeleccionadaRef.current;

    if (!imagen) {
      return;
    }

    const nuevoAncho = Number(valor);

    if (Number.isNaN(nuevoAncho) || nuevoAncho < 10 || nuevoAncho > 100) {
      return;
    }

    imagen.style.width = `${nuevoAncho}%`;
    imagen.style.height = "auto";

    setAnchoImagen(nuevoAncho);

    const editor = editorDescripcionRef.current;

    if (editor) {
      const html = obtenerHtmlDePaginas();
      const texto = paginasEditorRefs.current
        .filter(Boolean)
        .map((pagina) => pagina.innerText || "")
        .join("");
      setInformeActual((actual) => {
        if (!actual) {
          return actual;
        }

        return {
          ...actual,
          descripcionHtml: html,
          descripcionActividad: texto,
          fechaActualizacion: new Date().toISOString(),
        };
      });
    }
  }

  function eliminarImagenSeleccionada() {
    const imagen = imagenSeleccionadaRef.current;

    if (!imagen) {
      return;
    }

    const confirmar = window.confirm(
      "¿Desea eliminar la fotografía seleccionada?",
    );

    if (!confirmar) {
      return;
    }

    imagen.remove();

    imagenSeleccionadaRef.current = null;

    setImagenSeleccionada(false);

    actualizarDescripcionDesdeEditor();
  }

  function agregarFotografias(event) {
    insertarFotografias(event);
  }

  function eliminarFotografia(indice) {
    setInformeActual((actual) => {
      if (!actual) {
        return actual;
      }

      return {
        ...actual,

        fotosActividad: (actual.fotosActividad || []).filter(
          (_, posicion) => posicion !== indice,
        ),

        fechaActualizacion: new Date().toISOString(),
      };
    });
  }

  /* ============================================================
     NUEVO INFORME
     ============================================================ */

  function nuevoInforme() {
    const nuevo = crearInformeInicial();

    ultimoInformeEditorRef.current = null;

    setInformeActual(nuevo);
    setMostrarFormulario(true);

    setSearchParams({
      informeId: nuevo.id,
    });
  }

  /* ============================================================
     ABRIR INFORME
     ============================================================ */

  async function abrirInforme(informe) {
    ultimoInformeEditorRef.current = null;
    editorDescripcionRef.current = null;
    seleccionDescripcionRef.current = null;

    if (informe.__contenidoCargado) {
      setInformeActual(informe);
      setMostrarFormulario(true);
      setSearchParams({ informeId: informe.id });
      return;
    }

    if (descargaEnCursoRef.current === informe.id) {
      return;
    }

    descargaEnCursoRef.current = informe.id;
    setCargandoInformeId(informe.id);

    try {
      const contenidoCompleto = await descargarJsonDeStorage(informe.id);

      const fusionado = {
        ...contenidoCompleto,
        __contenidoCargado: true,
      };

      setInformeActual(fusionado);
      setMostrarFormulario(true);
      setSearchParams({ informeId: informe.id });
    } catch (error) {
      console.error("Error abriendo informe:", error);
      window.alert("No fue posible abrir el informe. Intente nuevamente.");
    } finally {
      descargaEnCursoRef.current = null;
      setCargandoInformeId(null);
    }
  }

  /* ============================================================
     GUARDAR INFORME
     ============================================================ */

  async function guardarInforme() {
    if (!informeActual || guardando) {
      return;
    }

    let descripcionHtml = informeActual.descripcionHtml || "";

    let descripcionActividad = informeActual.descripcionActividad || "";

    if (paginasEditorRefs.current.some(Boolean)) {
      descripcionHtml = obtenerHtmlDePaginas();
      descripcionActividad = paginasEditorRefs.current
        .filter(Boolean)
        .map((pagina) => pagina.innerText || "")
        .join("");
    }

    const actualizado = {
      ...informeActual,

      descripcionActividad,

      descripcionHtml,

      fotosActividad: informeActual.fotosActividad || [],

      anomalias: informeActual.anomalias?.length
        ? informeActual.anomalias
        : crearAnomaliasIniciales(),

      anomaliasCorregidas: informeActual.anomaliasCorregidas?.length
        ? informeActual.anomaliasCorregidas
        : crearAnomaliasIniciales(),

      registroFotografico: informeActual.registroFotografico?.length
        ? informeActual.registroFotografico
        : crearEspaciosFotograficosIniciales(),

      firmasDigitales: informeActual.firmasDigitales || ["", "", ""],
      comentariosObservaciones: informeActual.comentariosObservaciones || "",
      anexos: informeActual.anexos || "",
      equiposRecursos: informeActual.equiposRecursos || "",
      tiemposActividad: informeActual.tiemposActividad?.length
        ? informeActual.tiemposActividad
        : [
            {
              subestacion: "",
              actividades: "",
              horaInicialDesplazamiento: "",
              horaInicialActividad: "",
              horaFinalActividad: "",
              horaFinalDesplazamiento: "",
            },
          ],

      fechaActualizacion: new Date().toISOString(),
    };

    setGuardando(true);

    try {
      // 1. Persistir JSON + metadatos en Supabase
      await persistirInformeEnSupabase(actualizado);

      // 2. Generar y subir PDF (Opción B: si falla, no bloqueamos)
      let pdfSubido = false;
      try {
        if (documentoInformeRef.current) {
          // Damos un tick para que el DOM refleje los últimos cambios
          await new Promise((resolver) => window.setTimeout(resolver, 50));

          const pdfBlob = await generarPdfBlob(documentoInformeRef.current);
          await subirPdfAStorage(actualizado.id, pdfBlob);
          pdfSubido = true;
        }
      } catch (errorPdf) {
        console.warn("No se pudo generar/subir el PDF:", errorPdf);
      }

      // 3. Actualizar estado local
      const metadatos = extraerMetadatos(actualizado);
      const informeLista = { ...metadatos, __contenidoCargado: true };

      const existe = informes.some((informe) => informe.id === actualizado.id);

      const nuevosInformes = existe
        ? informes.map((informe) =>
            informe.id === actualizado.id ? informeLista : informe,
          )
        : [...informes, informeLista];

      setInformes(nuevosInformes);
      setInformeActual({ ...actualizado, __contenidoCargado: true });

      if (pdfSubido) {
        alert("Informe guardado correctamente.");
      } else {
        alert(
          "Informe guardado correctamente. Nota: el PDF no se pudo generar en este momento, se generará cuando lo descargue.",
        );
      }
    } catch (error) {
      console.error("Error guardando informe:", error);
      alert(
        "No fue posible guardar el informe. Verifique su conexión e intente nuevamente.",
      );
    } finally {
      setGuardando(false);
    }
  }

  /* ============================================================
     ELIMINAR INFORME
     ============================================================ */

  async function eliminarInforme(id) {
    const confirmar = window.confirm("¿Está seguro de eliminar este informe?");

    if (!confirmar) {
      return;
    }

    try {
      await eliminarInformeEnSupabase(id);

      const nuevosInformes = informes.filter((informe) => informe.id !== id);

      setInformes(nuevosInformes);
      setInformesSeleccionados((seleccionados) =>
        seleccionados.filter((seleccionado) => seleccionado !== id),
      );
    } catch (error) {
      console.error("Error eliminando informe:", error);
      window.alert("No fue posible eliminar el informe. Intente nuevamente.");
    }
  }

  function alternarInformeSeleccionado(id) {
    setInformesSeleccionados((seleccionados) =>
      seleccionados.includes(id)
        ? seleccionados.filter((seleccionado) => seleccionado !== id)
        : [...seleccionados, id],
    );
  }

  function alternarTodosLosInformesVisibles() {
    const idsVisibles = informesFiltrados.map((informe) => informe.id);
    const todosSeleccionados = idsVisibles.every((id) =>
      informesSeleccionados.includes(id),
    );
    setInformesSeleccionados((seleccionados) =>
      todosSeleccionados
        ? seleccionados.filter((id) => !idsVisibles.includes(id))
        : Array.from(new Set([...seleccionados, ...idsVisibles])),
    );
  }

  /* ============================================================
     DESCARGAR PDFs DE STORAGE
     ============================================================ */

  async function descargarInformesSeleccionados() {
    const seleccionados = informes.filter((informe) =>
      informesSeleccionados.includes(informe.id),
    );

    if (!seleccionados.length) {
      return;
    }

    let descargados = 0;
    let fallidos = 0;

    for (const informe of seleccionados) {
      try {
        const path = `informes/${informe.id}/informe.pdf`;
        const url = await obtenerUrlFirmada(path);

        const nombre = (informe.numeroInforme || informe.id || "informe")
          .replace(/[^\w-]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `${nombre || "informe"}.pdf`;
        enlace.target = "_blank";
        enlace.rel = "noopener noreferrer";
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        descargados += 1;

        // Pequeña pausa entre descargas para no saturar el navegador
        await new Promise((resolver) => window.setTimeout(resolver, 300));
      } catch (error) {
        console.warn(
          `No se pudo descargar el PDF del informe ${informe.id}:`,
          error,
        );
        fallidos += 1;
      }
    }

    if (fallidos > 0) {
      window.alert(
        `Se descargaron ${descargados} PDF(s). ${fallidos} no pudieron descargarse porque no tienen PDF guardado (abra el informe y guárdelo para generarlo).`,
      );
    }
  }

  /* ============================================================
     LIMPIAR FILTROS
     ============================================================ */

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroAnio("Todos");
    setFiltroMes("Todos");
    setFiltroSemana("Todos");
    setFiltroSubestacion("Todas");
    setFiltroCuadrilla("Todas");
  }

  /* ============================================================
     VOLVER A LISTA
     ============================================================ */

  function volverALista() {
    setMostrarFormulario(false);
    setInformeActual(null);
    ultimoInformeEditorRef.current = null;
    imagenSeleccionadaRef.current = null;
    setImagenSeleccionada(false);
    setSearchParams({});
  }

  /* ============================================================
     RENDER — EDITOR
     ============================================================ */

  if (mostrarFormulario && informeActual) {
    const descripcionTieneContenido = Boolean(
      informeActual.descripcionHtml || informeActual.descripcionActividad,
    );
    const anomalias = informeActual.anomalias?.length
      ? informeActual.anomalias
      : crearAnomaliasIniciales();
    const anomaliasCorregidas = informeActual.anomaliasCorregidas?.length
      ? informeActual.anomaliasCorregidas
      : crearAnomaliasIniciales();
    const reportesAnomalias = [
      {
        nombreColeccion: "anomalias",
        titulo: "REPORTE DE ANOMALÍAS Y RETIE IDENTIFICADAS",
        filas: anomalias,
        columnas: [
          ["equipo", "Equipo"],
          ["serie", "Serie"],
          ["numeroInventario", "N° inventario"],
          ["observacion", "Observación"],
          ["estado", "Estado"],
        ],
      },
      {
        nombreColeccion: "anomaliasCorregidas",
        titulo: "REPORTE DE ANOMALÍAS Y RETIE CORREGIDAS",
        filas: anomaliasCorregidas,
        columnas: [
          ["numeroAnomalia", "N° anomalías"],
          ["equipo", "Equipo"],
          ["nt", "NT"],
          ["observacion", "Observación"],
          ["numeroFoto", "N° de foto"],
        ],
      },
    ];
    const bloquesAnomalias = reportesAnomalias.flatMap((reporte) =>
      dividirEnBloques(reporte.filas, FILAS_ANOMALIAS_POR_HOJA).map(
        (bloque, indiceBloque) => ({ ...reporte, bloque, indiceBloque }),
      ),
    );
    const totalPaginasInforme =
      paginasDescripcion.length +
      bloquesAnomalias.length +
      Math.ceil(
        (informeActual.registroFotografico?.length ||
          ESPACIOS_FOTOGRAFICOS_POR_HOJA) / ESPACIOS_FOTOGRAFICOS_POR_HOJA,
      ) +
      1;
    const registroFotografico = informeActual.registroFotografico?.length
      ? informeActual.registroFotografico
      : crearEspaciosFotograficosIniciales();
    const paginasFotograficas = dividirEnBloques(
      registroFotografico,
      ESPACIOS_FOTOGRAFICOS_POR_HOJA,
    );
    return (
      <div className="informes-editor">
        <div className="informes-editor-barra">
          <button
            type="button"
            className="btn-editor-volver"
            onClick={volverALista}
          >
            ← Volver
          </button>

          <div className="informes-editor-titulo">
            <span>INFORME</span>

            <strong>{informeActual.numeroInforme || "Nuevo informe"}</strong>
          </div>

          <button
            type="button"
            className="btn-editor-guardar"
            onClick={guardarInforme}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>

          <div className="descripcion-herramientas descripcion-herramientas-fija">
            <div className="descripcion-herramientas-info">
              <span className="descripcion-herramientas-icono">✎</span>
              <span>Herramientas de edición</span>
            </div>

            <button
              type="button"
              className="btn-herramienta-editor"
              onMouseDown={(event) => {
                event.preventDefault();
                guardarSeleccionDescripcion();
              }}
              onClick={() => ejecutarFormatoDescripcion("bold")}
              title="Aplicar negrita"
              aria-label="Aplicar negrita"
            >
              <strong>B</strong>
            </button>

            <label
              className="btn-herramienta-editor"
              onMouseDown={() => guardarSeleccionDescripcion()}
              title="Insertar fotografía"
            >
              📷
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={agregarFotografias}
              />
            </label>

            <button
              type="button"
              className="btn-herramienta-editor"
              onMouseDown={(event) => event.preventDefault()}
              onClick={insertarTablaDescripcion}
              title="Añadir tabla"
              aria-label="Añadir tabla"
            >
              ▦
            </button>

            <button
              type="button"
              className="btn-herramienta-editor"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => ejecutarFormatoDescripcion("insertUnorderedList")}
              title="Añadir viñeta"
              aria-label="Añadir viñeta"
            >
              •
            </button>

            {imagenSeleccionada && (
              <div className="herramientas-imagen">
                <span>Tamaño:</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={anchoImagen}
                  onChange={(event) => cambiarTamanoImagen(event.target.value)}
                />
                <span className="valor-tamano">{Math.round(anchoImagen)}%</span>
                <button
                  type="button"
                  className="btn-eliminar-imagen-editor"
                  onClick={eliminarImagenSeleccionada}
                >
                  Eliminar imagen
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="informe-documento-contenedor"
          ref={(elemento) => {
            documentoInformeRef.current = elemento;
          }}
        >
          <div className="informe-hoja">
            <table className="informe-encabezado">
              <tbody>
                <tr>
                  <td rowSpan="4" className="encabezado-logo">
                    <img src="/logo-emsa.png" alt="EMSA" />
                  </td>

                  <td className="encabezado-label">CÓDIGO:</td>

                  <td className="encabezado-valor">EMSA-MTO-IF-01</td>
                </tr>

                <tr>
                  <td className="encabezado-label">VERSIÓN:</td>

                  <td className="encabezado-valor">01</td>
                </tr>

                <tr>
                  <td className="encabezado-label">FECHA:</td>

                  <td className="encabezado-valor">
                    {formatearFecha(informeActual.fechaCreacion)}
                  </td>
                </tr>

                <tr>
                  <td colSpan="2" className="encabezado-pagina">
                    PÁGINA 1 DE {totalPaginasInforme}
                  </td>
                </tr>

                <tr>
                  <td className="encabezado-titulo-izquierdo">
                    INFORME REPORTE DE
                    <br />
                    MANTENIMIENTO DIARIO
                  </td>

                  <td colSpan="2" className="encabezado-titulo-derecho">
                    MANTENIMIENTO DEL
                    <br />
                    SISTEMA ELÉCTRICO
                  </td>
                </tr>
              </tbody>
            </table>

            <section className="informe-primera-seccion">
              <div className="fila-completa">
                <div className="celda-contrato">
                  CONTRATO DE MANTENIMIENTO DE SUBESTACIONES DEL META
                  NO.4500010069
                </div>
              </div>

              <div className="fila-completa">
                <div className="celda-electrificadora">
                  ELECTRIFICADORA DEL META S.A. E.S.P.
                </div>
              </div>

              <div className="fila-cuatro-columnas">
                <div className="celda-label">NO DE INFORME</div>

                <div className="celda-input">
                  <input
                    type="text"
                    value={informeActual.numeroInforme || ""}
                    onChange={(e) =>
                      actualizarCampo("numeroInforme", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>

                <div className="celda-label">FECHA INICIO</div>

                <div className="celda-input">
                  <input
                    type="date"
                    value={informeActual.fechaInicio || ""}
                    onChange={(e) =>
                      actualizarCampo("fechaInicio", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="fila-cuatro-columnas">
                <div className="celda-label celda-label-doble">
                  NO DE ORDEN DE
                  <br />
                  TRABAJO
                </div>

                <div className="celda-input">
                  <input
                    type="text"
                    value={informeActual.numeroOrdenTrabajo || ""}
                    onChange={(e) =>
                      actualizarCampo("numeroOrdenTrabajo", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>

                <div className="celda-label celda-label-doble">
                  FECHA
                  <br />
                  FIN
                </div>

                <div className="celda-input">
                  <input
                    type="date"
                    value={informeActual.fechaFin || ""}
                    onChange={(e) =>
                      actualizarCampo("fechaFin", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="fila-cuatro-columnas">
                <div className="celda-label">SUBESTACIÓN:</div>

                <div className="celda-input">
                  <input
                    type="text"
                    value={informeActual.subestacion || ""}
                    onChange={(e) =>
                      actualizarCampo("subestacion", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>

                <div className="celda-label">RECONECTADOR</div>

                <div className="celda-input">
                  <input
                    type="text"
                    value={informeActual.reconectador || ""}
                    onChange={(e) =>
                      actualizarCampo("reconectador", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>
              </div>

              <div className="fila-personal">
                <div className="celda-personal-titulo">
                  PERSONAL
                  <br />
                  EJECUTOR
                </div>

                <div className="celda-personal-lista">
                  {[0, 1, 2].map((indice) => (
                    <div className="personal-linea" key={indice}>
                      <span>{indice + 1}.</span>

                      <input
                        type="text"
                        value={informeActual.personalEjecutor?.[indice] || ""}
                        onChange={(e) =>
                          actualizarPersonal(indice, e.target.value)
                        }
                        placeholder=" "
                      />
                    </div>
                  ))}
                </div>

                <div className="celda-cedula-titulo">CEDULA</div>

                <div className="celda-cedula-lista">
                  {[0, 1, 2].map((indice) => (
                    <div className="personal-linea" key={indice}>
                      <span>{indice + 1}.</span>

                      <input
                        type="text"
                        value={informeActual.cedulas?.[indice] || ""}
                        onChange={(e) =>
                          actualizarCedula(indice, e.target.value)
                        }
                        placeholder=" "
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="fila-firmas-nombres">
                <div className="bloque-firma-nombre">
                  <div className="firma-nombre-titulo">Elaborado por:</div>

                  <input
                    type="text"
                    value={informeActual.elaboradoPor || ""}
                    onChange={(e) =>
                      actualizarCampo("elaboradoPor", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>

                <div className="bloque-firma-nombre">
                  <div className="firma-nombre-titulo">
                    Revisado por: Tec sop
                  </div>

                  <input
                    type="text"
                    value={informeActual.revisadoPor || ""}
                    onChange={(e) =>
                      actualizarCampo("revisadoPor", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>

                <div className="bloque-firma-nombre">
                  <div className="firma-nombre-titulo">
                    Aprobado Por: Ing. Coordinador
                  </div>

                  <input
                    type="text"
                    value={informeActual.aprobadoPor || ""}
                    onChange={(e) =>
                      actualizarCampo("aprobadoPor", e.target.value)
                    }
                    placeholder=" "
                  />
                </div>
              </div>

              <div className="fila-firmas">
                {["firma", "firma", "FIRMA"].map((etiqueta, indice) => (
                  <div className="espacio-firma" key={etiqueta + indice}>
                    {informeActual.firmasDigitales?.[indice] ? (
                      <img
                        src={informeActual.firmasDigitales[indice]}
                        alt={`Firma digital ${indice + 1}`}
                        tabIndex="0"
                        onKeyDown={(event) => {
                          if (event.key === "Delete" || event.key === "Supr") {
                            event.preventDefault();
                            eliminarFirmaDigital(indice);
                          }
                        }}
                      />
                    ) : (
                      <label className="cargar-firma-digital">
                        {etiqueta}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            actualizarFirmaDigital(indice, event)
                          }
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="informe-descripcion-seccion">
              <div className="descripcion-titulo">DESCRIPCIÓN DE ACTIVIDAD</div>

              <div
                ref={(elemento) => {
                  paginasEditorRefs.current[0] = elemento;
                  if (elemento && !editorDescripcionRef.current) {
                    editorDescripcionRef.current = elemento;
                  }
                }}
                className="descripcion-editor descripcion-pagina-editor"
                contentEditable
                suppressContentEditableWarning
                spellCheck
                data-placeholder={
                  descripcionTieneContenido
                    ? ""
                    : "Detalle aquí todas las actividades realizadas..."
                }
                onFocus={(event) => {
                  editorDescripcionRef.current = event.currentTarget;
                }}
                onInput={manejarInputDescripcion}
                onKeyDown={manejarKeyDownDescripcion}
                onKeyUp={manejarKeyUpDescripcion}
                onMouseUp={guardarSeleccionDescripcion}
                onClick={manejarClickDescripcion}
              ></div>

              <div className="descripcion-ayuda-editor">
                <span>
                  Puede escribir texto, insertar fotografías en la posición del
                  cursor y continuar escribiendo debajo de cada imagen.
                </span>

                <span>Para cambiar el tamaño, seleccione una fotografía.</span>
              </div>
            </section>

            {informeActual.fotosActividad?.length > 0 && (
              <section className="fotos-antiguas-compatibilidad">
                <div className="fotos-antiguas-titulo">FOTOGRAFÍAS ANEXAS</div>

                <div className="fotos-antiguas-lista">
                  {informeActual.fotosActividad.map((foto, indice) => (
                    <div
                      className="foto-antigua"
                      key={foto.id || `${foto.src}-${indice}`}
                    >
                      <img src={foto.src} alt={`Evidencia ${indice + 1}`} />

                      <button
                        type="button"
                        className="btn-eliminar-foto"
                        onClick={() => eliminarFotografia(indice)}
                        title="Eliminar fotografía"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="informe-area-blanca"></div>
          </div>

          {paginasDescripcion.slice(1).map((_, indice) => {
            const pagina = indice + 1;
            return (
              <div
                className="informe-hoja-pagina informe-hoja-continuacion"
                key={`${informeActual.id}-descripcion-${pagina}`}
              >
                <table className="informe-encabezado">
                  <tbody>
                    <tr>
                      <td rowSpan="4" className="encabezado-logo">
                        <img src="/logo-emsa.png" alt="EMSA" />
                      </td>
                      <td className="encabezado-label">CÓDIGO:</td>
                      <td className="encabezado-valor">EMSA-MTO-IF-01</td>
                    </tr>
                    <tr>
                      <td className="encabezado-label">VERSIÓN:</td>
                      <td className="encabezado-valor">01</td>
                    </tr>
                    <tr>
                      <td className="encabezado-label">FECHA:</td>
                      <td className="encabezado-valor">
                        {formatearFecha(informeActual.fechaCreacion)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="encabezado-pagina">
                        PÁGINA {pagina + 1} DE {totalPaginasInforme}
                      </td>
                    </tr>
                    <tr>
                      <td className="encabezado-titulo-izquierdo">
                        INFORME REPORTE DE
                        <br />
                        MANTENIMIENTO DIARIO
                      </td>
                      <td colSpan="2" className="encabezado-titulo-derecho">
                        MANTENIMIENTO DEL
                        <br />
                        SISTEMA ELÉCTRICO
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div
                  className="descripcion-editor descripcion-pagina-editor"
                  contentEditable
                  suppressContentEditableWarning
                  ref={(elemento) => {
                    paginasEditorRefs.current[pagina] = elemento;
                  }}
                  onFocus={(event) => {
                    editorDescripcionRef.current = event.currentTarget;
                  }}
                  onInput={manejarInputDescripcion}
                  onKeyDown={manejarKeyDownDescripcion}
                  onKeyUp={manejarKeyUpDescripcion}
                  onMouseUp={guardarSeleccionDescripcion}
                  onClick={manejarClickDescripcion}
                ></div>
              </div>
            );
          })}

          {bloquesAnomalias.map((reporte, indiceReporte) => {
            const numeroPagina = paginasDescripcion.length + indiceReporte + 1;
            const indiceInicial =
              reporte.indiceBloque * FILAS_ANOMALIAS_POR_HOJA;

            return (
              <section
                className="informe-hoja-pagina informe-hoja-anomalias"
                key={`${informeActual.id}-${reporte.nombreColeccion}-${reporte.indiceBloque}`}
              >
                <table className="informe-encabezado reporte-anomalias-encabezado">
                  <tbody>
                    <tr>
                      <td rowSpan="4" className="encabezado-logo">
                        <img src="/logo-emsa.png" alt="EMSA" />
                      </td>
                      <td className="encabezado-label">CÓDIGO:</td>
                      <td className="encabezado-valor">EMSA-MTO-IF-01</td>
                    </tr>
                    <tr>
                      <td className="encabezado-label">VERSIÓN:</td>
                      <td className="encabezado-valor">01</td>
                    </tr>
                    <tr>
                      <td className="encabezado-label">FECHA:</td>
                      <td className="encabezado-valor">
                        {formatearFecha(informeActual.fechaCreacion)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="encabezado-pagina">
                        PÁGINA {numeroPagina} DE {totalPaginasInforme}
                      </td>
                    </tr>
                    <tr>
                      <td className="encabezado-titulo-izquierdo">
                        INFORME REPORTE DE
                        <br />
                        MANTENIMIENTO DIARIO
                      </td>
                      <td colSpan="2" className="encabezado-titulo-derecho">
                        MANTENIMIENTO DEL
                        <br />
                        SISTEMA ELÉCTRICO
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="reporte-anomalias">
                  <div className="reporte-anomalias-titulo">
                    {reporte.titulo}
                  </div>

                  <table className="reporte-anomalias-tabla">
                    <colgroup>
                      <col className="reporte-col-equipo" />
                      <col className="reporte-col-serie" />
                      <col className="reporte-col-inventario" />
                      <col className="reporte-col-observacion" />
                      <col className="reporte-col-estado" />
                    </colgroup>
                    <thead>
                      <tr>
                        {reporte.columnas.map(([, etiqueta]) => (
                          <th key={etiqueta}>{etiqueta.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.bloque.map((anomalia, indice) => {
                        const indiceGlobal = indiceInicial + indice;

                        return (
                          <tr
                            key={`${informeActual.id}-anomalia-${indiceGlobal}`}
                          >
                            {reporte.columnas.map(
                              ([campo, etiqueta], indiceCampo) => (
                                <td key={campo}>
                                  <textarea
                                    ref={(elemento) => {
                                      if (elemento) {
                                        elemento.style.height = "auto";
                                        elemento.style.height = `${elemento.scrollHeight}px`;
                                      }
                                    }}
                                    value={anomalia[campo]}
                                    onChange={(event) => {
                                      const valor = event.target.value;
                                      const esUltimaFila =
                                        indiceGlobal ===
                                        reporte.filas.length - 1;
                                      const creoNuevaFila =
                                        indiceCampo ===
                                          reporte.columnas.length - 1 &&
                                        esUltimaFila &&
                                        valor.includes("\n");

                                      actualizarAnomalia(
                                        indiceGlobal,
                                        campo,
                                        creoNuevaFila
                                          ? valor.replace(/\n/g, "")
                                          : valor,
                                        reporte.nombreColeccion,
                                      );

                                      if (creoNuevaFila) {
                                        agregarFilaAnomalia(
                                          reporte.nombreColeccion,
                                        );
                                      }
                                    }}
                                    onInput={ajustarAlturaAnomalia}
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" &&
                                        indiceCampo ===
                                          reporte.columnas.length - 1 &&
                                        indiceGlobal ===
                                          reporte.filas.length - 1
                                      ) {
                                        event.preventDefault();
                                        agregarFilaAnomalia(
                                          reporte.nombreColeccion,
                                        );
                                      }

                                      if (
                                        event.key === "Delete" &&
                                        indiceCampo ===
                                          reporte.columnas.length - 1
                                      ) {
                                        event.preventDefault();
                                        eliminarFilaAnomalia(
                                          indiceGlobal,
                                          reporte.nombreColeccion,
                                        );
                                      }
                                    }}
                                    aria-label={`${etiqueta}, fila ${indiceGlobal + 1}`}
                                  ></textarea>
                                </td>
                              ),
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {paginasFotograficas.map((bloque, indicePagina) => {
            const numeroPagina =
              paginasDescripcion.length +
              bloquesAnomalias.length +
              indicePagina +
              1;
            const indiceInicial = indicePagina * ESPACIOS_FOTOGRAFICOS_POR_HOJA;

            return (
              <>
                <section
                  className="informe-hoja-pagina informe-hoja-fotografias"
                  key={`${informeActual.id}-registro-fotografico-${indicePagina}`}
                >
                  <table className="informe-encabezado registro-fotografico-encabezado">
                    <tbody>
                      <tr>
                        <td rowSpan="4" className="encabezado-logo">
                          <img src="/logo-emsa.png" alt="EMSA" />
                        </td>
                        <td className="encabezado-label">CÓDIGO:</td>
                        <td className="encabezado-valor">EMSA-MTO-IF-01</td>
                      </tr>
                      <tr>
                        <td className="encabezado-label">VERSIÓN:</td>
                        <td className="encabezado-valor">01</td>
                      </tr>
                      <tr>
                        <td className="encabezado-label">FECHA:</td>
                        <td className="encabezado-valor">
                          {formatearFecha(informeActual.fechaCreacion)}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan="2" className="encabezado-pagina">
                          PÁGINA {numeroPagina} DE {totalPaginasInforme}
                        </td>
                      </tr>
                      <tr>
                        <td className="encabezado-titulo-izquierdo">
                          INFORME REPORTE DE
                          <br />
                          MANTENIMIENTO DIARIO
                        </td>
                        <td colSpan="2" className="encabezado-titulo-derecho">
                          MANTENIMIENTO DEL
                          <br />
                          SISTEMA ELÉCTRICO
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="registro-fotografico">
                    <div className="registro-fotografico-titulo">
                      REGISTRO FOTOGRÁFICO
                    </div>
                    <div className="registro-fotografico-cuadricula">
                      {bloque.map((foto, indice) => {
                        const indiceGlobal = indiceInicial + indice;

                        return (
                          <div
                            className="registro-fotografico-celda"
                            key={`${informeActual.id}-foto-${indiceGlobal}`}
                          >
                            <div className="registro-fotografico-imagen">
                              {foto.src ? (
                                <img
                                  src={foto.src}
                                  alt={`Registro fotográfico ${indiceGlobal + 1}`}
                                  tabIndex="0"
                                  className={
                                    fotoRegistroSeleccionada === indiceGlobal
                                      ? "registro-fotografico-imagen-seleccionada"
                                      : ""
                                  }
                                  onClick={(event) => {
                                    event.currentTarget.focus();
                                    setFotoRegistroSeleccionada(indiceGlobal);
                                  }}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Delete" ||
                                      event.key === "Supr"
                                    ) {
                                      event.preventDefault();
                                      eliminarImagenFotografica(indiceGlobal);
                                    }
                                  }}
                                />
                              ) : (
                                <label className="registro-fotografico-cargar">
                                  Agregar imagen
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) =>
                                      cargarImagenFotografica(
                                        indiceGlobal,
                                        event,
                                      )
                                    }
                                  />
                                </label>
                              )}
                            </div>
                            <textarea
                              value={foto.descripcion || ""}
                              placeholder="Descripción de la imagen..."
                              onChange={(event) =>
                                actualizarDescripcionFotografica(
                                  indiceGlobal,
                                  event.target.value,
                                )
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" &&
                                  indiceGlobal ===
                                    registroFotografico.length - 1
                                ) {
                                  event.preventDefault();
                                  agregarPaginaFotografica();
                                }

                                if (
                                  (event.key === "Delete" ||
                                    event.key === "Supr") &&
                                  indiceGlobal ===
                                    registroFotografico.length - 1
                                ) {
                                  event.preventDefault();
                                  eliminarPaginaFotografica();
                                }
                              }}
                              aria-label={`Descripción del registro ${indiceGlobal + 1}`}
                            ></textarea>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {indicePagina === paginasFotograficas.length - 1 && (
                  <section className="informe-hoja-pagina informe-hoja-final">
                    <table className="informe-encabezado">
                      <tbody>
                        <tr>
                          <td rowSpan="4" className="encabezado-logo">
                            <img src="/logo-emsa.png" alt="EMSA" />
                          </td>
                          <td className="encabezado-label">CÓDIGO:</td>
                          <td className="encabezado-valor">EMSA-MTO-IF-01</td>
                        </tr>
                        <tr>
                          <td className="encabezado-label">VERSIÓN:</td>
                          <td className="encabezado-valor">01</td>
                        </tr>
                        <tr>
                          <td className="encabezado-label">FECHA:</td>
                          <td className="encabezado-valor">
                            {formatearFecha(informeActual.fechaCreacion)}
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="2" className="encabezado-pagina">
                            PÁGINA {totalPaginasInforme} DE{" "}
                            {totalPaginasInforme}
                          </td>
                        </tr>
                        <tr>
                          <td className="encabezado-titulo-izquierdo">
                            INFORME REPORTE DE
                            <br />
                            MANTENIMIENTO DIARIO
                          </td>
                          <td colSpan="2" className="encabezado-titulo-derecho">
                            MANTENIMIENTO DEL
                            <br />
                            SISTEMA ELÉCTRICO
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {[
                      [
                        "COMENTARIOS U OBSERVACIONES",
                        "comentariosObservaciones",
                      ],
                      ["ANEXOS", "anexos"],
                    ].map(([titulo, campo]) => (
                      <section className="bloque-final-informe" key={campo}>
                        <div>{titulo}</div>
                        <textarea
                          value={informeActual[campo] || ""}
                          onChange={(event) =>
                            actualizarCampo(campo, event.target.value)
                          }
                        ></textarea>
                      </section>
                    ))}

                    <section className="bloque-final-informe bloque-tiempos">
                      <div>TIEMPOS DE ACTIVIDAD</div>
                      <table>
                        <thead>
                          <tr>
                            {[
                              "SUBESTACIÓN",
                              "ACTIVIDADES",
                              "HORA INICIAL DESPLAZAMIENTO",
                              "HORA INICIAL ACTIVIDAD",
                              "HORA FINAL ACTIVIDAD",
                              "HORA FINAL DESPLAZAMIENTO",
                            ].map((titulo) => (
                              <th key={titulo}>{titulo}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(informeActual.tiemposActividad || [{}])
                            .slice(0, 1)
                            .map((fila, indice) => (
                              <tr key={indice}>
                                {[
                                  "subestacion",
                                  "actividades",
                                  "horaInicialDesplazamiento",
                                  "horaInicialActividad",
                                  "horaFinalActividad",
                                  "horaFinalDesplazamiento",
                                ].map((campo) => (
                                  <td key={campo}>
                                    <textarea
                                      value={fila[campo] || ""}
                                      onChange={(event) =>
                                        actualizarCampoTiempo(
                                          indice,
                                          campo,
                                          event.target.value,
                                        )
                                      }
                                    ></textarea>
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </section>

                    <section className="bloque-final-informe">
                      <div>EQUIPOS Y RECURSOS</div>
                      <textarea
                        value={informeActual.equiposRecursos || ""}
                        onChange={(event) =>
                          actualizarCampo("equiposRecursos", event.target.value)
                        }
                      ></textarea>
                    </section>
                  </section>
                )}
              </>
            );
          })}
        </div>
      </div>
    );
  }

  /* ============================================================
     RENDER — LISTADO
     ============================================================ */

  return (
    <div className="informes-contenedor">
      <div className="informes-pagina-header">
        <div>
          <span className="informes-editor-etiqueta">SIGPAS</span>

          <h1>Informes</h1>
        </div>

        <button
          type="button"
          className="btn-nuevo-informe btn-nuevo-informe-header"
          onClick={nuevoInforme}
        >
          + Nuevo informe
        </button>
      </div>

      <div className="informes-filtros">
        <div className="campo-filtro campo-busqueda">
          <label>Buscar</label>

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Informe, OT o subestación..."
          />
        </div>

        <div className="campo-filtro campo-anio">
          <label>Año</label>

          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
          >
            <option value="Todos">Todos</option>

            {aniosDisponibles.map((anio) => (
              <option value={anio} key={anio}>
                {anio}
              </option>
            ))}
          </select>
        </div>

        <div className="campo-filtro campo-mes">
          <label>Mes</label>

          <select
            value={filtroMes}
            onChange={(e) =>
              setFiltroMes(
                e.target.value === "Todos" ? "Todos" : Number(e.target.value),
              )
            }
          >
            <option value="Todos">Todos</option>

            {MESES.slice(1).map((mes, indice) => (
              <option value={indice + 1} key={mes}>
                {mes}
              </option>
            ))}
          </select>
        </div>

        <div className="campo-filtro campo-semana">
          <label>Semana</label>

          <select
            value={filtroSemana}
            onChange={(e) => setFiltroSemana(e.target.value)}
          >
            <option value="Todos">Todas</option>

            {semanasDisponibles.map((semana) => (
              <option value={semana} key={semana}>
                Semana {semana}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn-limpiar-informes"
          onClick={limpiarFiltros}
        >
          Limpiar
        </button>

        <div className="campo-filtro campo-subestacion">
          <label>Subestación</label>

          <select
            value={filtroSubestacion}
            onChange={(e) => setFiltroSubestacion(e.target.value)}
          >
            <option value="Todas">Todas</option>

            {subestacionesDisponibles.map((subestacion) => (
              <option value={subestacion} key={subestacion}>
                {subestacion}
              </option>
            ))}
          </select>
        </div>

        <div className="campo-filtro campo-cuadrilla">
          <label>Cuadrilla</label>

          <select
            value={filtroCuadrilla}
            onChange={(e) => setFiltroCuadrilla(e.target.value)}
          >
            <option value="Todas">Todas</option>

            {cuadrillas
              .filter((cuadrilla) => cuadrilla.activa)
              .map((cuadrilla) => (
                <option value={cuadrilla.id} key={cuadrilla.id}>
                  {cuadrilla.nombre}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="informes-seleccion-barra">
        <span>
          {informesSeleccionados.length
            ? `${informesSeleccionados.length} informe(s) seleccionado(s)`
            : "Seleccione uno o varios informes para descargarlos en PDF."}
        </span>
        <button
          type="button"
          className="btn-tabla"
          disabled={!informesSeleccionados.length}
          onClick={descargarInformesSeleccionados}
        >
          Descargar PDF
        </button>
      </div>

      <div className="informes-tabla-contenedor">
        {cargandoInformes ? (
          <div className="informes-tabla-vacia">
            <h3>Cargando informes...</h3>
            <p>Esperando respuesta del servidor.</p>
          </div>
        ) : informesFiltrados.length === 0 ? (
          <div className="informes-tabla-vacia">
            <div className="informes-vacio-icono">—</div>

            <h3>No hay informes registrados</h3>

            <p>Cree un nuevo informe para comenzar.</p>

            <button
              type="button"
              onClick={nuevoInforme}
              className="btn-nuevo-informe"
            >
              + Nuevo informe
            </button>
          </div>
        ) : (
          <table className="informes-tabla">
            <thead>
              <tr>
                <th className="columna-seleccion">
                  <input
                    type="checkbox"
                    checked={
                      informesFiltrados.length > 0 &&
                      informesFiltrados.every((informe) =>
                        informesSeleccionados.includes(informe.id),
                      )
                    }
                    onChange={alternarTodosLosInformesVisibles}
                    aria-label="Seleccionar todos los informes visibles"
                  />
                </th>
                <th>Informe</th>
                <th>Fecha</th>
                <th>Semana</th>
                <th>OT</th>
                <th>Subestación</th>
                <th>Cuadrilla</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {informesFiltrados.map((informe) => {
                const semanaInforme = obtenerSemanaInforme(informe);
                const estaCargando = cargandoInformeId === informe.id;

                return (
                  <tr key={informe.id}>
                    <td className="columna-seleccion">
                      <input
                        type="checkbox"
                        checked={informesSeleccionados.includes(informe.id)}
                        onChange={() => alternarInformeSeleccionado(informe.id)}
                        aria-label={`Seleccionar ${informe.numeroInforme || "informe"}`}
                      />
                    </td>
                    <td>
                      <strong>{informe.numeroInforme || "Sin asignar"}</strong>
                    </td>

                    <td>{formatearFecha(informe.fechaCreacion)}</td>

                    <td>
                      {semanaInforme != null ? (
                        <span className="informe-semana-badge">
                          Semana {semanaInforme}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>{informe.numeroOrdenTrabajo || "No registrado"}</td>

                    <td>{informe.subestacion || "Sin asignar"}</td>

                    <td>
                      {cuadrillas.find(
                        (cuadrilla) =>
                          cuadrilla.id ===
                          (informe.cuadrillaId ||
                            informe.actividadSnapshot?.cuadrillaId),
                      )?.nombre ||
                        informe.cuadrillaId ||
                        informe.actividadSnapshot?.cuadrillaId ||
                        "Sin asignar"}
                    </td>

                    <td>
                      <div className="acciones-informe">
                        <button
                          type="button"
                          className="btn-tabla"
                          onClick={() => abrirInforme(informe)}
                          disabled={estaCargando}
                        >
                          {estaCargando ? "Abriendo..." : "Abrir"}
                        </button>

                        <button
                          type="button"
                          className="btn-tabla btn-tabla-eliminar"
                          onClick={() => eliminarInforme(informe.id)}
                          disabled={estaCargando}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Informes;
