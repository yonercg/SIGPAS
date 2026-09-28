/* =========================================================
   SIGPAS · DEFINICIÓN DE PÁGINAS Y ROLES
   ========================================================= */

export const PAGINAS = [
  { key: "dashboard", label: "Dashboard", ruta: "/dashboard" },
  { key: "programacion", label: "Programación", ruta: "/programacion" },
  { key: "pm", label: "Plan de Mantenimiento", ruta: "/pm" },
  { key: "actividades", label: "Actividades", ruta: "/actividades" },
  { key: "informes", label: "Informes", ruta: "/informes" },
  { key: "ot", label: "Órdenes de Trabajo", ruta: "/ot" },
  { key: "usuarios", label: "Usuarios", ruta: "/usuarios" },
];

export const ROLES = {
  Administrador: {
    dashboard: true,
    programacion: true,
    pm: true,
    actividades: true,
    informes: true,
    ot: true,
    usuarios: true,
  },

  Supervisor: {
    dashboard: true,
    programacion: true,
    pm: true,
    actividades: true,
    informes: true,
    ot: true,
    usuarios: false,
  },

  Operador: {
    dashboard: true,
    programacion: true,
    pm: false,
    actividades: true,
    informes: false,
    ot: true,
    usuarios: false,
  },

  Consulta: {
    dashboard: true,
    programacion: true,
    pm: true,
    actividades: true,
    informes: true,
    ot: true,
    usuarios: false,
  },
};

export const ROLES_LISTA = Object.keys(ROLES);

export function obtenerPermisosPorDefecto(rol) {
  const base = ROLES[rol] || ROLES.Consulta;
  return { ...base };
}

/**
 * Devuelve la ruta de la primera página a la que el usuario
 * tiene acceso. Útil para redirigir después del login.
 */
export function obtenerPrimeraRutaPermitida(permisos) {
  if (!permisos) return "/login";

  const primera = PAGINAS.find((p) => permisos[p.key]);

  return primera?.ruta || "/login";
}
