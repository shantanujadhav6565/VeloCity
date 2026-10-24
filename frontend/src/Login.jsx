
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Login.css";

const API_URL = "http://localhost:5000/api/auth/login";

export default function Login() {
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const successMessage = location.state?.message || "";

  const isAdminLogin = location.pathname === "/admin/login";
  const isConductorLogin =
    location.pathname === "/conductor/login";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const cleanName = firstName.trim();

    if (!cleanName || !password) {
      setError("Please enter your first name and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: cleanName,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      if (!data.token || !data.user) {
        throw new Error("Invalid response received from server.");
      }

      const role = data.user.role;

      console.log("Logged-in user:", data.user);
      console.log("Logged-in role:", role);
      console.log("Login page:", location.pathname);

      // Admin login accepts Admin accounts only.
      if (isAdminLogin && role !== "Admin") {
        setError("Access denied. Please use an Admin account.");
        return;
      }

      // Conductor login accepts Conductor accounts only.
      if (isConductorLogin && role !== "Conductor") {
        setError(
          "Access denied. Please use a Conductor account."
        );
        return;
      }

      // Clear any previous session in this tab.
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      // Save login details in this tab's session.
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      // Redirect according to the logged-in user's role.
      switch (role) {
        case "Admin":
          navigate("/admin", { replace: true });
          break;

        case "Driver":
          navigate("/driver", { replace: true });
          break;

        case "Passenger":
          navigate("/home", { replace: true });
          break;

        case "Conductor":
          navigate("/conductor", { replace: true });
          break;

        default:
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          setError("Your account role is not recognized.");
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Cannot connect to the server. Please check whether the backend is running."
        );
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = isAdminLogin
    ? "Admin Sign In"
    : isConductorLogin
    ? "Conductor Sign In"
    : "Sign in to your transport dashboard";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">V</div>

        <h1>VeloCity</h1>

        <p className="login-subtitle">{pageTitle}</p>

        {successMessage && (
          <p className="signup-success" role="status">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="firstName">First Name</label>

          <input
            id="firstName"
            type="text"
            placeholder="Enter your first name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {!isAdminLogin && !isConductorLogin && (
          <div className="signup-section">
            <span>Don't have an account?</span>

            <button
              type="button"
              className="signup-link"
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </button>
          </div>
        )}

        <p className="login-footer">
          Smart Transport Management System
        </p>
      </div>
    </div>
  );
}
