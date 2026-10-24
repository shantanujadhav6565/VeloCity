
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./App.css";

function RoleSelection() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState("");

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("velocity-theme") === "dark"
      ? "dark"
      : "light";
  });

  // Apply and save theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("velocity-theme", theme);
  }, [theme]);

  // Toggle light and dark theme
  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === "light" ? "dark" : "light"
    );
  };

  // Select role
  const handleRoleClick = (role) => {
    if (role === "Admin") {
      navigate("/admin/login");
      return;
    }

    setSelectedRole((currentRole) =>
      currentRole === role ? "" : role
    );
  };

  // Login navigation
  const handleLogin = () => {
    if (selectedRole === "Passenger") {
      navigate("/login");
    } else if (selectedRole === "Driver") {
      navigate("/driver/login");
    } else if (selectedRole === "Conductor") {
      navigate("/conductor/login");
    }
  };

  // Signup navigation
  const handleSignup = () => {
    if (selectedRole === "Passenger") {
      navigate("/signup");
    } else if (selectedRole === "Driver") {
      navigate("/driver/signup");
    } else if (selectedRole === "Conductor") {
      navigate("/conductor/signup");
    }
  };

  return (
    <div className="welcome-page">
      {/* HEADER */}
      <header className="welcome-topbar">
        <div className="welcome-brand">
          <span className="welcome-brand-icon">V</span>

          <span>
            Velo<strong>City</strong>
            <small>SMART TRANSIT SYSTEM</small>
          </span>
        </div>

        {/* THEME TOGGLE */}
        <button
          type="button"
          className="welcome-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${
            theme === "light" ? "dark" : "light"
          } mode`}
          title="Change website appearance"
        >
          <span>{theme === "light" ? "🌙" : "☀️"}</span>
          <span>
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </span>
        </button>
      </header>

      {/* MAIN CONTENT */}
      <main className="welcome-main">
        <div className="welcome-heading">
          <span className="welcome-eyebrow">
            YOUR JOURNEY, CONNECTED
          </span>

          <h1>
            Welcome to <span>VeloCity.</span>
          </h1>

          <p>
            Smart bus tracking and a simpler travel experience.
            Choose how you want to continue.
          </p>
        </div>

        {/* ROLE CARDS */}
        <div className="welcome-role-grid">
          {/* PASSENGER CARD */}
          <article
            className={`welcome-role-card ${
              selectedRole === "Passenger" ? "role-selected" : ""
            }`}
          >
            <div className="welcome-role-icon passenger-icon">
              <span>♙</span>
            </div>

            <span className="welcome-role-tag">FOR TRAVELLERS</span>

            <h2>Passenger</h2>

            <p>
              Find buses, check routes and track your journey.
            </p>

            <button
              type="button"
              className="welcome-primary-btn"
              onClick={() => handleRoleClick("Passenger")}
              aria-expanded={selectedRole === "Passenger"}
            >
              {selectedRole === "Passenger"
                ? "Close Options"
                : "Continue as Passenger"}

              <span>
                {selectedRole === "Passenger" ? "↑" : "→"}
              </span>
            </button>

            {selectedRole === "Passenger" && (
              <div className="welcome-auth-options">
                <p>How would you like to continue?</p>

                <button
                  type="button"
                  className="welcome-primary-btn"
                  onClick={handleLogin}
                >
                  Passenger Login <span>→</span>
                </button>

                <button
                  type="button"
                  className="welcome-secondary-btn"
                  onClick={handleSignup}
                >
                  Create Passenger Account
                </button>
              </div>
            )}
          </article>

          {/* DRIVER CARD */}
          <article
            className={`welcome-role-card ${
              selectedRole === "Driver" ? "role-selected" : ""
            }`}
          >
            <div className="welcome-role-icon driver-icon">
              <span>🚌</span>
            </div>

            <span className="welcome-role-tag">FOR DRIVERS</span>

            <h2>Driver</h2>

            <p>
              Register as a driver and manage your assigned bus.
            </p>

            <button
              type="button"
              className="welcome-primary-btn"
              onClick={() => handleRoleClick("Driver")}
              aria-expanded={selectedRole === "Driver"}
            >
              {selectedRole === "Driver"
                ? "Close Options"
                : "Continue as Driver"}

              <span>
                {selectedRole === "Driver" ? "↑" : "→"}
              </span>
            </button>

            {selectedRole === "Driver" && (
              <div className="welcome-auth-options">
                <p>How would you like to continue?</p>

                <button
                  type="button"
                  className="welcome-primary-btn"
                  onClick={handleLogin}
                >
                  Driver Login <span>→</span>
                </button>

                <button
                  type="button"
                  className="welcome-secondary-btn"
                  onClick={handleSignup}
                >
                  Driver Sign Up
                </button>

                <small>
                  Driver access may require admin approval.
                </small>
              </div>
            )}
          </article>

          {/* CONDUCTOR CARD */}
          <article
            className={`welcome-role-card ${
              selectedRole === "Conductor" ? "role-selected" : ""
            }`}
          >
            <div className="welcome-role-icon conductor-icon">
              <span>🎫</span>
            </div>

            <span className="welcome-role-tag">
              BUS OPERATIONS
            </span>

            <h2>Conductor</h2>

            <p>
              Access your conductor account and manage your assigned
              bus journey.
            </p>

            <button
              type="button"
              className="welcome-primary-btn"
              onClick={() => handleRoleClick("Conductor")}
              aria-expanded={selectedRole === "Conductor"}
            >
              {selectedRole === "Conductor"
                ? "Close Options"
                : "Continue as Conductor"}

              <span>
                {selectedRole === "Conductor" ? "↑" : "→"}
              </span>
            </button>

            {selectedRole === "Conductor" && (
              <div className="welcome-auth-options">
                <p>How would you like to continue?</p>

                <button
                  type="button"
                  className="welcome-primary-btn"
                  onClick={handleLogin}
                >
                  Conductor Login <span>→</span>
                </button>

                <button
                  type="button"
                  className="welcome-secondary-btn"
                  onClick={handleSignup}
                >
                  Conductor Sign Up
                </button>

                <small>
                  Use your registered conductor account to log in.
                </small>
              </div>
            )}
          </article>

          {/* ADMIN CARD */}
          <article className="welcome-role-card admin-role-card">
            <div className="welcome-role-icon admin-icon">
              <span>🛡️</span>
            </div>

            <span className="welcome-role-tag">SYSTEM CONTROL</span>

            <h2>Admin</h2>

            <p>
              Manage buses, driver assignments and system activity.
            </p>

            <button
              type="button"
              className="welcome-admin-btn"
              onClick={() => handleRoleClick("Admin")}
            >
              Admin Login <span>→</span>
            </button>

            <div className="welcome-admin-note">
              <span>●</span>
              Authorized administrators only
            </div>
          </article>
        </div>

        {/* FOOTER */}
        <footer className="welcome-footer">
          <span>VELOCITY</span>
          <span>Smarter journeys start here.</span>
        </footer>
      </main>
    </div>
  );
}

export default RoleSelection;
