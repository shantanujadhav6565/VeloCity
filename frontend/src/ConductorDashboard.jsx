import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ConductorDashboard.css";

const API_URL = "http://localhost:5000/api";

function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getToken() {
  return sessionStorage.getItem("token");
}

export default function ConductorDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    const token = getToken();

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Replace this endpoint with your actual conductor profile endpoint.
      const response = await fetch(`${API_URL}/conductors/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load conductor profile."
        );
      }

      setProfile(data.conductor || data.profile || data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <section className="conductor-dashboard">
        <div className="conductor-card">
          <p>Loading your conductor dashboard...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="conductor-dashboard">
      <header className="conductor-header">
        <div>
          <span className="conductor-eyebrow">
            VELOCITY • SMART TRANSIT
          </span>
          <h1>Conductor Dashboard</h1>
          <p>Manage your conductor profile and duty information.</p>
        </div>

        <button
          type="button"
          className="conductor-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      {error && (
        <div className="conductor-error" role="alert">
          <p>{error}</p>
          <p>
            The dashboard needs a working GET /api/conductors/me
            backend endpoint to load your profile.
          </p>
          <button type="button" onClick={fetchProfile}>
            Try Again
          </button>
        </div>
      )}

      <div className="conductor-welcome">
        <div className="conductor-avatar">
          {(profile?.name || user?.firstName || "C")
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <span>WELCOME BACK</span>
          <h2>
            {profile?.name || user?.firstName || "Conductor"}
          </h2>
          <p>Your VeloCity conductor workspace.</p>
        </div>
      </div>

      <div className="conductor-grid">
        <article className="conductor-card">
          <span className="conductor-card-label">
            CONDUCTOR CODE
          </span>
          <h3>{profile?.conductorCode || "Not available"}</h3>
          <p>Your registered conductor identification.</p>
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">
            PHONE NUMBER
          </span>
          <h3>{profile?.phone || user?.phone || "Not available"}</h3>
          <p>Your registered contact number.</p>
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">
            DUTY STATUS
          </span>
          <h3>{profile?.status || "Not available"}</h3>
          <p>Your current recorded duty status.</p>
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">
            ASSIGNED BUS
          </span>
          <h3>
            {profile?.assignedBus?.busNumber ||
              profile?.bus?.busNumber ||
              "No bus assigned"}
          </h3>
          <p>
            {profile?.assignedBus?.route ||
              profile?.bus?.route ||
              "Bus assignment information is not available."}
          </p>
        </article>
      </div>

      <div className="conductor-card conductor-duty-card">
        <span className="conductor-card-label">DUTY INFORMATION</span>
        <h2>Your duty at a glance</h2>
        <p>
          Your assigned bus and duty details will appear here when
          the backend provides them.
        </p>
        <button
          type="button"
          className="conductor-refresh"
          onClick={fetchProfile}
        >
          Refresh Information
        </button>
      </div>
    </section>
  );
}