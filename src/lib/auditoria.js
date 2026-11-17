import { supabase } from "./supabase";

/**
 * Registra una acción en la base de datos de auditoría.
 * @param {Object} usuario - El objeto del usuario actual (del AuthContext)
 * @param {String} pagina - Nombre de la página (ej. "Programación")
 * @param {String} accion - Qué se hizo (ej. "Crear", "Modificar", "Eliminar")
 * @param {Object|String} detalles - Información adicional de la acción
 */
export async function registrarAuditoria(
  usuario,
  pagina,
  accion,
  detalles = {},
) {
  if (!usuario) return; // Si no hay usuario, no registramos

  try {
    await supabase.from("auditoria").insert({
      usuario_id: String(usuario.id),
      usuario_nombre: usuario.nombre || usuario.usuario || "Desconocido",
      pagina,
      accion,
      detalles:
        typeof detalles === "string" ? { descripcion: detalles } : detalles,
    });
  } catch (error) {
    console.error("Error guardando log de auditoría:", error);
    // No lanzamos el error para no romper la app principal
  }
}
