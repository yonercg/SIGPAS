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
    // Optimistic update
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
  // OBTENER OT POR ACTIVIDAD (lookup, sin red)
  // =================================================
  const obtenerOTPorActividad = useCallback(
    (actividadId) => {
      if (!actividadId) return null;
      return ots[String(actividadId)] || null;
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
      const nuevo = {
        ...datosOT,
        actividadId: key,
        actualizadaEn: new Date().toISOString(),
      };

      setOts((prev) => ({ ...prev, [key]: nuevo }));

      const { error } = await supabase.from("ots").upsert({
        actividad_id: key,
        datos: nuevo,
        fecha_actualizacion: new Date().toISOString(),
      });

      if (error) {
        console.error("❌ Error al guardar OT:", error);
        setOts((prev) => {
          const copia = { ...prev };
          if (anterior) copia[key] = anterior;
          else delete copia[key];
          return copia;
        });
        return false;
      }
      return true;
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

      const { error } = await supabase
        .from("ots")
        .delete()
        .eq("actividad_id", key);

      if (error) {
        console.error("❌ Error al eliminar OT:", error);
        if (anterior) {
          setOts((prev) => ({ ...prev, [key]: anterior }));
        }
        return false;
      }
      return true;
    },
    [ots],
  );

  // =================================================
  // VALOR DEL CONTEXTO
  // =================================================
  const valorContexto = useMemo(
    () => ({
      // Actividades
      actividades,
      setActividades,
      agregarActividad,
      modificarActividad,
      eliminarActividad,
      cambiarEstadoActividad,
      guardarMaterialesActividad,

      // Órdenes de trabajo
      ots,
      setOts,
      obtenerOTPorActividad,
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
