import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";
const token = () => sessionStorage.getItem("token") || localStorage.getItem("token") || "";

export default function ConductorManagement() {
  const [requests, setRequests] = useState([]);
  const [conductors, setConductors] = useState([]);
  const [buses, setBuses] = useState([]);
  const [codes, setCodes] = useState({});
  const [assignments, setAssignments] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token()}` };
      const [requestResponse, conductorResponse, busResponse] = await Promise.all([
        fetch(`${API}/auth/conductor-requests`, { headers }),
        fetch(`${API}/auth/conductors`, { headers }),
        fetch(`${API}/buses`),
      ]);
      const [requestData, conductorData, busData] = await Promise.all([requestResponse.json(), conductorResponse.json(), busResponse.json()]);
      if (!requestResponse.ok || !conductorResponse.ok || !busResponse.ok) throw new Error(requestData.message || conductorData.message || busData.message || "Unable to load conductor management data.");
      setRequests(requestData.requests || []); setConductors(conductorData.conductors || []); setBuses(busData.buses || []);
      setAssignments(Object.fromEntries(
        (busData.buses || []).map((bus) => [
          bus._id,
          bus.assignedConductor?._id || bus.assignedConductor || "",
        ])
      ));
    } catch (err) { setError(err.message || "Unable to load conductor data."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function review(request, action) {
    const id = request._id;
    const conductorCode = (codes[id] || "").trim();
    if (action === "approve" && !conductorCode) return setError("Enter a unique Conductor Code before approval.");
    setBusy(id); setError(""); setMessage("");
    try {
      const response = await fetch(`${API}/auth/conductor-requests/${id}/${action}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(action === "approve" ? { conductorCode } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Unable to ${action} application.`);
      setMessage(data.message); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function assign(bus) {
    const conductorId = assignments[bus._id];
    setBusy(bus._id); setError(""); setMessage("");
    try {
      const response = await fetch(`${API}/buses/${bus._id}/assign-conductor`, { method: conductorId ? "PATCH" : "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, ...(conductorId ? { body: JSON.stringify({ conductorId }) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to update bus assignment.");
      setMessage(data.message); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  return <section className="admin-main" aria-labelledby="conductor-management-title">
    <section className="admin-welcome"><div><h2 id="conductor-management-title">Conductor Management</h2><p>Review signup requests and assign approved Conductors to buses.</p></div><button className="admin-btn admin-btn-secondary" onClick={load}>Refresh Conductors</button></section>
    {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}{message && <div className="admin-alert admin-alert-success" role="status">{message}</div>}
    <section className="admin-request-list"><h3>Pending Conductor Requests ({requests.length})</h3>
      {requests.length === 0 ? <p className="admin-empty-state">No pending Conductor requests.</p> : requests.map((request) => <article className="admin-request-card" key={request._id}>
        <div className="admin-request-card-header"><div><h3>{request.firstName}</h3><p>{request.phone}</p></div><span className="admin-status-badge">Pending</span></div>
        <p>Registered: {new Date(request.createdAt).toLocaleString()}</p>
        <label htmlFor={`conductor-code-${request._id}`}>Conductor Code</label><input id={`conductor-code-${request._id}`} value={codes[request._id] || ""} onChange={(event) => setCodes((value) => ({ ...value, [request._id]: event.target.value }))} placeholder="e.g. CON-104" disabled={busy === request._id} />
        <div className="admin-request-actions"><button className="admin-btn admin-btn-success" onClick={() => review(request, "approve")} disabled={Boolean(busy)}>{busy === request._id ? "Processing..." : "Approve"}</button><button className="admin-btn admin-btn-danger" onClick={() => review(request, "reject")} disabled={Boolean(busy)}>Reject</button></div>
      </article>)}
    </section>
    <section className="admin-request-list"><h3>Bus and Conductor Assignments</h3>
      {buses.map((bus) => <article className="admin-request-card" key={bus._id}><div className="admin-request-card-header"><div><h3>Bus {bus.busNumber}</h3><p>{bus.route} · {bus.tripStatus}</p></div></div>
        <label htmlFor={`bus-conductor-${bus._id}`}>Assigned Conductor</label><select id={`bus-conductor-${bus._id}`} value={assignments[bus._id] || ""} onChange={(event) => setAssignments((value) => ({ ...value, [bus._id]: event.target.value }))} disabled={bus.tripStatus === "In Progress" || Boolean(busy)}><option value="">Unassigned</option>{conductors.map((conductor) => <option key={conductor._id} value={conductor._id}>{conductor.name} ({conductor.conductorCode})</option>)}</select>
        <button className="admin-btn admin-btn-primary" onClick={() => assign(bus)} disabled={bus.tripStatus === "In Progress" || Boolean(busy)}>{busy === bus._id ? "Saving..." : bus.tripStatus === "In Progress" ? "Trip in Progress" : "Save Assignment"}</button>
      </article>)}
      {buses.length === 0 && <p className="admin-empty-state">No buses are configured.</p>}
    </section>
  </section>;
}
