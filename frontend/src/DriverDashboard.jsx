import { useCallback, useEffect, useRef, useState } from "react";

const API = "http://localhost:5000/api";

// Session storage first, then local storage.
function getStoredValue(keys) {
  for (const key of keys) {
    const value =
      sessionStorage.getItem(key) ||
      localStorage.getItem(key);

    if (value) return value;
  }

  return null;
}

function getAuthData() {
  const token = getStoredValue([
    "token",
    "transitpulseToken",
    "authToken",
  ]);

  const rawUser = getStoredValue([
    "user",
    "transitpulseUser",
    "currentUser",
  ]);

  let user = null;

  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    user = null;
  }

  return { token, user };
}

function getDriverId(user) {
  const driver = user?.driver;

  if (driver && typeof driver === "object") {
    return (
      driver._id ??
      driver.id ??
      user?.driverId ??
      null
    );
  }

  return (
    driver ??
    user?.driverId ??
    user?.driver_id ??
    null
  );
}

function getAssignedDriverId(assignedDriver) {
  if (assignedDriver && typeof assignedDriver === "object") {
    return (
      assignedDriver._id ??
      assignedDriver.id ??
      assignedDriver.driverId ??
      null
    );
  }

  return assignedDriver ?? null;
}

export default function DriverDashboard() {
  const [bus, setBus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [gpsStatus, setGpsStatus] = useState("GPS not started");

  const watchId = useRef(null);
  const active = useRef(false);
  const requestInProgress = useRef(false);
  const tokenRef = useRef(null);

  // Stop browser GPS tracking.
  const stopGPS = useCallback(() => {
    active.current = false;

    if (
      watchId.current !== null &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    requestInProgress.current = false;

    setSharing(false);
    setGpsStatus("GPS sharing stopped");
  }, []);

  // Load the bus currently assigned to this driver.
  const loadAssignedBus = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { token, user } = getAuthData();
      tokenRef.current = token;

      if (!token || !user) {
        throw new Error(
          "Login details not found. Please log in again."
        );
      }

      if (user.role?.toLowerCase() !== "driver") {
        throw new Error(
          "Please log in using a Driver account."
        );
      }

      const driverId = getDriverId(user);

      if (!driverId) {
        throw new Error(
          "No Driver profile is linked to this account. Please contact the admin."
        );
      }

      const response = await fetch(`${API}/buses`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Your session may have expired. Please log in again."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load buses."
        );
      }

      const buses = Array.isArray(data)
        ? data
        : data.buses ?? data.data ?? [];

      const assignedBus = buses.find((item) => {
        const assignedDriverId = getAssignedDriverId(
          item.assignedDriver
        );

        return (
          assignedDriverId != null &&
          String(assignedDriverId) === String(driverId)
        );
      });

      if (!assignedBus) {
        setBus(null);

        throw new Error(
          "No bus is currently assigned to you. Ask the admin to assign a bus, then select Refresh Assignment."
        );
      }

      setBus(assignedBus);
      setMessage("");
      setError("");
      setGpsStatus("GPS not started");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignedBus();

    return () => {
      active.current = false;

      if (
        watchId.current !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [loadAssignedBus]);

  // Start the assigned bus trip.
  async function startTrip() {
    if (!bus || busy) return;

    if (bus.tripStatus === "In Progress") {
      setError("This trip is already in progress.");
      return;
    }

    if (bus.tripStatus === "Completed") {
      setError(
        "This trip is completed. Refresh Assignment to check for a new bus."
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const token = tokenRef.current;

      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API}/buses/${bus._id}/start-trip`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not start trip."
        );
      }

      const updatedBus = data.bus ?? data.updatedBus ?? {
        ...bus,
        tripStatus: "In Progress",
        status: "Running",
        tripStartedAt: new Date().toISOString(),
      };

      setBus(updatedBus);
      setMessage(
        "Trip started successfully. You can now share GPS."
      );
      setGpsStatus("GPS not started");
    } catch (err) {
      setError(err.message || "Could not start trip.");
    } finally {
      setBusy(false);
    }
  }

  // Share the driver's actual GPS location.
  function startGPS() {
    if (!bus || sharing || busy) return;

    if (bus.tripStatus !== "In Progress") {
      setError("Start your trip before sharing GPS.");
      return;
    }

    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by this browser."
      );
      return;
    }

    if (!window.isSecureContext) {
      setError(
        "GPS requires HTTPS or localhost. Open the app using localhost."
      );
      return;
    }

    const currentBusId = bus._id;
    const token = tokenRef.current;

    if (!currentBusId || !token) {
      setError("Bus or login information is missing.");
      return;
    }

    setError("");
    setMessage("");
    setGpsStatus("Waiting for device GPS...");

    active.current = true;
    setSharing(true);

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (!active.current || requestInProgress.current) {
          return;
        }

        requestInProgress.current = true;
        setGpsStatus("GPS found. Sending location...");

        try {
          const response = await fetch(
            `${API}/buses/${currentBusId}/location`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            }
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.message || "Failed to update GPS location."
            );
          }

          if (active.current) {
            setGpsStatus(
              `GPS updated: ${position.coords.latitude.toFixed(5)}, ` +
              `${position.coords.longitude.toFixed(5)}`
            );

            setMessage("Actual GPS location sent successfully.");
            setError("");
          }
        } catch (err) {
          if (active.current) {
            setError(err.message || "GPS update failed.");
            setGpsStatus("GPS update failed");
          }
        } finally {
          requestInProgress.current = false;
        }
      },
      (err) => {
        if (!active.current) return;

        const errors = {
          1: "Location permission denied. Allow location access in your browser.",
          2: "Current GPS position is unavailable. Check device location settings.",
          3: "GPS request timed out. Try again.",
        };

        setError(
          errors[err.code] || "Unable to get GPS location."
        );

        setGpsStatus("GPS unavailable");
        stopGPS();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );
  }

  // End the trip and stop GPS sharing.
  async function endTrip() {
    if (!bus || busy) return;

    if (bus.tripStatus !== "In Progress") {
      setError("There is no active trip to end.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const token = tokenRef.current;

      if (!token) {
        throw new Error("Please log in again.");
      }

      const response = await fetch(
        `${API}/buses/${bus._id}/end-trip`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not end trip."
        );
      }

      // Stop GPS only after the backend confirms trip completion.
      stopGPS();

      const updatedBus = data.bus ?? data.updatedBus ?? {
        ...bus,
        tripStatus: "Completed",
        status: "Stopped",
        assignedDriver: null,
        tripEndedAt: new Date().toISOString(),
      };

      setBus(updatedBus);
      setMessage(
        "Trip completed successfully. Your trip has ended."
      );
      setError("");
    } catch (err) {
      setError(err.message || "Could not end trip.");
    } finally {
      setBusy(false);
    }
  }

  // Refresh after the admin assigns a new bus.
  async function refreshAssignment() {
    setMessage("");
    setError("");
    await loadAssignedBus();
  }

  if (loading) {
    return (
      <section className="info-panel">
        <h2>Driver Dashboard</h2>
        <p>Loading assigned bus...</p>
      </section>
    );
  }

  if (!bus) {
    return (
      <section className="info-panel">
        <h2>Driver Dashboard</h2>

        {error && (
          <p role="alert" style={{ color: "crimson" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={refreshAssignment}
          disabled={loading}
        >
          Refresh Assignment
        </button>
      </section>
    );
  }

  return (
    <section className="info-panel">
      <h2>Driver Dashboard</h2>

      <p>
        Manage your assigned bus and share your real GPS location.
      </p>

      {error && (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      {message && (
        <p role="status">
          {message}
        </p>
      )}

      <div className="driver-bus-card">
        <h3>Bus {bus.busNumber || "N/A"}</h3>

        <p>
          <strong>Source:</strong>{" "}
          {bus.source || "Not specified"}
        </p>

        <p>
          <strong>Destination:</strong>{" "}
          {bus.destination || "Not specified"}
        </p>

        <p>
          <strong>Route:</strong>{" "}
          {bus.route || "Not specified"}
        </p>

        <p>
          <strong>Trip status:</strong>{" "}
          {bus.tripStatus || "Not Started"}
        </p>

        <p>
          <strong>Bus status:</strong>{" "}
          {bus.status || "Unknown"}
        </p>

        <p>
          <strong>GPS:</strong> {gpsStatus}
        </p>

        {bus.lastLocationUpdate && (
          <p>
            <strong>Last GPS update:</strong>{" "}
            {new Date(
              bus.lastLocationUpdate
            ).toLocaleString()}
          </p>
        )}

        {(!bus.tripStatus ||
          bus.tripStatus === "Not Started" ||
          bus.tripStatus === "Scheduled") && (
          <button
            type="button"
            onClick={startTrip}
            disabled={busy}
          >
            {busy ? "Please wait..." : "Start Trip"}
          </button>
        )}

        {bus.tripStatus === "In Progress" && (
          <>
            {!sharing ? (
              <button
                type="button"
                onClick={startGPS}
                disabled={busy}
              >
                Start Sharing GPS
              </button>
            ) : (
              <button
                type="button"
                onClick={stopGPS}
                disabled={busy}
              >
                Stop Sharing GPS
              </button>
            )}

            <button
              type="button"
              onClick={endTrip}
              disabled={busy}
              style={{ marginLeft: "10px" }}
            >
              {busy ? "Please wait..." : "End Trip"}
            </button>
          </>
        )}

        {bus.tripStatus === "Completed" && (
          <div>
            <p>
              Trip completed. You can check whether the admin
              has assigned you another bus.
            </p>

            <button
              type="button"
              onClick={refreshAssignment}
              disabled={loading || busy}
            >
              Refresh Assignment
            </button>
          </div>
        )}
      </div>
    </section>
  );
}