
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_URL = "http://localhost:5000/api/auth/login";

export default function DriverLogin() {
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const cleanName = firstName.trim();

    if (!cleanName || !password) {
      setError("Please enter your name and password.");
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
        throw new Error(data.message || "Driver login failed.");
      }

      if (!data.token || !data.user) {
        throw new Error(
          "Login response is missing account details."
        );
      }

      // Allow only Driver accounts on this page.
      if (data.user.role !== "Driver") {
        throw new Error(
          "This login page is only for Drivers."
        );
      }

      // Clear any previous login session.
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      // Store the current Driver session.
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // Open Driver Dashboard.
      navigate("/driver", { replace: true });
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Cannot connect to server. Please check whether the backend is running."
        );
      } else {
        setError(
          err.message || "Something went wrong."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">T</div>

        <h1>Driver Login</h1>

        <p className="login-subtitle">
          Sign in to your TransitPulse driver account
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="driverLoginName">
            Full Name
          </label>

          <input
            id="driverLoginName"
            type="text"
            placeholder="Enter your registered name"
            value={firstName}
            onChange={(event) =>
              setFirstName(event.target.value)
            }
            autoComplete="username"
            required
          />

          <label htmlFor="driverLoginPassword">
            Password
          </label>

          <input
            id="driverLoginPassword"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
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
            {loading
              ? "Logging in..."
              : "Login as Driver"}
          </button>
        </form>

        <div className="signup-section">
          <span>Not registered yet?</span>

          <button
            type="button"
            className="signup-link"
            onClick={() => navigate("/driver/signup")}
          >
            Driver Sign Up
          </button>
        </div>

        <button
          type="button"
          className="signup-link"
          onClick={() => navigate("/")}
        >
          Back to Role Selection
        </button>

        <p className="login-footer">
          Smart Transport Management System
        </p>
      </div>
    </div>
  );
}
