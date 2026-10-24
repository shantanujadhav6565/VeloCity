
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";

const API_URL = "http://localhost:5000/api/auth/register";

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanName = firstName.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanPhone || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (cleanName.length < 2 || cleanName.length > 50) {
      setError("First name must be between 2 and 50 characters.");
      return;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
      setError(
        "Enter phone number with country code, e.g. +919876543210."
      );
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must not exceed 72 bytes.");
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
          phone: cleanPhone,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Signup failed.");
      }

      setMessage("Account created successfully! Redirecting to Login...");

      setTimeout(() => {
        navigate("/login", {
          state: {
            message: "Account created successfully. Please log in.",
            phone: cleanPhone,
          },
        });
      }, 1000);
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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">T</div>

        <h1>TransitPulse</h1>

        <p className="login-subtitle">
          Create your Passenger account
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-firstname">First Name</label>
          <input
            id="signup-firstname"
            type="text"
            placeholder="Enter your first name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            maxLength={50}
            required
          />

          <label htmlFor="signup-phone">Phone Number</label>
          <input
            id="signup-phone"
            type="tel"
            placeholder="+919876543210"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            required
          />

          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="signup-success" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="signup-section">
          <span>Already have an account?</span>
          <Link className="signup-link" to="/login">
            Login
          </Link>
        </div>

        <p className="login-footer">
          Smart Transport Management System
        </p>
      </div>
    </div>
  );
}
