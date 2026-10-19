import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const ActividadesContext = createContext();
const STORAGE_BUCKET = "sigpas-documentos";

// =================================================
// HELPERS
// =================================================

async function cargarTodoDesdeSupabase() {
  const [resActs, resOts] = await Promise.all([
    supabase.from("actividades").select("id, datos"),
    supabase.from("ots").select("actividad_id, datos"),
  ]);

  if (resActs.error) throw resActs.error;
  if (resOts.error) throw resOts.error;

  const actividades = (resActs.data || []).map((f) => f.datos);
  const ots = {};
  for (const fila of resOts.data || []) {
    ots[String(fila.actividad_id)] = fila.datos;
  }

  return { actividades, ots };
}

// 👈 NUEVAS FUNCIONES DE STORAGE
async function subirOTAStorage(actividadId, contenido) {
  const path = `ots/${actividadId}/datos.json`;
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

  if (error) throw error;
}

async function descargarOTDeStorage(actividadId) {
  const path = `ots/${actividadId}/datos.json`;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function eliminarOTDeStorage(actividadId) {
  const path = `ots/${actividadId}/datos.json`;
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Error eliminando OT de Storage:", error);
  }
}

// =================================================
// PROVIDER
// =================================================

export function ActividadesProvider({ children }) {
  const [actividades, setActividades] = useState([]);
  const [ots, setOts] = useState({});

  // ---------------------------------------------
  // Carga inicial desde Supabase
  // ---------------------------------------------
  useEffect(() => {
    let montado = true;
    (async () => {
      try {
        const { actividades, ots } = await cargarTodoDesdeSupabase();
        if (!montado) return;
        setActividades(actividades);
        setOts(ots);
      } catch (error) {
        console.error("❌ Error al cargar desde Supabase:", error);
      }
    })();
    return () => {
      montado = false;
    };
  }, []);

  // =================================================
  // AGREGAR ACTIVIDAD
  // =================================================
  const agregarActividad = useCallback(async (actividad) => {
    setActividades((prev) => [...prev, actividad]);

    const { error } = await supabase.from("actividades").insert({
      id: String(actividad.id),
      datos: actividad,
    });

    if (error) {
      console.error("❌ Error al agregar actividad:", error);
      setActividades((prev) => prev.filter((a) => a.id !== actividad.id));
      return false;
    }
    return true;
  }, []);

  // =================================================
  // MODIFICAR ACTIVIDAD
  // =================================================
  const modificarActividad = useCallback(
    async (id, cambios) => {
      const anterior = actividades.find((a) => a.id === id);
      if (!anterior) return false;

      const actualizada = { ...anterior, ...cambios };

      setActividades((prev) =>
        prev.map((a) => (a.id === id ? actualizada : a)),
      );

      const { error } = await supabase
        .from("actividades")
        .update({
          datos: actualizada,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", String(id));

      if (error) {
        console.error("❌ Error al modificar actividad:", error);
        setActividades((prev) => prev.map((a) => (a.id === id ? anterior : a)));
        return false;
      }
      return true;
    },
    [actividades],
  );

  // =================================================
  // ELIMINAR ACTIVIDAD (y su OT asociada)
  // =================================================
  const eliminarActividad = useCallback(
    async (id) => {
      const anteriorActs = actividades;
      const anteriorOts = ots;

      setActividades((prev) => prev.filter((a) => a.id !== id));
      setOts((prev) => {
        const copia = { ...prev };
        delete copia[String(id)];
        return copia;
      });

      const [resAct, resOt] = await Promise.all([
        supabase.from("actividades").delete().eq("id", String(id)),
        supabase.from("ots").delete().eq("actividad_id", String(id)),
        eliminarOTDeStorage(String(id)),
      ]);

      if (resAct.error || resOt.error) {
        console.error("❌ Error al eliminar:", resAct.error || resOt.error);
        setActividades(anteriorActs);
        setOts(anteriorOts);
        return false;
      }
      return true;
    },
    [actividades, ots],
  );

  // =================================================
  // CAMBIAR ESTADO
  // =================================================
  const cambiarEstadoActividad = useCallback(
    async (id, nuevoEstado) => {
      const anterior = actividades.find((a) => a.id === id);
      if (!anterior) return false;

      const actualizada = { ...anterior, estado: nuevoEstado };

      setActividades((prev) =>
        prev.map((a) => (a.id === id ? actualizada : a)),
      );

      const { error } = await supabase
        .from("actividades")
        .update({ datos: actualizada })
        .eq("id", String(id));

      if (error) {
        console.error("❌ Error al cambiar estado:", error);
        setActividades((prev) => prev.map((a) => (a.id === id ? anterior : a)));
        return false;
      }
      return true;
    },
    [actividades],
  );

  // =================================================
  // GUARDAR MATERIALES
  // =================================================
  const guardarMaterialesActividad = useCallback(
    async (id, materiales) => {
      const anterior = actividades.find((a) => a.id === id);
      if (!anterior) return false;

      const actualizada = { ...anterior, materiales };

      setActividades((prev) =>
        prev.map((a) => (a.id === id ? actualizada : a)),
      );

      const { error } = await supabase
        .from("actividades")
        .update({ datos: actualizada })
        .eq("id", String(id));

      if (error) {
        console.error("❌ Error al guardar materiales:", error);
        setActividades((prev) => prev.map((a) => (a.id === id ? anterior : a)));
        return false;
      }
      return true;
    },
    [actividades],
  );

  // =================================================
  // OBTENER OT POR ACTIVIDAD (lookup rápido)
  // =================================================
  const obtenerOTPorActividad = useCallback(
    (actividadId) => {
      if (!actividadId) return null;
      return ots[String(actividadId)] || null;
    },
    [ots],
  );

  // =================================================
  // DESCARGAR OT COMPLETA DE STORAGE (NUEVO)
  // =================================================
  const descargarOTCompleta = useCallback(
    async (actividadId) => {
      if (!actividadId) return null;

      // 1. Intentar desde Storage
      const deStorage = await descargarOTDeStorage(String(actividadId));
      if (deStorage) return deStorage;

      // 2. Fallback: buscar si aún está en el estado local (datos antiguos)
      const deEstado = ots[String(actividadId)];
      if (
        deEstado &&
        (deEstado.diagramaUnifilar !== undefined ||
          deEstado.fotosCierre !== undefined ||
          deEstado.personalEjecutor !== undefined)
      ) {
        return deEstado;
      }
      return null;
    },
    [ots],
  );

  // =================================================
  // GUARDAR OT DE UNA ACTIVIDAD
  // =================================================
  const guardarOT = useCallback(
    async (actividadId, datosOT) => {
      if (!actividadId) return false;

      const key = String(actividadId);
      const anterior = ots[key] || null;

      // 1. Extraer metadata ligera para el listado
      const metadata = {
        actividadId: key,
        numeroOT: datosOT.numeroOT || "",
        estadoOT: datosOT.estadoOT || "Pendiente",
        fechaEmision: datosOT.fechaEmision || "",
        cuadrillas: datosOT.cuadrillas || "",
        ubicacionGeografica: datosOT.ubicacionGeografica || "",
        actualizadaEn: new Date().toISOString(),
      };

      setOts((prev) => ({ ...prev, [key]: metadata }));

      try {
        // 2. Subir JSON completo a Storage
        await subirOTAStorage(key, {
          ...datosOT,
          actividadId: key,
          actualizadaEn: metadata.actualizadaEn,
        });

        // 3. Guardar el índice (metadata) en la tabla Supabase
        const { error } = await supabase.from("ots").upsert({
          actividad_id: key,
          datos: metadata,
          fecha_actualizacion: new Date().toISOString(),
        });

        if (error) throw error;

        return true;
      } catch (error) {
        console.error("❌ Error al guardar OT:", error);
        setOts((prev) => {
          const copia = { ...prev };
          if (anterior) copia[key] = anterior;
          else delete copia[key];
          return copia;
        });
        return false;
      }
    },
    [ots],
  );

  // =================================================
  // ELIMINAR OT DE UNA ACTIVIDAD
  // =================================================
  const eliminarOT = useCallback(
    async (actividadId) => {
      if (!actividadId) return false;

      const key = String(actividadId);
      const anterior = ots[key] || null;

      setOts((prev) => {
        const copia = { ...prev };
        delete copia[key];
        return copia;
      });

      try {
        await eliminarOTDeStorage(key);

        const { error } = await supabase
          .from("ots")
          .delete()
          .eq("actividad_id", key);

        if (error) throw error;

        return true;
      } catch (error) {
        console.error("❌ Error al eliminar OT:", error);
        if (anterior) {
          setOts((prev) => ({ ...prev, [key]: anterior }));
        }
        return false;
      }
    },
    [ots],
  );

  // =================================================
  // VALOR DEL CONTEXTO
  // =================================================
  const valorContexto = useMemo(
    () => ({
      actividades,
      setActividades,
      agregarActividad,
      modificarActividad,
      eliminarActividad,
      cambiarEstadoActividad,
      guardarMaterialesActividad,
      ots,
      setOts,
      obtenerOTPorActividad,
      descargarOTCompleta,
      guardarOT,
      eliminarOT,
    }),
    [
      actividades,
      agregarActividad,
      modificarActividad,
      eliminarActividad,
      cambiarEstadoActividad,
      guardarMaterialesActividad,
      ots,
      obtenerOTPorActividad,
      descargarOTCompleta,
      guardarOT,
      eliminarOT,
    ],
  );

  return (
    <ActividadesContext.Provider value={valorContexto}>
      {children}
    </ActividadesContext.Provider>
  );
}

// =================================================
// HOOK
// =================================================

export function useActividades() {
  return useContext(ActividadesContext);
}
