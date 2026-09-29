import { createContext, useContext, useEffect, useState } from "react";
import { hashPassword } from "../utils/hash";
import { supabase } from "../lib/supabase";

const CLAVE_SESION = "sigpas_sesion";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

/* =========================================================
   ADAPTADORES
   Convierten entre el formato snake_case de Supabase
   y el camelCase que usa el resto de la app.
   ========================================================= */

function deSupabase(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    usuario: fila.usuario,
    email: fila.email || "",
    passwordHash: fila.password_hash,
    rol: fila.rol,
    activo: fila.activo,
    permisos: fila.permisos || {},
    fechaCreacion: fila.fecha_creacion,
    ultimoAcceso: fila.ultimo_acceso || "",
  };
}

/* =========================================================
   PROVIDER
   ========================================================= */

export function AuthProvider({ children }) {
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  /* -----------------------------------------------------
     Al arrancar: carga usuarios desde Supabase
     y restaura la sesión si existe.
     ----------------------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("usuarios")
          .select("*")
          .order("fecha_creacion", { ascending: true });

        if (error) throw error;

        const lista = (data || []).map(deSupabase);
        setUsuarios(lista);

        const sesionGuardada = localStorage.getItem(CLAVE_SESION);
        if (sesionGuardada) {
          const usuarioId = JSON.parse(sesionGuardada);
          const encontrado = lista.find((u) => u.id === usuarioId);

          if (encontrado && encontrado.activo) {
            setUsuarioActual(encontrado);
          } else {
            localStorage.removeItem(CLAVE_SESION);
          }
        }
      } catch (error) {
        console.error("❌ Error al cargar usuarios desde Supabase:", error);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  /* =======================================================
     INICIAR SESIÓN
     ======================================================= */

  const iniciarSesion = async (nombreUsuario, password) => {
    try {
      const hash = await hashPassword(password);
      const usuarioLimpio = nombreUsuario.toLowerCase().trim();

      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("usuario", usuarioLimpio)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { ok: false, error: "Usuario no encontrado." };
      }

      if (!data.activo) {
        return { ok: false, error: "El usuario está inactivo." };
      }

      if (data.password_hash !== hash) {
        return { ok: false, error: "Contraseña incorrecta." };
      }

      // Actualizar último acceso en Supabase
      const ahora = new Date().toISOString();
      const { error: errUpdate } = await supabase
        .from("usuarios")
        .update({ ultimo_acceso: ahora })
        .eq("id", data.id);

      if (errUpdate) {
        console.error("Error al actualizar último acceso:", errUpdate);
      }

      const usuario = deSupabase({ ...data, ultimo_acceso: ahora });
      setUsuarioActual(usuario);
      localStorage.setItem(CLAVE_SESION, JSON.stringify(usuario.id));

      // ✅ Recargar la lista completa de usuarios desde Supabase
      // (por si el primer useEffect falló o quedó desactualizada)
      const { data: todosLosUsuarios, error: errLista } = await supabase
        .from("usuarios")
        .select("*")
        .order("fecha_creacion", { ascending: true });

      if (errLista) {
        console.error("Error al recargar lista de usuarios:", errLista);
        // Fallback: al menos actualizamos el usuario actual en la lista local
        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuario.id ? usuario : u)),
        );
      } else {
        setUsuarios((todosLosUsuarios || []).map(deSupabase));
      }

      return { ok: true, usuario };
    } catch (error) {
      console.error("❌ Error al iniciar sesión:", error);
      return { ok: false, error: "Error de conexión con el servidor." };
    }
  };

  /* =======================================================
     CERRAR SESIÓN
     ======================================================= */

  const cerrarSesion = () => {
    setUsuarioActual(null);
    localStorage.removeItem(CLAVE_SESION);
  };

  /* =======================================================
     PERMISOS
     ======================================================= */

  const tienePermiso = (paginaKey) => {
    if (!usuarioActual) return false;
    return Boolean(usuarioActual.permisos?.[paginaKey]);
  };

  /* =======================================================
     CRUD USUARIOS
     ======================================================= */

  const agregarUsuario = async (datos) => {
    try {
      const hash = await hashPassword(datos.password);
      const usuarioLimpio = datos.usuario.toLowerCase().trim();

      // Verificar duplicado
      const { data: existente } = await supabase
        .from("usuarios")
        .select("id")
        .eq("usuario", usuarioLimpio)
        .maybeSingle();

      if (existente) {
        return { ok: false, error: "El nombre de usuario ya existe." };
      }

      const nuevo = {
        nombre: datos.nombre.trim(),
        usuario: usuarioLimpio,
        email: datos.email?.trim() || null,
        password_hash: hash,
        rol: datos.rol,
        activo: datos.activo !== false,
        permisos: { ...datos.permisos },
      };

      const { data, error } = await supabase
        .from("usuarios")
        .insert(nuevo)
        .select()
        .single();

      if (error) throw error;

      const usuario = deSupabase(data);
      setUsuarios((prev) => [...prev, usuario]);
      return { ok: true, usuario };
    } catch (error) {
      console.error("❌ Error al agregar usuario:", error);
      return { ok: false, error: error.message || "Error al crear usuario." };
    }
  };

  const modificarUsuario = async (id, datos) => {
    try {
      const anterior = usuarios.find((u) => u.id === id);
      if (!anterior) {
        return { ok: false, error: "Usuario no encontrado." };
      }

      const usuarioLimpio = datos.usuario.toLowerCase().trim();

      // Verificar duplicado en OTRO usuario
      const { data: existente } = await supabase
        .from("usuarios")
        .select("id")
        .eq("usuario", usuarioLimpio)
        .neq("id", id)
        .maybeSingle();

      if (existente) {
        return { ok: false, error: "El nombre de usuario ya existe." };
      }

      const cambios = {
        nombre: datos.nombre.trim(),
        usuario: usuarioLimpio,
        email: datos.email?.trim() || null,
        rol: datos.rol,
        activo: datos.activo !== false,
        permisos: { ...datos.permisos },
      };

      // Solo actualizar contraseña si se proporcionó una nueva
      if (datos.password && datos.password.trim()) {
        cambios.password_hash = await hashPassword(datos.password);
      }

      const { data, error } = await supabase
        .from("usuarios")
        .update(cambios)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      const actualizado = deSupabase(data);
      setUsuarios((prev) => prev.map((u) => (u.id === id ? actualizado : u)));

      if (usuarioActual?.id === id) {
        setUsuarioActual(actualizado);
      }

      return { ok: true, usuario: actualizado };
    } catch (error) {
      console.error("❌ Error al modificar usuario:", error);
      return {
        ok: false,
        error: error.message || "Error al modificar usuario.",
      };
    }
  };

  const eliminarUsuario = async (id) => {
    try {
      if (usuarioActual?.id === id) {
        return { ok: false, error: "No puedes eliminar tu propio usuario." };
      }

      const { error } = await supabase.from("usuarios").delete().eq("id", id);

      if (error) throw error;

      setUsuarios((prev) => prev.filter((u) => u.id !== id));
      return { ok: true };
    } catch (error) {
      console.error("❌ Error al eliminar usuario:", error);
      return {
        ok: false,
        error: error.message || "Error al eliminar usuario.",
      };
    }
  };

  const value = {
    usuarioActual,
    usuarios,
    cargando,
    iniciarSesion,
    cerrarSesion,
    tienePermiso,
    agregarUsuario,
    modificarUsuario,
    eliminarUsuario,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
