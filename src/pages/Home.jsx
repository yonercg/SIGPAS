import { Link, useNavigate } from "react-router-dom";
import "../App.css";

function Home() {
  const navigate = useNavigate();

  // Leemos directamente la sesión activa desde localStorage
  // (así no dependemos de que AuthContext exporte "usuario")
  const haySesion = Boolean(localStorage.getItem("sigpas_sesion"));

  const handleIniciar = () => {
    navigate(haySesion ? "/dashboard" : "/login");
  };

  return (
    <div className="app">
      <img src="/logo-emsa.png" alt="Logo EMSA" className="logo" />

      <h1>SIGPAS</h1>

      <h2>
        Sistema Integral de Gestión y Programación
        <br />
        de Actividades de Subestaciones
      </h2>

      <p className="empresa">Electrificadora del Meta S.A E S P</p>

      <div className="card">
        <h3>Bienvenido</h3>

        <p>
          Plataforma para la programación semanal de actividades, seguimiento e
          informes.
        </p>

        <button
          type="button"
          onClick={handleIniciar}
          className="home-btn-login"
        >
          {haySesion ? "Ir al sistema" : "Iniciar sesión"}
        </button>
      </div>
    </div>
  );
}

export default Home;
