import { useState } from "react";
import { Link } from "react-router-dom";
import "./Login.css";

const API_URL = "http://localhost:5000/api/auth/conductor-signup";

export default function ConductorSignup() {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (firstName.trim().length < 2 || firstName.trim().length > 50) return setError("Name must be between 2 and 50 characters.");
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) return setError("Enter a phone number with country code, e.g. +919876543210.");
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) return setError("Password must be at least 8 characters and at most 72 bytes.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: firstName.trim(), phone: phone.trim(), password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Signup failed.");
      setMessage(data.message || "Registration submitted. Please wait for Admin approval.");
      setFirstName(""); setPhone(""); setPassword(""); setConfirmPassword("");
    } catch (err) { setError(err.message || "Unable to submit registration."); }
    finally { setLoading(false); }
  }

  return <div className="login-page"><div className="login-card">
    <div className="login-logo">V</div><h1>Conductor Sign Up</h1>
    <p className="login-subtitle">Register to manage tickets and passenger crowd</p>
    {message ? <div className="signup-success" role="status"><p>{message}</p><p>Your account will remain pending until Admin approval.</p><Link className="signup-link" to="/conductor/login">Go to Conductor Login</Link></div> : <form onSubmit={handleSubmit}>
      <label htmlFor="conductor-name">Full Name</label><input id="conductor-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="name" maxLength={50} required />
      <label htmlFor="conductor-phone">Phone Number</label><input id="conductor-phone" type="tel" placeholder="+919876543210" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required />
      <label htmlFor="conductor-password">Password</label><input id="conductor-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
      <label htmlFor="conductor-confirm-password">Confirm Password</label><input id="conductor-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="login-button" disabled={loading}>{loading ? "Submitting..." : "Submit for Approval"}</button>
    </form>}
    <div className="signup-section"><span>Already registered?</span><Link className="signup-link" to="/conductor/login">Conductor Login</Link></div>
    <p className="login-footer">Smart Transport Management System</p>
  </div></div>;
}
