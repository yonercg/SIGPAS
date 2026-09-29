import { createContext, useContext, useEffect, useState } from "react";
import { hashPassword } from "../utils/hash";
import { obtenerPermisosPorDefecto } from "../data/permisos";

const CLAVE_USUARIOS = "sigpas_usuarios";
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
   SEMBRAR ADMIN INICIAL
   Solo la primera vez. Credenciales: admin / admin123
   ========================================================= */

async function sembrarAdminInicial() {
  try {
    const guardados = localStorage.getItem(CLAVE_USUARIOS);
    if (guardados) return;

    const passwordHash = await hashPassword("admin1408");

    const admin = {
      id: "USR-ADMIN-0001",
      nombre: "Administrador SIGPAS",
      usuario: "admin",
      email: "admin@sigpas.local",
      passwordHash,
      rol: "Administrador",
      activo: true,
      permisos: obtenerPermisosPorDefecto("Administrador"),
      fechaCreacion: new Date().toISOString(),
      ultimoAcceso: "",
    };

    localStorage.setItem(CLAVE_USUARIOS, JSON.stringify([admin]));
  } catch (error) {
    console.error("Error al sembrar admin inicial:", error);
  }
}

/* =========================================================
   PROVIDER
   ========================================================= */

export function AuthProvider({ children }) {
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      await sembrarAdminInicial();

      try {
        const guardados = JSON.parse(
          localStorage.getItem(CLAVE_USUARIOS) || "[]",
        );
        const lista = Array.isArray(guardados) ? guardados : [];
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
        console.error("Error al cargar usuarios/sesión:", error);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const guardarUsuarios = (lista) => {
    setUsuarios(lista);
    localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(lista));
  };

  /* =======================================================
     INICIAR SESIÓN
     ======================================================= */

  const iniciarSesion = async (nombreUsuario, password) => {
    const hash = await hashPassword(password);

    const encontrado = usuarios.find(
      (u) => u.usuario.toLowerCase() === nombreUsuario.toLowerCase().trim(),
    );

    if (!encontrado) {
      return { ok: false, error: "Usuario no encontrado." };
    }

    if (!encontrado.activo) {
      return { ok: false, error: "El usuario está inactivo." };
    }

    if (encontrado.passwordHash !== hash) {
      return { ok: false, error: "Contraseña incorrecta." };
    }

    const actualizados = usuarios.map((u) =>
      u.id === encontrado.id
        ? { ...u, ultimoAcceso: new Date().toISOString() }
        : u,
    );
    guardarUsuarios(actualizados);

    const usuarioSesion = actualizados.find((u) => u.id === encontrado.id);
    setUsuarioActual(usuarioSesion);
    localStorage.setItem(CLAVE_SESION, JSON.stringify(usuarioSesion.id));

    return { ok: true, usuario: usuarioSesion };
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
    const hash = await hashPassword(datos.password);

    const duplicado = usuarios.some(
      (u) => u.usuario.toLowerCase() === datos.usuario.toLowerCase().trim(),
    );
    if (duplicado) {
      return { ok: false, error: "El nombre de usuario ya existe." };
    }

    const nuevo = {
      id: `USR-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`,
      nombre: datos.nombre.trim(),
      usuario: datos.usuario.trim().toLowerCase(),
      email: datos.email?.trim() || "",
      passwordHash: hash,
      rol: datos.rol,
      activo: datos.activo !== false,
      permisos: { ...datos.permisos },
      fechaCreacion: new Date().toISOString(),
      ultimoAcceso: "",
    };

    guardarUsuarios([...usuarios, nuevo]);
    return { ok: true, usuario: nuevo };
  };

  const modificarUsuario = async (id, datos) => {
    const anterior = usuarios.find((u) => u.id === id);
    if (!anterior) {
      return { ok: false, error: "Usuario no encontrado." };
    }

    const duplicado = usuarios.some(
      (u) =>
        u.id !== id &&
        u.usuario.toLowerCase() === datos.usuario.toLowerCase().trim(),
    );
    if (duplicado) {
      return { ok: false, error: "El nombre de usuario ya existe." };
    }

    let passwordHash = anterior.passwordHash;
    if (datos.password && datos.password.trim()) {
      passwordHash = await hashPassword(datos.password);
    }

    const actualizado = {
      ...anterior,
      nombre: datos.nombre.trim(),
      usuario: datos.usuario.trim().toLowerCase(),
      email: datos.email?.trim() || "",
      passwordHash,
      rol: datos.rol,
      activo: datos.activo !== false,
      permisos: { ...datos.permisos },
    };

    const lista = usuarios.map((u) => (u.id === id ? actualizado : u));
    guardarUsuarios(lista);

    if (usuarioActual?.id === id) {
      setUsuarioActual(actualizado);
    }

    return { ok: true, usuario: actualizado };
  };

  const eliminarUsuario = (id) => {
    if (usuarioActual?.id === id) {
      return { ok: false, error: "No puedes eliminar tu propio usuario." };
    }

    const lista = usuarios.filter((u) => u.id !== id);
    guardarUsuarios(lista);
    return { ok: true };
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
