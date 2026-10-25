
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddBus.css";

const API_URL = "http://localhost:5000/api/buses";

const initialForm = {
  busNumber: "",
  source: "",
  destination: "",
  route: "",
  busImage: "",
  sourceLatitude: "",
  sourceLongitude: "",
  destinationLatitude: "",
  destinationLongitude: "",
};

export default function AddBus() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    // Token from sessionStorage first, then localStorage
    const token =
      sessionStorage.getItem("token") ||
      localStorage.getItem("token");

    if (!token) {
      setError("Please login as Admin first.");
      return;
    }

    // Check the logged-in user's role
    let user = null;

    try {
      const savedUser =
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");

      user = savedUser ? JSON.parse(savedUser) : null;
    } catch {
      user = null;
    }

    if (user?.role && user.role.toLowerCase() !== "admin") {
      setError("Access denied. Please login with an Admin account.");
      return;
    }

    const payload = {
      busNumber: form.busNumber.trim(),
      source: form.source.trim(),
      destination: form.destination.trim(),
      route: form.route.trim(),
      busImage: form.busImage.trim(),

      sourceLatitude:
        form.sourceLatitude === ""
          ? null
          : Number(form.sourceLatitude),

      sourceLongitude:
        form.sourceLongitude === ""
          ? null
          : Number(form.sourceLongitude),

      destinationLatitude:
        form.destinationLatitude === ""
          ? null
          : Number(form.destinationLatitude),

      destinationLongitude:
        form.destinationLongitude === ""
          ? null
          : Number(form.destinationLongitude),
    };

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Session expired or token invalid. Please login again."
          );
        }

        if (response.status === 403) {
          throw new Error(
            "Access denied. Only an Admin can add buses."
          );
        }

        throw new Error(data.message || "Failed to add bus.");
      }

      setMessage("Bus added successfully!");
      setForm({ ...initialForm });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: "busNumber", label: "Bus Number", required: true },
    { name: "source", label: "Source", required: true },
    { name: "destination", label: "Destination", required: true },
    { name: "route", label: "Route", required: true },
    { name: "busImage", label: "Bus Image URL" },
    {
      name: "sourceLatitude",
      label: "Source Latitude",
      type: "number",
    },
    {
      name: "sourceLongitude",
      label: "Source Longitude",
      type: "number",
    },
    {
      name: "destinationLatitude",
      label: "Destination Latitude",
      type: "number",
    },
    {
      name: "destinationLongitude",
      label: "Destination Longitude",
      type: "number",
    },
  ];

  return (
    <main className="admin-content">
      <div className="admin-title-row">
        <div>
          <h2>Add New Bus</h2>
          <p>Register a bus in VeloCity.</p>
        </div>

        <button
          className="admin-refresh"
          type="button"
          onClick={() => navigate("/admin")}
        >
          Back to Dashboard
        </button>
      </div>

      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="add-bus-form">
        {fields.map((field) => (
          <div className="add-bus-field" key={field.name}>
            <label htmlFor={field.name}>
              {field.label}
              {field.required ? " *" : ""}
            </label>

            <input
              id={field.name}
              name={field.name}
              type={field.type || "text"}
              value={form[field.name]}
              onChange={handleChange}
              required={Boolean(field.required)}
              step={field.type === "number" ? "any" : undefined}
              min={
                field.name.toLowerCase().includes("latitude")
                  ? -90
                  : field.name.toLowerCase().includes("longitude")
                    ? -180
                    : undefined
              }
              max={
                field.name.toLowerCase().includes("latitude")
                  ? 90
                  : field.name.toLowerCase().includes("longitude")
                    ? 180
                    : undefined
              }
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
        ))}

        <button
          type="submit"
          className="approve-button"
          disabled={loading}
        >
          {loading ? "Adding Bus..." : "Add Bus"}
        </button>
      </form>
    </main>
  );
}
