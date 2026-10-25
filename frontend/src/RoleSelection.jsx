import { useState } from "react";
import { useNavigate } from "react-router-dom";

const iconPaths = {
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z",
  star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2 2 9.3l6.9-1z",
  settings: "M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3h-4l-.4 2.9a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.6a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1L11 21h4l.4-2.9a8 8 0 0 0 1.7-1l2.4 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
  shield: "M12 2 3 6v5c0 5.2 3.8 10 9 11 5.2-1 9-5.8 9-11V6zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9z",
  bus: "M12 2c-4.4 0-8 .5-8 4v10c0 1.1.9 2 2 2v2h2v-2h8v2h2v-2c1.1 0 2-.9 2-2V6c0-3.5-3.6-4-8-4zm-5 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm1-5H6V6h12z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z",
  wheel: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 0 1 7.7 6h-4.2a4 4 0 0 0-7 0H4.3A8 8 0 0 1 12 4zm0 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-7.7 0h3.8a4 4 0 0 0 2.9 3.8l-1.3 3.5A8 8 0 0 1 4.3 12zm9.7 7.3-1.3-3.5a4 4 0 0 0 2.9-3.8h3.8a8 8 0 0 1-5.4 7.3z",
  conductor: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c0-3.2 3.1-5.5 7-5.5s7 2.3 7 5.5v1H5zm2-12h10V6H7zm2-3h6V3H9z",
  people: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-6 1.3-6 4v2h12v-2c0-2.7-3.3-4-6-4zm8 .2c-.4 0-.9 0-1.4.1 1.2.9 2 2.1 2 3.7V19h5v-2c0-2.6-3-3.8-5.6-3.8z",
  leaf: "M20 4c-8 0-14 3.3-14 10a6 6 0 0 0 6 6c6.7 0 10-6 8-16zM5 21c2-5 5-8 10-11-4 1-8 4-11 9z",
  sun: "M12 4V2m0 20v-2m10-8h-2M4 12H2m17.1 7.1-1.4-1.4M6.3 6.3 4.9 4.9m14.2 0-1.4 1.4M6.3 17.7l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  moon: "M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5z",
};

function Icon({ name, size = 20 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d={iconPaths[name]} /></svg>;
}

function RoleSelection({ theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("");

  const handleRoleClick = (role) => {
    if (role === "Admin") {
      navigate("/admin/login");
      return;
    }

    setSelectedRole((current) =>
      current === role ? "" : role
    );
  };

  const handleLogin = () => {
    const routes = {
      Passenger: "/login",
      Driver: "/driver/login",
      Conductor: "/conductor/login",
    };

    if (routes[selectedRole]) {
      navigate(routes[selectedRole]);
    }
  };

  const handleSignup = () => {
    const routes = {
      Passenger: "/signup",
      Driver: "/driver/signup",
      Conductor: "/conductor/signup",
    };

    if (routes[selectedRole]) {
      navigate(routes[selectedRole]);
    }
  };

  const roles = [
    {
      name: "Passenger",
      icon: "user",
      tag: "FOR TRAVELLERS",
      description: "Book tickets, track buses, plan your journey.",
      login: "Passenger Login",
      signup: "Create Passenger Account",
      className: "passenger",
    },
    {
      name: "Driver",
      icon: "wheel",
      tag: "FOR DRIVERS",
      description: "Manage your trips, accept ride requests.",
      login: "Driver Login",
      signup: "Driver Sign Up",
      className: "driver",
    },
    {
      name: "Conductor",
      icon: "conductor",
      tag: "BUS OPERATIONS",
      description: "Validate tickets, manage passengers.",
      login: "Conductor Login",
      signup: "Conductor Sign Up",
      className: "conductor",
    },
  ];

  return (
    <div className="welcome-page">
      <img
        className="welcome-scene-image"
        src="/images/velocity-bus.png"
        alt="VeloCity blue public transport bus at a modern city stop"
        fetchPriority="high"
      />

      {/* HEADER */}
      <header className="welcome-topbar">
        <a
          href="#home"
          className="welcome-brand"
          aria-label="VeloCity home"
        >
          <span className="welcome-brand-icon" aria-hidden="true"><i /><i /><i /></span>

          <span className="welcome-brand-text">
            Velo<strong>City</strong>
            <small>
              Smart Transport • Better Tomorrow
            </small>
          </span>
        </a>

        <nav
          className="welcome-nav"
          aria-label="Main navigation"
        >
          {/* <a className="active" href="#home">
            <Icon name="home" size={17} /> Home
          </a> */}
          {/* <a href="#about"><Icon name="info" size={17} /> About</a>
          <a href="#features"><Icon name="star" size={17} /> Features</a>
          <a href="#how-it-works"><Icon name="settings" size={17} /> How It Works</a>
          <a href="#benefits"><Icon name="shield" size={17} /> Benefits</a> */}
        </nav>

        <button
          type="button"
          className="welcome-theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${
            theme === "light" ? "dark" : "light"
          } mode`}
          title="Toggle theme"
        >
          <Icon name="sun" size={15} />
          <span className="welcome-theme-switch" aria-hidden="true"><i className={theme === "dark" ? "is-dark" : ""} /></span>
          <Icon name="moon" size={15} />
        </button>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="welcome-hero" id="home">
          <div className="welcome-hero-content">
            <span className="welcome-eyebrow">
              <Icon name="bus" size={16} /> SMART BUS TRACKING&nbsp; • &nbsp;REAL-TIME UPDATES&nbsp; • &nbsp;SAFER JOURNEYS
            </span>

            <h1>
              Welcome to
              <br />
              <span>VeloCity</span>
            </h1>

            <p className="welcome-description" id="about">
              VeloCity is a smart and reliable public transport platform that connects passengers, conductors, drivers and administrators. It makes your daily commute easier, safer and more efficient.
            </p>

            {/* FEATURES */}
            <div
              className="welcome-features"
              id="features"
            >
              <article className="welcome-feature">
                <span className="welcome-feature-icon"><Icon name="bus" size={24} /></span>
                <h3>Live Tracking</h3>
                <p>
                  Track buses in real time on the map.
                </p>
              </article>

              <article className="welcome-feature">
                <span className="welcome-feature-icon"><Icon name="shield" size={24} /></span>
                <h3>Secure &amp; Reliable</h3>
                <p>
                  Safe rides with verified drivers and conductors.
                </p>
              </article>

              <article className="welcome-feature">
                <span className="welcome-feature-icon"><Icon name="people" size={24} /></span>
                <h3>Easy Booking</h3>
                <p>
                  Book tickets quickly and conveniently.
                </p>
              </article>

              <article className="welcome-feature">
                <span className="welcome-feature-icon eco-icon"><Icon name="leaf" size={24} /></span>
                <h3>Eco Friendly</h3>
                <p>
                  Greener cities, cleaner tomorrow.
                </p>
              </article>
            </div>

          </div>

          {/* BUS IMAGE */}
          <div className="welcome-hero-visual">
            {/* <div className="welcome-visual-label">
              Smart Buses
              <br />
              <span>Smarter Cities</span>
            </div> */}

          </div>
        </section>

        {/* ROLE SELECTION */}
        <section
          className="welcome-roles-section"
          id="roles"
        >
          <div className="welcome-section-heading">
            <span id="how-it-works">GET STARTED</span>
            <h2>Choose Your Role</h2>
            <p>
              Select your role to continue to the VeloCity platform.
            </p>
          </div>

          <div className="welcome-role-grid">
            {roles.map((role) => (
              <article
                key={role.name}
                className={`welcome-role-card ${
                  role.className
                }-card ${
                  selectedRole === role.name
                    ? "role-selected"
                    : ""
                }`}
              >
                <div
                  className={`welcome-role-icon ${
                    role.className
                  }-icon`}
                >
                  <Icon name={role.icon} size={29} />
                </div>

                <span className="welcome-role-tag">
                  {role.tag}
                </span>

                <h3>{role.name}</h3>

                <p className="welcome-role-description">
                  {role.description}
                </p>

                <button
                  type="button"
                  className="welcome-primary-btn"
                  onClick={() =>
                    handleRoleClick(role.name)
                  }
                  aria-expanded={
                    selectedRole === role.name
                  }
                >
                  {selectedRole === role.name ? "Close Options" : "Continue"}

                  <span>
                    {selectedRole === role.name
                      ? "↑"
                      : "→"}
                  </span>
                </button>

                {selectedRole === role.name && (
                  <div className="welcome-auth-options">
                    <p>
                      How would you like to continue?
                    </p>

                    <button
                      type="button"
                      className="welcome-primary-btn"
                      onClick={handleLogin}
                    >
                      {role.login} <span>→</span>
                    </button>

                    <button
                      type="button"
                      className="welcome-secondary-btn"
                      onClick={handleSignup}
                    >
                      {role.signup}
                    </button>

                    {role.name !== "Passenger" && (
                      <small>
                        {role.name === "Driver"
                          ? "Driver access may require admin approval."
                          : "Use your registered conductor account."}
                      </small>
                    )}
                  </div>
                )}
              </article>
            ))}

            {/* ADMIN CARD */}
            <article className="welcome-role-card admin-role-card">
              <div className="welcome-role-icon admin-icon">
                  <Icon name="settings" size={29} />
              </div>

              <span className="welcome-role-tag">
                SYSTEM CONTROL
              </span>

              <h3>Admin</h3>

              <p className="welcome-role-description">
                Manage system, users, and operations.
              </p>

              <button
                type="button"
                className="welcome-admin-btn"
                onClick={() => handleRoleClick("Admin")}
                >
                Continue <span>→</span>
              </button>

            </article>
          </div>

          <div className="welcome-admin-access"><i /><Icon name="shield" size={18} /> <span>Admin Access</span> <i /></div>
        </section>

        {/* STATS */}
        <section
          className="welcome-stats"
          aria-label="Illustrative platform statistics, not live operational data"
          id="benefits"
        >
          <div className="welcome-stat">
            <span><Icon name="people" size={31} /></span>
            <div>
              <strong>10K+</strong>
              <small>Happy Passengers</small>
            </div>
          </div>

          <div className="welcome-stat">
            <span><Icon name="bus" size={31} /></span>
            <div>
              <strong>500+</strong>
              <small>Active Buses</small>
            </div>
          </div>

          <div className="welcome-stat">
            <span><Icon name="shield" size={31} /></span>
            <div>
              <strong>99%</strong>
              <small>On-Time Performance</small>
            </div>
          </div>

          <div className="welcome-stat">
            <span><Icon name="leaf" size={31} /></span>
            <div>
              <strong>4.8/5</strong>
              <small>Customer Satisfaction</small>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="welcome-footer">
        <span className="welcome-footer-brand">
          VeloCity
        </span>

        <span>Smarter journeys start here.</span>

        <span>
          © {new Date().getFullYear()} VeloCity Smart Transport
        </span>
      </footer>
    </div>
  );
}

export default RoleSelection;
