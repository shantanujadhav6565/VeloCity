
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DriverAssignment.css";

const API_URL = "http://localhost:5000/api";

export default function ConductorAssignment() {
  const [buses, setBuses] = useState([]);
  const [conductors, setConductors] = useState([]);
  const [selectedBus, setSelectedBus] = useState("");
  const [selectedConductor, setSelectedConductor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // Login madhil session token
  const getToken = () => sessionStorage.getItem("token");

  const getBusId = (bus) => bus?._id ?? bus?.id ?? "";

  const getConductorId = (conductor) =>
    conductor?._id ?? conductor?.id ?? "";

  // Bus la conductor already assigned aahe ka?
  const hasAssignedConductor = (bus) => {
    const assignedConductor = bus?.assignedConductor;

    if (!assignedConductor) return false;

    if (typeof assignedConductor === "string") {
      return assignedConductor.trim().length > 0;
    }

    return Boolean(
      assignedConductor._id ||
      assignedConductor.id ||
      assignedConductor.name ||
      assignedConductor.conductorCode
    );
  };

  // Fakt active ani Available conductors
  const availableConductors = conductors.filter((conductor) => {
    const status = String(conductor?.status || "")
      .trim()
      .toLowerCase();

    return (
      status === "available" &&
      conductor.isActive !== false
    );
  });

  // Fakt conductor assign naslelya buses
  const availableBuses = buses.filter(
    (bus) => !hasAssignedConductor(bus)
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        navigate("/admin/login", { replace: true });
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [busResponse, conductorResponse] = await Promise.all([
        fetch(`${API_URL}/buses`, { headers }),
        fetch(`${API_URL}/conductors`, { headers }),
      ]);

      const [busData, conductorData] = await Promise.all([
        busResponse.json(),
        conductorResponse.json(),
      ]);

      if (
        busResponse.status === 401 ||
        busResponse.status === 403 ||
        conductorResponse.status === 401 ||
        conductorResponse.status === 403
      ) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");

        navigate("/admin/login", { replace: true });

        throw new Error(
          "Session expired or you do not have permission."
        );
      }

      if (!busResponse.ok) {
        throw new Error(
          busData.message || "Could not load buses."
        );
      }

      if (!conductorResponse.ok) {
        throw new Error(
          conductorData.message || "Could not load conductors."
        );
      }

      const busList = Array.isArray(busData)
        ? busData
        : busData.buses || busData.data || [];

      const conductorList = Array.isArray(conductorData)
        ? conductorData
        : conductorData.conductors || conductorData.data || [];

      setBuses(busList);
      setConductors(conductorList);
    } catch (err) {
      setError(
        err.message || "Failed to load assignment data."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const assignConductor = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!selectedBus || !selectedConductor) {
      setError("Please select both a bus and a conductor.");
      return;
    }

    // Selected bus ajun available aahe ka?
    const bus = buses.find(
      (item) => String(getBusId(item)) === selectedBus
    );

    if (!bus || hasAssignedConductor(bus)) {
      setError(
        "This bus already has a conductor. Refresh and select another bus."
      );
      await loadData();
      return;
    }

    // Selected conductor ajun Available aahe ka?
    const conductor = conductors.find(
      (item) =>
        String(getConductorId(item)) === selectedConductor
    );

    const conductorStatus = String(conductor?.status || "")
      .trim()
      .toLowerCase();

    if (
      !conductor ||
      conductorStatus !== "available" ||
      conductor.isActive === false
    ) {
      setError(
        "This conductor is not available for assignment. Please refresh."
      );
      await loadData();
      return;
    }

    setSaving(true);

    try {
      const token = getToken();

      if (!token) {
        navigate("/admin/login", { replace: true });
        return;
      }

      const response = await fetch(
        `${API_URL}/buses/${selectedBus}/assign-conductor`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conductorId: selectedConductor,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not assign conductor."
        );
      }

      setMessage(
        result.message || "Conductor assigned successfully!"
      );

      setSelectedBus("");
      setSelectedConductor("");

      await loadData();
    } catch (err) {
      setError(err.message || "Assignment failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="info-panel">
        <h2>Bus–Conductor Assignment</h2>
        <p>Loading buses and conductors...</p>
      </section>
    );
  }

  return (
    <section className="info-panel">
      <h2>Bus–Conductor Assignment</h2>

      <p>Assign available conductors to buses.</p>

      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      <form onSubmit={assignConductor}>
        <div>
          <label htmlFor="conductor-bus">
            Select Bus
          </label>

          <select
            id="conductor-bus"
            value={selectedBus}
            onChange={(event) =>
              setSelectedBus(event.target.value)
            }
            required
            disabled={saving || availableBuses.length === 0}
          >
            <option value="">Choose a bus</option>

            {availableBuses.map((bus) => (
              <option
                key={getBusId(bus)}
                value={getBusId(bus)}
              >
                {bus.busNumber || "Unnamed bus"} —{" "}
                {bus.source || "Unknown source"} to{" "}
                {bus.destination || "Unknown destination"}
              </option>
            ))}
          </select>

          {buses.length > 0 && availableBuses.length === 0 && (
            <p>No unassigned buses available.</p>
          )}
        </div>

        <br />

        <div>
          <label htmlFor="conductor">
            Select Conductor
          </label>

          <select
            id="conductor"
            value={selectedConductor}
            onChange={(event) =>
              setSelectedConductor(event.target.value)
            }
            required
            disabled={
              saving || availableConductors.length === 0
            }
          >
            <option value="">
              Choose an available conductor
            </option>

            {availableConductors.map((conductor) => (
              <option
                key={getConductorId(conductor)}
                value={getConductorId(conductor)}
              >
                {conductor.name ||
                  conductor.firstName ||
                  "Unnamed conductor"}
                {conductor.conductorCode
                  ? ` (${conductor.conductorCode})`
                  : ""}
                {" — Available"}
              </option>
            ))}
          </select>

          {conductors.length > 0 &&
            availableConductors.length === 0 && (
              <p>
                No available conductors. Check conductor status
                and approval.
              </p>
            )}
        </div>

        <br />

        <button
          type="submit"
          disabled={
            saving ||
            !selectedBus ||
            !selectedConductor ||
            availableBuses.length === 0 ||
            availableConductors.length === 0
          }
        >
          {saving ? "Assigning..." : "Assign Conductor"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMessage("");
            loadData();
          }}
          disabled={loading || saving}
          style={{ marginLeft: "10px" }}
        >
          Refresh
        </button>
      </form>

      <hr />

      <h3>Current Bus–Conductor Assignments</h3>

      {buses.length === 0 ? (
        <p>No buses found. Add a bus first.</p>
      ) : (
        <ul>
          {buses.map((bus) => {
            const assignedConductor = bus.assignedConductor;

            const conductorName =
              typeof assignedConductor === "object"
                ? assignedConductor?.name ||
                  assignedConductor?.firstName ||
                  assignedConductor?.conductorCode
                : null;

            return (
              <li key={getBusId(bus)}>
                <strong>
                  {bus.busNumber || "Unnamed bus"}
                </strong>

                {" — "}

                {bus.source || "Unknown source"} to{" "}
                {bus.destination || "Unknown destination"}

                {" — "}

                {hasAssignedConductor(bus)
                  ? `Conductor: ${
                      conductorName ||
                      (typeof assignedConductor === "string"
                        ? "Assigned"
                        : "Assigned")
                    }`
                  : "No conductor assigned"}
              </li>
            );
          })}
        </ul>
      )}

      {conductors.length === 0 && (
        <p>
          No conductors found. Register or approve a conductor first.
        </p>
      )}
    </section>
  );
}
