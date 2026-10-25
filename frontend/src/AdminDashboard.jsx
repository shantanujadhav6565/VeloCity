import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import ConductorManagement from "./ConductorManagement";

const API_URL = "http://localhost:5000/api/auth/driver-requests";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [driverCodes, setDriverCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getToken = () => {
    return (
      sessionStorage.getItem("token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("transitpulseToken") ||
      localStorage.getItem("authToken")
    );
  };

  const getAuthHeaders = () => {
    const token = getToken();

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleAuthError = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("transitpulseToken");
    localStorage.removeItem("transitpulseUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");

    navigate("/admin/login", { replace: true });
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        handleAuthError();
        return;
      }

      const response = await fetch(API_URL, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Driver requests load karta ale nahi."
        );
      }

      const requestList = Array.isArray(data)
        ? data
        : data.requests || data.driverRequests || data.data || [];

      setRequests(requestList);

      // Existing driver codes preserve kara.
      setDriverCodes((previous) => {
        const updated = { ...previous };

        requestList.forEach((request) => {
          const id = request._id || request.id;

          if (id && updated[id] === undefined) {
            updated[id] = request.driverCode || "";
          }
        });

        return updated;
      });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleDriverCodeChange = (requestId, value) => {
    setDriverCodes((previous) => ({
      ...previous,
      [requestId]: value,
    }));
  };

  const handleRequestAction = async (request, action) => {
    const requestId = request._id || request.id;

    if (!requestId) {
      setError("Request ID sapadla nahi.");
      return;
    }

    if (action !== "approve" && action !== "reject") {
      setError("Invalid action.");
      return;
    }

    const driverCode = (driverCodes[requestId] || "").trim();

    if (action === "approve" && !driverCode) {
      setError("Driver approve karnyapurvi Driver Code enter kar.");
      return;
    }

    const confirmed = window.confirm(
      action === "approve"
        ? "Ha driver request approve karaycha aahe ka?"
        : "Ha driver request reject karaycha aahe ka?"
    );

    if (!confirmed) return;

    setBusyId(requestId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/${requestId}/${action}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(
          action === "approve" ? { driverCode } : {}
        ),
      });

      if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Driver request ${action} karta ali nahi.`
        );
      }

      setMessage(
        data.message ||
          (action === "approve"
            ? "Driver successfully approved!"
            : "Driver request rejected.")
      );

      // Action complete zalyavar pending requests refresh kara.
      await loadRequests();
    } catch (err) {
      setError(err.message || "Request process karta ali nahi.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAddBus = () => {
    navigate("/admin/add-bus");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("transitpulseToken");
    localStorage.removeItem("transitpulseUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");

    navigate("/admin/login", { replace: true });
  };

  const getRequestName = (request) => {
    return (
      request.name ||
      request.fullName ||
      request.driverName ||
      request.user?.name ||
      "Unnamed Driver"
    );
  };

  const getRequestEmail = (request) => {
    return request.email || request.user?.email || "Not provided";
  };

  const getRequestPhone = (request) => {
    return (
      request.phone ||
      request.phoneNumber ||
      request.mobile ||
      "Not provided"
    );
  };

  const getRequestDate = (request) => {
    const date = request.createdAt || request.requestedAt;

    if (!date) return "Not available";

    const parsedDate = new Date(date);

    return Number.isNaN(parsedDate.getTime())
      ? "Not available"
      : parsedDate.toLocaleString();
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-brand">
            <h1>VeloCity Admin</h1>
            <p>Smart Transit Management System</p>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={handleAddBus}
            >
              + Add Bus
            </button>

            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={loadRequests}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="admin-btn admin-btn-danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-welcome">
          <div>
            <h2>Driver Registration Requests</h2>
            <p>
              Review driver applications and approve or reject their requests.
            </p>
          </div>

          <div className="admin-request-count">
            <span>Pending Requests</span>
            <strong>{requests.length}</strong>
          </div>
        </section>

        {error && (
          <div className="admin-alert admin-alert-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="admin-alert admin-alert-success" role="status">
            {message}
          </div>
        )}

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading driver requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="admin-empty-state">
            <h3>No Pending Requests</h3>
            <p>Currently, there are no driver registration requests to review.</p>

            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={loadRequests}
            >
              Check Again
            </button>
          </div>
        ) : (
          <section className="admin-request-list">
            {requests.map((request) => {
              const requestId = request._id || request.id;
              const isBusy = busyId === requestId;

              return (
                <article
                  className="admin-request-card"
                  key={requestId}
                >
                  <div className="admin-request-card-header">
                    <div>
                      <h3>{getRequestName(request)}</h3>
                      <p className="admin-request-email">
                        {getRequestEmail(request)}
                      </p>
                    </div>

                    <span className="admin-status-badge">
                      Pending
                    </span>
                  </div>

                  <div className="admin-request-details">
                    <div>
                      <span className="admin-detail-label">Phone</span>
                      <p>{getRequestPhone(request)}</p>
                    </div>

                    <div>
                      <span className="admin-detail-label">
                        Application Date
                      </span>
                      <p>{getRequestDate(request)}</p>
                    </div>

                    {request.licenseNumber && (
                      <div>
                        <span className="admin-detail-label">
                          License Number
                        </span>
                        <p>{request.licenseNumber}</p>
                      </div>
                    )}
                  </div>

                  <div className="admin-driver-code-field">
                    <label htmlFor={`driver-code-${requestId}`}>
                      Driver Code
                    </label>

                    <input
                      id={`driver-code-${requestId}`}
                      type="text"
                      placeholder="Enter unique driver code"
                      value={driverCodes[requestId] || ""}
                      onChange={(event) =>
                        handleDriverCodeChange(
                          requestId,
                          event.target.value
                        )
                      }
                      disabled={isBusy}
                    />

                    <small>
                      Approval sathi unique Driver Code required aahe.
                    </small>
                  </div>

                  <div className="admin-request-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-success"
                      onClick={() =>
                        handleRequestAction(request, "approve")
                      }
                      disabled={isBusy}
                    >
                      {isBusy ? "Processing..." : "Approve Driver"}
                    </button>

                    <button
                      type="button"
                      className="admin-btn admin-btn-danger"
                      onClick={() =>
                        handleRequestAction(request, "reject")
                      }
                      disabled={isBusy}
                    >
                      {isBusy ? "Processing..." : "Reject Request"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
      <ConductorManagement />
    </div>
  );
}
