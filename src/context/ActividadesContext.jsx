import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { actividades as actividadesIniciales } from "../data/actividades";

const ActividadesContext = createContext();

const CLAVE_STORAGE = "sigpas_actividades";
const CLAVE_STORAGE_OTS = "sigpas_ots";

// =================================================
// PROVIDER
// =================================================

export function ActividadesProvider({ children }) {
  // =================================================
  // ACTIVIDADES
  // =================================================

  const [actividades, setActividades] = useState(() => {
    try {
      const actividadesGuardadas = localStorage.getItem(CLAVE_STORAGE);

      if (actividadesGuardadas) {
        const actividadesParseadas = JSON.parse(actividadesGuardadas);

        if (Array.isArray(actividadesParseadas)) {
          return actividadesParseadas;
        }
      }
    } catch (error) {
      console.error("Error al cargar actividades desde localStorage:", error);
    }

    return actividadesIniciales;
  });

  // =================================================
  // ÓRDENES DE TRABAJO
  // =================================================
  //
  // Se guardan como objeto indexado por actividadId.
  // Ejemplo:
  // {
  //   "act-001": { numeroOT: "...", fechaEmision: "...", ... },
  //   "act-002": { ... }
  // }
  //
  // =================================================

  const [ots, setOts] = useState(() => {
    try {
      const otsGuardadas = localStorage.getItem(CLAVE_STORAGE_OTS);

      if (otsGuardadas) {
        const otsParseadas = JSON.parse(otsGuardadas);

        if (otsParseadas && typeof otsParseadas === "object") {
          return otsParseadas;
        }
      }
    } catch (error) {
      console.error("Error al cargar OTs desde localStorage:", error);
    }

    return {};
  });

  // =================================================
  // GUARDAR ACTIVIDADES
  // =================================================

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_STORAGE, JSON.stringify(actividades));
    } catch (error) {
      console.error("Error al guardar actividades en localStorage:", error);
    }
  }, [actividades]);

  // =================================================
  // GUARDAR OTs
  // =================================================

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_STORAGE_OTS, JSON.stringify(ots));
    } catch (error) {
      console.error("Error al guardar OTs en localStorage:", error);
    }
  }, [ots]);

  // =================================================
  // AGREGAR ACTIVIDAD
  // =================================================

  const agregarActividad = useCallback((actividad) => {
    setActividades((anteriores) => [...anteriores, actividad]);
  }, []);

  // =================================================
  // MODIFICAR ACTIVIDAD
  // =================================================

  const modificarActividad = useCallback((id, cambios) => {
    setActividades((anteriores) =>
      anteriores.map((actividad) =>
        actividad.id === id
          ? {
              ...actividad,
              ...cambios,
            }
          : actividad,
      ),
    );
  }, []);

  // =================================================
  // ELIMINAR ACTIVIDAD
  // =================================================
  //
  // También elimina la OT asociada si existía.
  //
  // =================================================

  const eliminarActividad = useCallback((id) => {
    setActividades((anteriores) =>
      anteriores.filter((actividad) => actividad.id !== id),
    );

    setOts((anteriores) => {
      const copia = { ...anteriores };
      delete copia[String(id)];
      return copia;
    });
  }, []);

  // =================================================
  // CAMBIAR ESTADO
  // =================================================

  const cambiarEstadoActividad = useCallback((id, nuevoEstado) => {
    setActividades((anteriores) =>
      anteriores.map((actividad) =>
        actividad.id === id
          ? {
              ...actividad,
              estado: nuevoEstado,
            }
          : actividad,
      ),
    );
  }, []);

  // =================================================
  // GUARDAR MATERIALES
  // =================================================

  const guardarMaterialesActividad = useCallback((id, materiales) => {
    setActividades((anteriores) =>
      anteriores.map((actividad) =>
        actividad.id === id
          ? {
              ...actividad,
              materiales: materiales,
            }
          : actividad,
      ),
    );
  }, []);

  // =================================================
  // OBTENER OT POR ACTIVIDAD
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

  const guardarOT = useCallback((actividadId, datosOT) => {
    if (!actividadId) return false;

    setOts((anteriores) => ({
      ...anteriores,
      [String(actividadId)]: {
        ...datosOT,
        actividadId: String(actividadId),
        actualizadaEn: new Date().toISOString(),
      },
    }));

    return true;
  }, []);

  // =================================================
  // ELIMINAR OT DE UNA ACTIVIDAD
  // =================================================

  const eliminarOT = useCallback((actividadId) => {
    if (!actividadId) return false;

    setOts((anteriores) => {
      const copia = { ...anteriores };
      delete copia[String(actividadId)];
      return copia;
    });

    return true;
  }, []);

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

  // =================================================
  // PROVIDER
  // =================================================

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
