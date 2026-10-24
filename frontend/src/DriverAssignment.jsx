
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DriverAssignment.css";

const API_URL = "http://localhost:5000/api";

export default function DriverAssignment() {
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedBus, setSelectedBus] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // Login.jsx madhil same session token
  const getToken = () => sessionStorage.getItem("token");

  const getBusId = (bus) => bus?._id ?? bus?.id ?? "";

  const getDriverId = (driver) =>
    driver?._id ?? driver?.id ?? "";

  // Bus la driver already assigned aahe ka?
  const hasAssignedDriver = (bus) => {
    const assignedDriver = bus?.assignedDriver;

    if (!assignedDriver) return false;

    if (typeof assignedDriver === "string") {
      return assignedDriver.trim().length > 0;
    }

    return Boolean(
      assignedDriver._id ||
      assignedDriver.id ||
      assignedDriver.name ||
      assignedDriver.driverCode
    );
  };

  // Fakt active ani Available drivers assign karta yetil
  const availableDrivers = drivers.filter((driver) => {
    const status = String(driver?.status || "")
      .trim()
      .toLowerCase();

    return (
      status === "available" &&
      driver.isActive !== false
    );
  });

  // Fakt driver naslelya buses assignment sathi available
  const availableBuses = buses.filter(
    (bus) => !hasAssignedDriver(bus)
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

      const [busResponse, driverResponse] = await Promise.all([
        fetch(`${API_URL}/buses`, { headers }),
        fetch(`${API_URL}/drivers`, { headers }),
      ]);

      const [busData, driverData] = await Promise.all([
        busResponse.json(),
        driverResponse.json(),
      ]);

      if (
        busResponse.status === 401 ||
        busResponse.status === 403 ||
        driverResponse.status === 401 ||
        driverResponse.status === 403
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

      if (!driverResponse.ok) {
        throw new Error(
          driverData.message || "Could not load drivers."
        );
      }

      const busList = Array.isArray(busData)
        ? busData
        : busData.buses || busData.data || [];

      const driverList = Array.isArray(driverData)
        ? driverData
        : driverData.drivers || driverData.data || [];

      setBuses(busList);
      setDrivers(driverList);
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

  const assignDriver = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!selectedBus || !selectedDriver) {
      setError("Please select both a bus and a driver.");
      return;
    }

    // Selected bus ajun available aahe ka te check kar
    const bus = buses.find(
      (item) => String(getBusId(item)) === selectedBus
    );

    if (!bus || hasAssignedDriver(bus)) {
      setError(
        "This bus already has a driver. Refresh and select another bus."
      );
      await loadData();
      return;
    }

    // Selected driver ajun Available aahe ka te check kar
    const driver = drivers.find(
      (item) => String(getDriverId(item)) === selectedDriver
    );

    const driverStatus = String(driver?.status || "")
      .trim()
      .toLowerCase();

    if (
      !driver ||
      driverStatus !== "available" ||
      driver.isActive === false
    ) {
      setError(
        "This driver is not available for assignment. Please refresh."
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
        `${API_URL}/buses/${selectedBus}/assign-driver`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            driverId: selectedDriver,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not assign driver."
        );
      }

      setMessage(
        result.message || "Driver assigned successfully!"
      );

      setSelectedBus("");
      setSelectedDriver("");

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
        <h2>Bus–Driver Assignment</h2>
        <p>Loading buses and drivers...</p>
      </section>
    );
  }

  return (
    <section className="info-panel">
      <h2>Bus–Driver Assignment</h2>

      <p>
        Assign available drivers to buses.
      </p>

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

      <form onSubmit={assignDriver}>
        <div>
          <label htmlFor="bus">
            Select Bus
          </label>

          <select
            id="bus"
            value={selectedBus}
            onChange={(event) => setSelectedBus(event.target.value)}
            required
            disabled={saving || availableBuses.length === 0}
          >
            <option value="">
              Choose a bus
            </option>

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
            <p>
              No unassigned buses available.
            </p>
          )}
        </div>

        <br />

        <div>
          <label htmlFor="driver">
            Select Driver
          </label>

          <select
            id="driver"
            value={selectedDriver}
            onChange={(event) => setSelectedDriver(event.target.value)}
            required
            disabled={saving || availableDrivers.length === 0}
          >
            <option value="">
              Choose an available driver
            </option>

            {availableDrivers.map((driver) => (
              <option
                key={getDriverId(driver)}
                value={getDriverId(driver)}
              >
                {driver.name ||
                  driver.firstName ||
                  "Unnamed driver"}
                {driver.driverCode
                  ? ` (${driver.driverCode})`
                  : ""}
                {" — Available"}
              </option>
            ))}
          </select>

          {drivers.length > 0 && availableDrivers.length === 0 && (
            <p>
              No available drivers. Complete a trip or approve a driver first.
            </p>
          )}
        </div>

        <br />

        <button
          type="submit"
          disabled={
            saving ||
            !selectedBus ||
            !selectedDriver ||
            availableBuses.length === 0 ||
            availableDrivers.length === 0
          }
        >
          {saving ? "Assigning..." : "Assign Driver"}
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

      <h3>Current Bus Assignments</h3>

      {buses.length === 0 ? (
        <p>No buses found. Add a bus first.</p>
      ) : (
        <ul>
          {buses.map((bus) => {
            const assignedDriver = bus.assignedDriver;

            const driverName =
              typeof assignedDriver === "object"
                ? assignedDriver?.name ||
                  assignedDriver?.firstName ||
                  assignedDriver?.driverCode
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

                {hasAssignedDriver(bus)
                  ? `Driver: ${
                      driverName ||
                      (typeof assignedDriver === "string"
                        ? "Assigned"
                        : "Assigned")
                    }`
                  : "No driver assigned"}
              </li>
            );
          })}
        </ul>
      )}

      {drivers.length === 0 && (
        <p>
          No drivers found. Add or approve a driver first.
        </p>
      )}
    </section>
  );
}
