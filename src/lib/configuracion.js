import { supabase } from "./supabase";

const ROW_ID = "cambios_manuales";

export async function cargarCambiosManuales() {
  try {
    const { data, error } = await supabase
      .from("configuracion")
      .select("datos")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) throw error;
    return data?.datos || {};
  } catch (error) {
    console.error("Error cargando cambios manuales desde Supabase:", error);
    return {};
  }
}

export async function guardarCambiosManuales(datos) {
  try {
    const { error } = await supabase.from("configuracion").upsert(
      {
        id: ROW_ID,
        datos: datos,
        fecha_actualizacion: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) throw error;
  } catch (error) {
    console.error("Error guardando cambios manuales en Supabase:", error);
  }
}
