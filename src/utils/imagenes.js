/* =========================================================
   SIGPAS · UTILIDADES DE IMÁGENES
   =========================================================
   Compresión de imágenes sin dependencias externas,
   usando Canvas nativo del navegador.
   ========================================================= */

const TAMANO_DEFECTO = {
  maxAncho: 1500,
  maxAlto: 1500,
  calidad: 0.85,
  tipoSalida: "image/jpeg",
};

const TAMANO_FIRMA = {
  maxAncho: 600,
  maxAlto: 600,
  calidad: 0.85,
  tipoSalida: "image/jpeg",
};

/* ---------------------------------------------------------
   Carga un File como HTMLImageElement
   --------------------------------------------------------- */

function cargarImagenDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/* ---------------------------------------------------------
   Comprime un File de imagen y devuelve un dataURL
   --------------------------------------------------------- */

export async function comprimirImagen(file, opciones = {}) {
  if (!file || !file.type?.startsWith("image/")) return null;

  const {
    maxAncho = TAMANO_DEFECTO.maxAncho,
    maxAlto = TAMANO_DEFECTO.maxAlto,
    calidad = TAMANO_DEFECTO.calidad,
    tipoSalida = TAMANO_DEFECTO.tipoSalida,
  } = opciones;

  try {
    const img = await cargarImagenDesdeArchivo(file);

    // Calcular tamaño destino manteniendo el ratio
    const ratio = Math.min(maxAncho / img.width, maxAlto / img.height, 1);
    const nuevoAncho = Math.max(1, Math.round(img.width * ratio));
    const nuevoAlto = Math.max(1, Math.round(img.height * ratio));

    // Canvas
    const canvas = document.createElement("canvas");
    canvas.width = nuevoAncho;
    canvas.height = nuevoAlto;
    const ctx = canvas.getContext("2d");

    // JPEG no soporta transparencia → fondo blanco
    if (tipoSalida === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, nuevoAncho, nuevoAlto);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, nuevoAncho, nuevoAlto);

    const dataUrl = canvas.toDataURL(tipoSalida, calidad);

    // Log informativo solo en desarrollo
    if (import.meta.env?.DEV) {
      const pesoOrig = (file.size / 1024).toFixed(0);
      const pesoNuevo = Math.round((dataUrl.length * 3) / 4 / 1024);
      console.log(
        `🖼 [img] ${file.name} · ${img.width}×${img.height} → ${nuevoAncho}×${nuevoAlto} · ${pesoOrig} KB → ${pesoNuevo} KB`,
      );
    }

    return dataUrl;
  } catch (err) {
    console.error("Error comprimiendo imagen:", err);
    return null;
  }
}

/* ---------------------------------------------------------
   Atajo para firmas digitales (PNG, mantiene transparencia)
   --------------------------------------------------------- */

export function comprimirFirma(file) {
  return comprimirImagen(file, TAMANO_FIRMA);
}
