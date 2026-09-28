import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  PAGINAS,
  ROLES_LISTA,
  obtenerPermisosPorDefecto,
} from "../data/permisos";
import "./Usuarios.css";

/* =========================================================
   FORMULARIO VACÍO
   ========================================================= */

const formVacio = () => ({
  id: null,
  nombre: "",
  usuario: "",
  email: "",
  password: "",
  confirmar: "",
  rol: "Consulta",
  activo: true,
  permisos: obtenerPermisosPorDefecto("Consulta"),
});

export default function Usuarios() {
  const {
    usuarios,
    usuarioActual,
    agregarUsuario,
    modificarUsuario,
    eliminarUsuario,
  } = useAuth();

  const [formulario, setFormulario] = useState(formVacio());
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [paraEliminar, setParaEliminar] = useState(null);

  /* =========================================================
     ABRIR NUEVO
     ========================================================= */

  const abrirNuevo = () => {
    setFormulario(formVacio());
    setModoEdicion(false);
    setErrorForm("");
    setMostrarModal(true);
  };

  /* =========================================================
     ABRIR EDITAR
     ========================================================= */

  const abrirEditar = (usuario) => {
    setFormulario({
      id: usuario.id,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      email: usuario.email || "",
      password: "",
      confirmar: "",
      rol: usuario.rol,
      activo: usuario.activo !== false,
      permisos: { ...usuario.permisos },
    });
    setModoEdicion(true);
    setErrorForm("");
    setMostrarModal(true);
  };

  /* =========================================================
     CERRAR MODAL
     ========================================================= */

  const cerrarModal = () => {
    setMostrarModal(false);
    setFormulario(formVacio());
    setModoEdicion(false);
    setErrorForm("");
  };

  /* =========================================================
     CAMBIAR CAMPOS
     ========================================================= */

  const cambiarCampo = (campo, valor) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
  };

  const cambiarRol = (nuevoRol) => {
    setFormulario((prev) => ({
      ...prev,
      rol: nuevoRol,
      // Al cambiar el rol, se autocompletan los permisos por defecto.
      // El admin igual puede ajustarlos después manualmente.
      permisos: obtenerPermisosPorDefecto(nuevoRol),
    }));
  };

  const alternarPermiso = (paginaKey) => {
    setFormulario((prev) => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [paginaKey]: !prev.permisos[paginaKey],
      },
    }));
  };

  /* =========================================================
     VALIDAR Y GUARDAR
     ========================================================= */

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorForm("");

    if (!formulario.nombre.trim()) {
      setErrorForm("El nombre es obligatorio.");
      return;
    }

    if (!formulario.usuario.trim()) {
      setErrorForm("El nombre de usuario es obligatorio.");
      return;
    }

    if (!modoEdicion && !formulario.password.trim()) {
      setErrorForm("La contraseña es obligatoria.");
      return;
    }

    if (formulario.password && formulario.password !== formulario.confirmar) {
      setErrorForm("Las contraseñas no coinciden.");
      return;
    }

    if (formulario.password && formulario.password.length < 4) {
      setErrorForm("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    setGuardando(true);

    const datos = {
      nombre: formulario.nombre,
      usuario: formulario.usuario,
      email: formulario.email,
      password: formulario.password,
      rol: formulario.rol,
      activo: formulario.activo,
      permisos: formulario.permisos,
    };

    let resultado;

    if (modoEdicion) {
      resultado = await modificarUsuario(formulario.id, datos);
    } else {
      resultado = await agregarUsuario(datos);
    }

    setGuardando(false);

    if (!resultado.ok) {
      setErrorForm(resultado.error);
      return;
    }

    cerrarModal();
  };

  /* =========================================================
     ELIMINAR
     ========================================================= */

  const confirmarEliminar = () => {
    if (!paraEliminar) return;

    const resultado = eliminarUsuario(paraEliminar.id);

    if (!resultado.ok) {
      alert(resultado.error);
      setParaEliminar(null);
      return;
    }

    setParaEliminar(null);
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="usuarios-page">
      {/* ================================================= */}
      {/* ENCABEZADO                                        */}
      {/* ================================================= */}

      <div className="usuarios-title-card">
        <div className="usuarios-header">
          <div>
            <h1>Usuarios</h1>
            <p>Gestión de accesos y permisos del sistema.</p>
          </div>

          <button
            type="button"
            className="usuarios-btn-nuevo"
            onClick={abrirNuevo}
          >
            + Nuevo usuario
          </button>
        </div>
      </div>

      {/* ================================================= */}
      {/* TABLA                                             */}
      {/* ================================================= */}

      <div className="usuarios-card">
        <div className="usuarios-tabla-contenedor">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan="7" className="usuarios-vacio">
                    No hay usuarios registrados.
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.nombre}</strong>
                      {u.id === usuarioActual?.id && (
                        <span className="usuarios-yo"> (tú)</span>
                      )}
                    </td>
                    <td>{u.usuario}</td>
                    <td>{u.email || "—"}</td>
                    <td>
                      <span className="usuarios-rol">{u.rol}</span>
                    </td>
                    <td>
                      <span
                        className={`usuarios-estado ${
                          u.activo ? "activo" : "inactivo"
                        }`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      {u.ultimoAcceso
                        ? new Date(u.ultimoAcceso).toLocaleString("es-CO")
                        : "—"}
                    </td>
                    <td>
                      <div className="usuarios-acciones">
                        <button
                          type="button"
                          className="usuarios-btn-editar"
                          onClick={() => abrirEditar(u)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="usuarios-btn-eliminar"
                          onClick={() => setParaEliminar(u)}
                          disabled={u.id === usuarioActual?.id}
                          title={
                            u.id === usuarioActual?.id
                              ? "No puedes eliminar tu propio usuario"
                              : "Eliminar usuario"
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================= */}
      {/* MODAL CREAR / EDITAR                              */}
      {/* ================================================= */}

      {mostrarModal && (
        <div className="usuarios-overlay" onClick={cerrarModal}>
          <div className="usuarios-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usuarios-modal-header">
              <div>
                <span className="usuarios-modal-etiqueta">
                  {modoEdicion ? "EDITAR USUARIO" : "NUEVO USUARIO"}
                </span>

                <h2>
                  {modoEdicion
                    ? formulario.nombre || "Editar usuario"
                    : "Registrar usuario"}
                </h2>
              </div>

              <button
                type="button"
                className="usuarios-modal-cerrar"
                onClick={cerrarModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="usuarios-form">
              <div className="usuarios-grid">
                <div className="usuarios-campo">
                  <label>Nombre completo *</label>
                  <input
                    type="text"
                    value={formulario.nombre}
                    onChange={(e) => cambiarCampo("nombre", e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    required
                  />
                </div>

                <div className="usuarios-campo">
                  <label>Usuario *</label>
                  <input
                    type="text"
                    value={formulario.usuario}
                    onChange={(e) => cambiarCampo("usuario", e.target.value)}
                    placeholder="Ej. jperez"
                    required
                  />
                </div>

                <div className="usuarios-campo usuarios-campo-full">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formulario.email}
                    onChange={(e) => cambiarCampo("email", e.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="usuarios-campo">
                  <label>
                    Contraseña{" "}
                    {modoEdicion ? "(dejar en blanco para no cambiar)" : "*"}
                  </label>
                  <input
                    type="password"
                    value={formulario.password}
                    onChange={(e) => cambiarCampo("password", e.target.value)}
                    placeholder="Mín. 4 caracteres"
                  />
                </div>

                <div className="usuarios-campo">
                  <label>Confirmar contraseña</label>
                  <input
                    type="password"
                    value={formulario.confirmar}
                    onChange={(e) => cambiarCampo("confirmar", e.target.value)}
                    placeholder="Repetir contraseña"
                  />
                </div>

                <div className="usuarios-campo">
                  <label>Rol</label>
                  <select
                    value={formulario.rol}
                    onChange={(e) => cambiarRol(e.target.value)}
                  >
                    {ROLES_LISTA.map((rol) => (
                      <option key={rol} value={rol}>
                        {rol}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="usuarios-campo usuarios-campo-checkbox">
                  <label className="usuarios-check">
                    <input
                      type="checkbox"
                      checked={formulario.activo}
                      onChange={(e) => cambiarCampo("activo", e.target.checked)}
                    />
                    <span>Usuario activo</span>
                  </label>
                </div>
              </div>

              {/* ============================================= */}
              {/* PERMISOS                                      */}
              {/* ============================================= */}

              <div className="usuarios-permisos">
                <div className="usuarios-permisos-header">
                  <span>Permisos de acceso</span>
                  <small>Marque las páginas que este usuario podrá ver.</small>
                </div>

                <div className="usuarios-permisos-grid">
                  {PAGINAS.map((pagina) => (
                    <label key={pagina.key} className="usuarios-permiso">
                      <input
                        type="checkbox"
                        checked={Boolean(formulario.permisos[pagina.key])}
                        onChange={() => alternarPermiso(pagina.key)}
                      />
                      <span>{pagina.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {errorForm && <div className="usuarios-error">{errorForm}</div>}

              <div className="usuarios-modal-footer">
                <button
                  type="button"
                  className="usuarios-btn-cancelar"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="usuarios-btn-guardar"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando…"
                    : modoEdicion
                      ? "Guardar cambios"
                      : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL CONFIRMAR ELIMINAR                          */}
      {/* ================================================= */}

      {paraEliminar && (
        <div className="usuarios-overlay" onClick={() => setParaEliminar(null)}>
          <div
            className="usuarios-modal usuarios-modal-confirmar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="usuarios-confirmar-icono">⚠️</div>
            <h2>¿Eliminar usuario?</h2>
            <p>
              Se eliminará <strong>{paraEliminar.nombre}</strong> y no podrá
              ingresar al sistema. Esta acción no se puede deshacer.
            </p>
            <div className="usuarios-confirmar-botones">
              <button
                type="button"
                className="usuarios-btn-cancelar"
                onClick={() => setParaEliminar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="usuarios-btn-eliminar-fuerte"
                onClick={confirmarEliminar}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
