import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { obtenerPrimeraRutaPermitida } from "../data/permisos";
import "./login.css";

export default function Login() {
  const navigate = useNavigate();
  const { iniciarSesion, usuarioActual } = useAuth();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Si ya hay sesión activa, redirige automáticamente.
  if (usuarioActual) {
    navigate(obtenerPrimeraRutaPermitida(usuarioActual.permisos), {
      replace: true,
    });
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setCargando(true);

    const resultado = await iniciarSesion(usuario, password);

    setCargando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    navigate(obtenerPrimeraRutaPermitida(resultado.usuario.permisos), {
      replace: true,
    });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/logo-emsa.png" alt="EMSA" className="login-logo" />

        <h1>SIGPAS</h1>

        <p className="login-subtitulo">Iniciar sesión</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-campo">
            <span>Usuario</span>

            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
          </label>

          <label className="login-campo">
            <span>Contraseña</span>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={cargando}>
            {cargando ? "Verificando…" : "Entrar"}
          </button>
        </form>

        <Link to="/" className="login-volver">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
