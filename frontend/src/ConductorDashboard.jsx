
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ConductorDashboard.css";

const API_URL = "http://localhost:5000/api";

function getStoredUser() {
  try {
    return JSON.parse(
      sessionStorage.getItem("user") ||
        localStorage.getItem("user") ||
        "null"
    );
  } catch {
    return null;
  }
}

function getToken() {
  return (
    sessionStorage.getItem("token") ||
    localStorage.getItem("token")
  );
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error("Session expired. Please log in again.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function getErrorMessage(error) {
  return error?.message || "Something went wrong.";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

export default function ConductorDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [profile, setProfile] = useState(null);
  const [bus, setBus] = useState(null);
  const [tickets, setTickets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionError, setActionError] = useState("");

  const [boardingStop, setBoardingStop] = useState("");
  const [destinationStop, setDestinationStop] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [issuing, setIssuing] = useState(false);

  const [manualCount, setManualCount] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [updatingCrowd, setUpdatingCrowd] = useState(false);
  const [tripAction, setTripAction] = useState(false);
  const [selectedStopSequence, setSelectedStopSequence] = useState("");

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (showLoading) setLoading(true);

    setError("");

    try {
      const [profileResult, busResult, historyResult] =
        await Promise.all([
          apiRequest("/conductors/me"),
          apiRequest("/tickets/my-bus"),
          apiRequest("/tickets/history"),
        ]);

      const conductor = profileResult.conductor || null;
      const assignedBus = busResult.bus || null;

      setProfile(conductor);
      setBus(assignedBus);
      setTickets(historyResult.tickets || []);
      setSelectedStopSequence(assignedBus?.currentStopSequence == null ? "" : String(assignedBus.currentStopSequence));

      const stops = [...(assignedBus?.routeStops || [])].sort(
        (a, b) => a.sequence - b.sequence
      );

      const currentSequence = assignedBus?.currentStopSequence;

      const currentStop = stops.find(
        (stop) => stop.sequence === currentSequence
      );

      const firstStop = currentStop || stops[0];

      setBoardingStop((previous) =>
        stops.some((stop) => stop.name === previous)
          ? previous
          : firstStop?.name || ""
      );

      setDestinationStop((previous) =>
        stops.some(
          (stop) =>
            stop.name === previous &&
            stop.sequence > (firstStop?.sequence ?? -1)
        )
          ? previous
          : stops.find(
              (stop) =>
                stop.sequence > (firstStop?.sequence ?? -1)
            )?.name || ""
      );

      setManualCount(String(busResult.crowd?.passengerCount ?? 0));
    } catch (err) {
      if (
        err.message.includes("Session expired") ||
        err.message.toLowerCase().includes("token")
      ) {
        handleLogout();
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function handleLogout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/", { replace: true });
  }

  async function refreshDashboard() {
    setRefreshing(true);
    setSuccess("");
    setActionError("");
    await loadDashboard(false);
  }

  async function handleIssueTicket(event) {
    event.preventDefault();
    setSuccess("");
    setActionError("");

    if (!boardingStop || !destinationStop) {
      setActionError("Select boarding and destination stops.");
      return;
    }

    const count = Number(passengerCount);

    if (!Number.isInteger(count) || count < 1) {
      setActionError("Passenger count must be a positive whole number.");
      return;
    }

    setIssuing(true);

    try {
      const result = await apiRequest("/tickets/issue", {
        method: "POST",
        body: JSON.stringify({
          boardingStop,
          destinationStop,
          passengerCount: count,
        }),
      });

      setSuccess(
        `${result.message || "Ticket issued successfully"}${
          result.ticket?.ticketNumber
            ? ` — ${result.ticket.ticketNumber}`
            : ""
        }`
      );

      setPassengerCount("1");

      await loadDashboard(false);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setIssuing(false);
    }
  }

  async function handleManualCrowdUpdate(event) {
    event.preventDefault();
    setSuccess("");
    setActionError("");

    const count = Number(manualCount);

    if (!Number.isInteger(count) || count < 0) {
      setActionError("Enter a valid non-negative passenger count.");
      return;
    }

    if (!manualReason.trim()) {
      setActionError("Enter a reason for the crowd correction.");
      return;
    }

    setUpdatingCrowd(true);

    try {
      const result = await apiRequest("/tickets/crowd/manual", {
        method: "PATCH",
        body: JSON.stringify({
          passengerCount: count,
          reason: manualReason.trim(),
        }),
      });

      setSuccess(result.message || "Crowd count updated.");
      setManualReason("");

      await loadDashboard(false);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingCrowd(false);
    }
  }

  async function handleResumeTicketCount() {
    setSuccess("");
    setActionError("");
    setUpdatingCrowd(true);

    try {
      const result = await apiRequest(
        "/tickets/crowd/resume-tickets",
        { method: "PATCH" }
      );

      setSuccess(result.message || "Ticket-based crowd count resumed.");
      await loadDashboard(false);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setUpdatingCrowd(false);
    }
  }

  async function handleTripAction(action) {
    if (!bus?._id || tripAction) return;
    setTripAction(true); setSuccess(""); setActionError("");
    try {
      const result = await apiRequest(`/buses/${bus._id}/${action}-trip`, { method: "PATCH" });
      setSuccess(result.message || `Trip ${action === "start" ? "started" : "ended"}.`);
      await loadDashboard(false);
    } catch (err) { setActionError(getErrorMessage(err)); }
    finally { setTripAction(false); }
  }

  async function handleCurrentStop(event) {
    event.preventDefault();
    setSuccess(""); setActionError("");
    try {
      const result = await apiRequest("/tickets/current-stop", { method: "PATCH", body: JSON.stringify({ sequence: Number(selectedStopSequence) }) });
      setSuccess(result.message || "Current stop updated.");
      await loadDashboard(false);
    } catch (err) { setActionError(getErrorMessage(err)); }
  }

  if (loading) {
    return (
      <section className="conductor-dashboard">
        <div className="conductor-card">
          <p>Loading your conductor dashboard...</p>
        </div>
      </section>
    );
  }

  const stops = [...(bus?.routeStops || [])].sort(
    (a, b) => a.sequence - b.sequence
  );
  const boardingStops = stops.filter(
    (stop) => bus?.currentStopSequence == null || stop.sequence >= bus.currentStopSequence
  );

  const validDestinations = stops.filter((stop) => {
    const boarding = stops.find(
      (item) => item.name === boardingStop
    );

    return boarding && stop.sequence > boarding.sequence;
  });

  const count = bus?.currentPassengerCount ?? 0;
  const capacity = bus?.capacity ?? 0;
  const percentage = capacity
    ? Math.round((count / capacity) * 100)
    : 0;
  const exactPercentage = capacity ? (count / capacity) * 100 : 0;

  const crowdStatus =
    exactPercentage >= 100
      ? "Full"
      : exactPercentage < 40
      ? "Low"
      : exactPercentage < 75
        ? "Medium"
        : "High";

  const displayName =
    profile?.name || user?.firstName || "Conductor";

  return (
    <section className="conductor-dashboard">
      <header className="conductor-header">
        <div>
          <span className="conductor-eyebrow">
            VELOCITY • SMART TRANSIT
          </span>
          <h1>Conductor Dashboard</h1>
          <p>Manage tickets, your assigned bus and passenger crowd.</p>
        </div>

        <div className="conductor-header-actions">
          <button
            type="button"
            className="conductor-refresh"
            onClick={refreshDashboard}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="conductor-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="conductor-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={refreshDashboard}>
            Try Again
          </button>
        </div>
      )}

      {success && (
        <div className="conductor-success" role="status">
          {success}
        </div>
      )}

      {actionError && (
        <div className="conductor-error" role="alert">
          {actionError}
        </div>
      )}

      <div className="conductor-welcome">
        <div className="conductor-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div>
          <span>WELCOME BACK</span>
          <h2>{displayName}</h2>
          <p>
            Conductor Code: {profile?.conductorCode || "Not available"}
          </p>
        </div>
      </div>

      <div className="conductor-grid">
        <article className="conductor-card">
          <span className="conductor-card-label">ASSIGNED BUS</span>
          <h3>{bus?.busNumber || "No bus assigned"}</h3>
          <p>{bus?.route || "Route not available"}</p>
          <p>
            {bus?.source || "—"} → {bus?.destination || "—"}
          </p>
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">DUTY STATUS</span>
          <h3>{profile?.status || "Not available"}</h3>
          <p>Trip: {bus?.tripStatus || "Not available"}</p>
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">PASSENGERS ON BOARD</span>
          <h3>{count} / {capacity || "—"}</h3>
          <p>{Math.max(0, capacity - count)} available seats</p>
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">CROWD STATUS</span>
          <h3>{bus ? crowdStatus : "Unknown"}</h3>
          <p>{percentage}% of bus capacity</p>
          <p>Mode: {bus?.crowdUpdateMode || "tickets"}</p>
        </article>
      </div>

      <article className="conductor-card conductor-duty-card">
        <span className="conductor-card-label">TRIP CONTROL</span>
        <h2>{bus?.tripStatus === "In Progress" ? "Trip in progress" : "Trip not running"}</h2>
        <p>Start the assigned bus trip before issuing tickets.</p>
        {bus?.tripStatus === "In Progress" ? <button type="button" className="conductor-refresh" onClick={() => handleTripAction("end")} disabled={tripAction}>{tripAction ? "Ending..." : "End Trip"}</button> : <button type="button" className="conductor-refresh" onClick={() => handleTripAction("start")} disabled={!bus || tripAction}>{tripAction ? "Starting..." : "Start Trip"}</button>}
      </article>

      <article className="conductor-card conductor-duty-card">
        <span className="conductor-card-label">ROUTE PROGRESS</span>
        <h2>Update current stop</h2>
        <form className="conductor-form" onSubmit={handleCurrentStop}>
          <label>Current stop<select value={selectedStopSequence} onChange={(event) => setSelectedStopSequence(event.target.value)} required disabled={bus?.tripStatus !== "In Progress"}><option value="" disabled>Select stop</option>{stops.map((stop) => <option key={stop.sequence} value={stop.sequence}>{stop.name}</option>)}</select></label>
          <button type="submit" disabled={!bus || bus.tripStatus !== "In Progress" || selectedStopSequence === ""}>Update Stop and Crowd</button>
        </form>
      </article>

      <article className="conductor-card conductor-duty-card">
        <span className="conductor-card-label">CROWD MANAGEMENT</span>
        <h2>Passenger occupancy</h2>

        <div
          className="conductor-crowd-track"
          role="progressbar"
          aria-label="Bus passenger occupancy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(percentage, 100)}
        >
          <div
            className="conductor-crowd-fill"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>

        <p>
          Last updated: {formatDate(bus?.crowdLastUpdated)}
        </p>
      </article>

      <div className="conductor-sections">
        <article className="conductor-card">
          <span className="conductor-card-label">TICKET MANAGEMENT</span>
          <h2>Issue a ticket</h2>

          {bus?.tripStatus !== "In Progress" ? (
            <p>
              Ticket issuing is available only when the bus trip is
              in progress. Start the trip using the existing driver
              workflow first.
            </p>
          ) : stops.length < 2 ? (
            <p>
              This bus needs at least two configured route stops
              before tickets can be issued.
            </p>
          ) : (
            <form
              className="conductor-form"
              onSubmit={handleIssueTicket}
            >
              <label>
                Boarding stop
                <select
                  value={boardingStop}
                  onChange={(event) => {
                    const nextBoarding = event.target.value;
                    setBoardingStop(nextBoarding);

                    const nextSequence = stops.find(
                      (stop) => stop.name === nextBoarding
                    )?.sequence;

                    const destinationStillValid = stops.some(
                      (stop) =>
                        stop.name === destinationStop &&
                        stop.sequence > (nextSequence ?? -1)
                    );

                    if (!destinationStillValid) {
                      setDestinationStop(
                        stops.find(
                          (stop) =>
                            stop.sequence > (nextSequence ?? -1)
                        )?.name || ""
                      );
                    }
                  }}
                  required
                >
                  {boardingStops.map((stop) => (
                    <option key={stop.sequence} value={stop.name}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Destination stop
                <select
                  value={destinationStop}
                  onChange={(event) =>
                    setDestinationStop(event.target.value)
                  }
                  required
                >
                  {validDestinations.map((stop) => (
                    <option key={stop.sequence} value={stop.name}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Number of passengers
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={passengerCount}
                  onChange={(event) =>
                    setPassengerCount(event.target.value)
                  }
                  required
                />
              </label>

              <button type="submit" disabled={issuing}>
                {issuing ? "Issuing..." : "Issue Ticket"}
              </button>
            </form>
          )}
        </article>

        <article className="conductor-card">
          <span className="conductor-card-label">
            MANUAL CROWD CORRECTION
          </span>
          <h2>Correct passenger count</h2>
          <p>
            Use this when the actual passenger count differs from
            the ticket-based estimate.
          </p>

          <form
            className="conductor-form"
            onSubmit={handleManualCrowdUpdate}
          >
            <label>
              Actual passenger count
              <input
                type="number"
                min="0"
                max={capacity || undefined}
                step="1"
                value={manualCount}
                onChange={(event) =>
                  setManualCount(event.target.value)
                }
                required
              />
            </label>

            <label>
              Reason for correction
              <textarea
                value={manualReason}
                onChange={(event) =>
                  setManualReason(event.target.value)
                }
                maxLength={300}
                rows={3}
                placeholder="Explain why the count needs correction"
                required
              />
            </label>

            <button
              type="submit"
              disabled={updatingCrowd || !bus || bus.tripStatus !== "In Progress"}
            >
              Save Crowd Correction
            </button>
          </form>

          {bus?.crowdUpdateMode === "manual" && (
            <button
              type="button"
              className="conductor-refresh"
              onClick={handleResumeTicketCount}
              disabled={updatingCrowd || bus?.tripStatus !== "In Progress"}
            >
              Resume Ticket-Based Count
            </button>
          )}

          {bus?.manualCrowdUpdate && (
            <p>
              Last correction: {bus.manualCrowdUpdate.reason || "—"}
            </p>
          )}
        </article>
      </div>

      <article className="conductor-card conductor-history">
        <span className="conductor-card-label">TICKET HISTORY</span>
        <h2>Recently issued tickets</h2>

        {tickets.length === 0 ? (
          <p>No tickets have been issued under this conductor account yet.</p>
        ) : (
          <div className="conductor-table-wrapper">
            <table className="conductor-ticket-table">
              <thead>
                <tr>
                  <th>Ticket Number</th>
                  <th>Journey</th>
                  <th>Passengers</th>
                  <th>Issued At</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket._id}>
                    <td>{ticket.ticketNumber}</td>
                    <td>
                      {ticket.boardingStop} → {ticket.destinationStop}
                    </td>
                    <td>{ticket.passengerCount}</td>
                    <td>{formatDate(ticket.issuedAt)}</td>
                    <td>{ticket.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
