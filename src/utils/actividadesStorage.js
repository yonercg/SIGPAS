import { actividades as actividadesIniciales } from "../data/actividades";

const CLAVE_STORAGE = "sigpas_actividades";

// Obtener actividades
export const obtenerActividades = () => {
  const actividadesGuardadas =
    localStorage.getItem(CLAVE_STORAGE);

  if (!actividadesGuardadas) {
    localStorage.setItem(
      CLAVE_STORAGE,
      JSON.stringify(actividadesIniciales)
    );

    return actividadesIniciales;
  }

  try {
    return JSON.parse(actividadesGuardadas);
  } catch (error) {
    console.error(
      "Error al leer las actividades guardadas:",
      error
    );

    return actividadesIniciales;
  }
};

// Guardar actividades
export const guardarActividades = (actividades) => {
  localStorage.setItem(
    CLAVE_STORAGE,
    JSON.stringify(actividades)
  );
};

// Eliminar todas las actividades guardadas
export const limpiarActividades = () => {
  localStorage.removeItem(CLAVE_STORAGE);
};