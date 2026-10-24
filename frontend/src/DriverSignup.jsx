
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API_URL = "http://localhost:5000/api/auth/driver-signup";

export default function DriverSignup() {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (cleanName.length < 2 || cleanName.length > 50) {
      setError("Name must be between 2 and 50 characters.");
      return;
    }

    // International phone number, including country code.
    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
      setError(
        "Enter phone number with country code, e.g. +919876543210."
      );
      return;
    }

    const passwordBytes = new TextEncoder().encode(password).length;

    if (password.length < 8 || passwordBytes > 72) {
      setError(
        "Password must be at least 8 characters and at most 72 bytes."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
        throw new Error(
          data.message || "Driver signup failed."
        );
      }

      setMessage(
        data.message ||
          "Registration submitted. Please wait for Admin approval."
      );

      setFirstName("");
      setPhone("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Driver signup error:", err);

      if (err instanceof TypeError) {
        setError(
          "Cannot connect to the server. Check whether the backend is running."
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

        <h1>Driver Sign Up</h1>

        <p className="login-subtitle">
          Register to join TransitPulse
        </p>

        {message && (
          <div className="signup-success" role="status">
            <p>{message}</p>
            <p>
              Your account will remain pending until Admin approval.
            </p>

            <button
              type="button"
              className="login-button"
              onClick={() => navigate("/driver/login")}
            >
              Go to Driver Login
            </button>
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="driverName">Full Name</label>
            <input
              id="driverName"
              type="text"
              placeholder="Enter your full name"
              value={firstName}
              onChange={(event) =>
                setFirstName(event.target.value)
              }
              autoComplete="name"
              required
            />

            <label htmlFor="driverPhone">Phone Number</label>
            <input
              id="driverPhone"
              type="tel"
              placeholder="+919876543210"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              autoComplete="tel"
              required
            />

            <label htmlFor="driverPassword">Password</label>
            <input
              id="driverPassword"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="new-password"
              required
            />

            <label htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              autoComplete="new-password"
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
              {loading ? "Submitting..." : "Submit for Approval"}
            </button>
          </form>
        )}

        {!message && (
          <div className="signup-section">
            <span>Already registered?</span>
            <button
              type="button"
              className="signup-link"
              onClick={() => navigate("/driver/login")}
            >
              Driver Login
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
