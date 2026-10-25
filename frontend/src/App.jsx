import { useState, useEffect, useCallback } from "react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import AddBus from "./AddBus";
import AdminDashboard from "./AdminDashboard";
import DriverSignup from "./DriverSignup";
import ConductorSignup from "./ConductorSignup";
import DriverLogin from "./DriverLogin";
import RoleSelection from "./RoleSelection";
import ProtectedRoute from "./ProtectedRoute";
import BusMap from "./BusMap";
import DriverDashboard from "./DriverDashboard";
import DriverAssignment from "./DriverAssignment";
import ConductorAssignment from "./ConductorAssignment";
import ConductorDashboard from "./ConductorDashboard";
import Signup from "./Signup";
import Login from "./Login";
import "./App.css";
import "./RoleSelection.css";
import "./DesignSystem.css";
import "./WelcomeScene.css";

const API_URL = "http://localhost:5000/api/buses";
const PASSENGER_TRIP_API =
  "http://localhost:5000/api/passenger-trips";

const REFRESH_INTERVAL = 3000;

// =====================================================
// SESSION HELPERS
// =====================================================

function getStoredUser() {
  try {
    const sessionUser = sessionStorage.getItem("user");
    const localUser = localStorage.getItem("user");

    const rawUser = sessionUser || localUser;

    if (!rawUser) return null;

    const parsedUser = JSON.parse(rawUser);

    return parsedUser && typeof parsedUser === "object"
      ? parsedUser
      : null;
  } catch (error) {
    console.error("Unable to read stored user:", error);
    return null;
  }
}

function getToken() {
  return (
    sessionStorage.getItem("token") ||
    localStorage.getItem("token") ||
    ""
  );
}

// =====================================================
// ROLE-BASED DEFAULT DASHBOARD
// =====================================================

function getDashboardPath(user) {
  switch (user?.role) {
    case "Admin":
      return "/admin";

    case "Driver":
      return "/driver";

    case "Conductor":
      return "/conductor";

    case "Passenger":
    default:
      return "/home";
  }
}

// =====================================================
// SIDEBAR MENU
// =====================================================

const menuItems = [
  {
    path: "/home",
    label: "Home",
    icon: "⌂",
    end: true,
    roles: ["Passenger", "Admin"],
  },
  {
    path: "/tracking",
    label: "Live Bus Tracking",
    icon: "◎",
    roles: ["Passenger", "Admin"],
  },
  {
    path: "/assign-driver",
    label: "Bus–Driver Assignment",
    icon: "⇄",
    roles: ["Admin"],
  },
  {
    path: "/assign-conductor",
    label: "Bus–Conductor Assignment",
    icon: "⇄",
    roles: ["Admin"],
  },
  {
    path: "/admin",
    label: "Admin Dashboard",
    icon: "▦",
    roles: ["Admin"],
  },
  {
    path: "/admin/add-bus",
    label: "Add Bus",
    icon: "+",
    roles: ["Admin"],
  },
  {
    path: "/driver",
    label: "Driver Dashboard",
    icon: "♙",
    roles: ["Driver"],
  },
  {
    path: "/conductor",
    label: "Conductor Dashboard",
    icon: "♙",
    roles: ["Conductor"],
  },
];

// =====================================================
// HOME PAGE
// =====================================================

function HomePage() {
  const user = getStoredUser();
  const isPassenger = user?.role === "Passenger";

  const [busNumber, setBusNumber] = useState("");
  const [buses, setBuses] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const [activeTrip, setActiveTrip] = useState(null);
  const [tripLoading, setTripLoading] = useState(true);
  const [tripActionLoading, setTripActionLoading] =
    useState(false);
  const [tripMessage, setTripMessage] = useState("");

  // Fetch buses
  const fetchBuses = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);

      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Unable to fetch buses");
        }

        const data = await response.json();

        const busList = Array.isArray(data.buses)
          ? data.buses
          : [];

        setBuses(busList);
        setError("");

        setSelectedBus((previous) => {
          if (!busList.length) return null;

          if (previous?._id) {
            const updatedBus = busList.find(
              (bus) => bus._id === previous._id
            );

            if (updatedBus) return updatedBus;
          }

          return busList[0];
        });
      } catch (err) {
        console.error("Fetch buses error:", err);

        setError(
          "Unable to connect to the server. Please start your backend and try again."
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchBuses(true);

    const intervalId = setInterval(
      () => fetchBuses(false),
      REFRESH_INTERVAL
    );

    return () => clearInterval(intervalId);
  }, [fetchBuses]);

  // Fetch passenger active trip
  const fetchActiveTrip = useCallback(async () => {
    if (!isPassenger || !getToken()) {
      setActiveTrip(null);
      setTripLoading(false);
      return;
    }

    setTripLoading(true);

    try {
      const response = await fetch(
        `${PASSENGER_TRIP_API}/active`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load your active trip"
        );
      }

      const trip = data.trip || null;
      setActiveTrip(trip);

      if (trip?.busId?._id) {
        setSelectedBus((previous) => {
          const alreadyLoaded = buses.find(
            (bus) => bus._id === trip.busId._id
          );

          return alreadyLoaded || trip.busId || previous;
        });
      }
    } catch (err) {
      console.error("Fetch active trip error:", err);
      setTripMessage(err.message);
    } finally {
      setTripLoading(false);
    }
  }, [isPassenger, buses]);

  useEffect(() => {
    fetchActiveTrip();
  }, [fetchActiveTrip]);

  // Scroll to tracking section
  const scrollToTracking = () => {
    document.getElementById("tracking")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const chooseBus = (bus) => {
    setSelectedBus(bus);
    setSearchMessage("");
    scrollToTracking();
  };

  // Search bus
  const handleSearch = (event) => {
    event.preventDefault();
    setSearchMessage("");

    if (!busNumber.trim()) {
      setSearchMessage("Please enter a bus number first.");
      return;
    }

    const foundBus = buses.find(
      (bus) =>
        String(bus.busNumber).toLowerCase() ===
        busNumber.trim().toLowerCase()
    );

    if (!foundBus) {
      setSearchMessage(
        `Bus ${busNumber.trim()} was not found in the database.`
      );
      return;
    }

    setSelectedBus(foundBus);

    setSearchMessage(
      `Bus ${foundBus.busNumber} found successfully!`
    );

    scrollToTracking();
  };

  // Current location
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchMessage(
        "Location is not supported by your browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchMessage(
          `Your location: ${position.coords.latitude.toFixed(
            5
          )}, ${position.coords.longitude.toFixed(
            5
          )}. Bus proximity is not calculated yet.`
        );
      },
      () => {
        setSearchMessage(
          "Location permission denied or your location is unavailable."
        );
      }
    );
  };

  // Status CSS
  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "running") return "status-running";
    if (value === "delayed") return "status-delayed";

    return "status-stopped";
  };

  // Passenger joins a bus
  const handleJoinTrip = async (bus) => {
    if (!isPassenger || !bus?._id) return;

    if (!getToken()) {
      setTripMessage("Please log in again.");
      return;
    }

    if (activeTrip) {
      setTripMessage(
        "You already have an active trip. End it before joining another bus."
      );
      return;
    }

    setTripActionLoading(true);
    setTripMessage("");

    try {
      const response = await fetch(
        `${PASSENGER_TRIP_API}/enroll`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            busId: bus._id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        await fetchActiveTrip();

        throw new Error(
          data.message || "Unable to join this bus"
        );
      }

      setActiveTrip(data.trip || null);
      setSelectedBus(data.trip?.busId || bus);

      setTripMessage(
        `Successfully joined Bus ${bus.busNumber}.`
      );
    } catch (err) {
      console.error("Join trip error:", err);
      setTripMessage(err.message);
    } finally {
      setTripActionLoading(false);
    }
  };

  // Passenger ends trip
  const handleEndTrip = async () => {
    if (!activeTrip || tripActionLoading) return;

    const confirmed = window.confirm(
      "Are you sure you want to end your passenger trip?"
    );

    if (!confirmed) return;

    setTripActionLoading(true);
    setTripMessage("");

    try {
      const response = await fetch(
        `${PASSENGER_TRIP_API}/end`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to end your trip"
        );
      }

      setActiveTrip(null);

      setTripMessage(
        "Your trip has ended. You can join another bus now."
      );
    } catch (err) {
      console.error("End trip error:", err);
      setTripMessage(err.message);
      await fetchActiveTrip();
    } finally {
      setTripActionLoading(false);
    }
  };

  return (
    <div className="home-page" id="home">
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">
            <span className="status-dot" />
            VELOCITY SMART TRANSIT
          </div>

          <h1>
            Your journey,
            <br />
            <span>in real time.</span>
          </h1>

          <p className="hero-description">
            Your everyday bus journey, made simpler. Find your bus,
            explore routes and access bus information in one convenient
            place.
          </p>

          <form className="search-form" onSubmit={handleSearch}>
            <span className="search-icon">⌕</span>

            <input
              type="text"
              placeholder="Enter bus number (e.g. 101)"
              value={busNumber}
              onChange={(event) => {
                setBusNumber(event.target.value);
                setSearchMessage("");
              }}
              aria-label="Bus number"
            />

            <button type="submit" className="search-button">
              Search Bus <span>→</span>
            </button>
          </form>

          {searchMessage && (
            <p
              className={`search-message ${
                searchMessage.includes("successfully")
                  ? "message-success"
                  : "message-error"
              }`}
              role="status"
            >
              {searchMessage}
            </p>
          )}

          <button
            type="button"
            className="location-button"
            onClick={handleCurrentLocation}
          >
            <span>◎</span> Use my current location
          </button>

          <div className="hero-stats">
            <div>
              <strong>{loading ? "..." : buses.length}</strong>
              <span>Available buses</span>
            </div>

            <div>
              <strong>Simple</strong>
              <span>Bus search</span>
            </div>

            <div>
              <strong>One place</strong>
              <span>Bus information</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-glow" />

          <div className="floating-card card-top">
            <span className="floating-icon blue-icon">↗</span>
            <div>
              <small>Your journey</small>
              <strong>Find your bus easily</strong>
            </div>
          </div>

          <div className="city-illustration">
            <div className="city-sun" />

            <div className="building building-one">
              <span />
              <span />
              <span />
            </div>

            <div className="building building-two">
              <span />
              <span />
              <span />
            </div>

            <div className="building building-three">
              <span />
              <span />
              <span />
            </div>

            <div className="road">
              <div className="road-line" />

              <div className="illustration-bus">
                <span className="bus-window" />
                <span className="bus-wheel wheel-one" />
                <span className="bus-wheel wheel-two" />
              </div>
            </div>

            <div className="route-point point-one" />
            <div className="route-point point-two" />
          </div>

          <div className="floating-card card-bottom">
            <div className="mini-map-icon">⌖</div>

            <div>
              <small>Travel made simple</small>
              <strong>Your city, connected.</strong>
            </div>

            <span className="arrow-circle">↗</span>
          </div>
        </div>
      </section>

      {isPassenger && (
        <section className="passenger-trip-panel">
          <span className="section-label">YOUR ENROLLMENT</span>

          {tripLoading ? (
            <p>Checking your active trip...</p>
          ) : activeTrip ? (
            <>
              <h3>
                Active Trip — Bus{" "}
                {activeTrip.busId?.busNumber || "Selected Bus"}
              </h3>

              <p>
                Route:{" "}
                {activeTrip.busId?.route ||
                  "Route information unavailable"}
              </p>

              <p>
                Enrolled at:{" "}
                {activeTrip.enrolledAt
                  ? new Date(activeTrip.enrolledAt).toLocaleString()
                  : "Unavailable"}
              </p>

              <button
                type="button"
                className="search-button"
                disabled={tripActionLoading}
                onClick={handleEndTrip}
              >
                {tripActionLoading
                  ? "Please wait..."
                  : "End My Trip"}
              </button>
            </>
          ) : (
            <>
              <h3>No Active Trip</h3>
              <p>Select a bus below and click Join Trip.</p>
            </>
          )}

          {tripMessage && (
            <p role="status" className="search-message">
              {tripMessage}
            </p>
          )}
        </section>
      )}

      <section id="tracking" className="tracking-section">
        <div className="section-heading">
          <div>
            <span className="section-label">
              YOUR JOURNEY, SIMPLIFIED
            </span>

            <h2>Your bus dashboard.</h2>

            <p>
              View the selected bus details retrieved from the database.
            </p>
          </div>

          <span className="demo-badge">
            <span className="status-dot" />
            {error ? "CONNECTION ISSUE" : "BUS INFORMATION"}
          </span>
        </div>

        <div className="tracking-grid">
          <div className="map-card">
            <div className="map-header">
              <div>
                <span className="map-label">ROUTE OVERVIEW</span>
                <h3>Explore your route</h3>
              </div>

              <span className="map-pin-icon">⌖</span>
            </div>

            <BusMap bus={selectedBus} />
          </div>

          <div className="bus-details-card">
            {loading ? (
              <div className="dashboard-message">
                <div className="loading-spinner" />
                <h3>Loading bus information</h3>
                <p>Connecting to the VeloCity database...</p>
              </div>
            ) : error && !selectedBus ? (
              <div className="dashboard-message">
                <div className="empty-icon">!</div>
                <h3>Connection error</h3>
                <p>{error}</p>

                <button
                  type="button"
                  className="search-button"
                  onClick={() => fetchBuses(true)}
                >
                  Try Again ↻
                </button>
              </div>
            ) : selectedBus ? (
              <>
                <div className="bus-card-heading">
                  <div className="bus-symbol">▰</div>

                  <div>
                    <span className="map-label">SELECTED BUS</span>
                    <h3>Bus {selectedBus.busNumber}</h3>
                  </div>

                  <span
                    className={`demo-pill ${getStatusClass(
                      selectedBus.status
                    )}`}
                  >
                    {selectedBus.status}
                  </span>
                </div>

                <div className="info-row">
                  <div className="info-icon">↗</div>

                  <div className="info-text">
                    <span>Route</span>
                    <strong>{selectedBus.route}</strong>
                  </div>
                </div>

                {isPassenger && (
                  <div className="info-row">
                    <div className="info-icon">♧</div>

                    <div className="info-text">
                      <span>Passenger crowd</span>

                      <strong>
                        {selectedBus.currentPassengerCount ?? 0} /{" "}
                        {selectedBus.capacity ?? 50} ·{" "}
                        {selectedBus.crowdStatus || "Low"} (
                        {selectedBus.crowdPercentage ?? 0}%)
                      </strong>

                      <small>
                        {Math.max(
                          0,
                          (selectedBus.capacity ?? 50) -
                            (selectedBus.currentPassengerCount ?? 0)
                        )}{" "}
                        seats available ·{" "}
                        {selectedBus.currentStopName ||
                          "Current stop unavailable"}
                      </small>

                      <small>
                        Updated{" "}
                        {selectedBus.crowdLastUpdated
                          ? new Date(
                              selectedBus.crowdLastUpdated
                            ).toLocaleTimeString()
                          : "Not yet reported"}
                      </small>
                    </div>
                  </div>
                )}

                <div className="info-row">
                  <div className="info-icon green-text">◷</div>

                  <div className="info-text">
                    <span>Current status</span>
                    <strong>{selectedBus.status}</strong>
                  </div>
                </div>

                <div className="info-row">
                  <div className="info-icon orange-text">⌖</div>

                  <div className="info-text">
                    <span>GPS coordinates</span>

                    <strong>
                      {selectedBus.latitude != null &&
                      selectedBus.longitude != null
                        ? `${selectedBus.latitude}, ${selectedBus.longitude}`
                        : "Not available"}
                    </strong>
                  </div>
                </div>

                <div className="next-stop">
                  <span>SELECTED ROUTE</span>
                  <strong>{selectedBus.route}</strong>
                </div>

                <p className="data-note">
                  Bus details refresh from MongoDB every 3 seconds.
                  Actual live GPS tracking requires real GPS updates.
                </p>

                {error && (
                  <p
                    className="search-message message-error"
                    role="status"
                  >
                    Refresh failed. Showing the last available bus data.
                  </p>
                )}
              </>
            ) : (
              <div className="dashboard-message">
                <div className="empty-icon">▰</div>
                <h3>No buses available</h3>
                <p>
                  Add a bus through your backend API to see it here.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="available" className="features-section">
        <div className="features-heading">
          <span className="section-label">AVAILABLE BUSES</span>
          <h2>Choose your bus.</h2>

          <p>
            Select a bus to view its route and current database status.
          </p>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading available buses...
          </div>
        ) : error && buses.length === 0 ? (
          <div className="empty-state">
            Unable to load buses. Please check the backend.

            <button
              type="button"
              className="search-button"
              onClick={() => fetchBuses(true)}
            >
              Retry
            </button>
          </div>
        ) : buses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">▰</div>
            <h3>No buses added yet</h3>
            <p>Add a bus to your database to display it here.</p>
          </div>
        ) : (
          <div className="feature-grid bus-list-grid">
            {buses.map((bus) => (
              <article
                className={`feature-card bus-list-card ${
                  selectedBus?._id === bus._id
                    ? "bus-selected"
                    : ""
                }`}
                key={bus._id}
              >
                <div className="bus-list-top">
                  <div className="feature-icon icon-blue">▰</div>

                  <span
                    className={`demo-pill ${getStatusClass(
                      bus.status
                    )}`}
                  >
                    {bus.status}
                  </span>
                </div>

                <span className="map-label">VELOCITY BUS</span>
                <h3>Bus {bus.busNumber}</h3>
                <p>{bus.route}</p>

                {isPassenger && (
                  <div className="bus-crowd-summary">
                    <strong>
                      {bus.currentPassengerCount ?? 0}/
                      {bus.capacity ?? 50} passengers ·{" "}
                      {bus.crowdStatus || "Low"}
                    </strong>

                    <span>
                      {Math.max(
                        0,
                        (bus.capacity ?? 50) -
                          (bus.currentPassengerCount ?? 0)
                      )}{" "}
                      seats · {bus.crowdPercentage ?? 0}% occupied
                    </span>

                    <span>
                      {bus.currentStopName ||
                        "Current stop unavailable"}{" "}
                      · Updated{" "}
                      {bus.crowdLastUpdated
                        ? new Date(
                            bus.crowdLastUpdated
                          ).toLocaleTimeString()
                        : "not reported"}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  className="search-button bus-view-button"
                  onClick={() => chooseBus(bus)}
                >
                  {selectedBus?._id === bus._id
                    ? "Currently Selected ✓"
                    : "View Bus →"}
                </button>

                {isPassenger && (
                  <button
                    type="button"
                    className="search-button bus-view-button"
                    disabled={
                      tripLoading ||
                      tripActionLoading ||
                      Boolean(activeTrip)
                    }
                    onClick={() => handleJoinTrip(bus)}
                    style={{ marginTop: "8px" }}
                  >
                    {activeTrip?.busId?._id === bus._id
                      ? "Joined This Bus ✓"
                      : activeTrip
                      ? "End Current Trip First"
                      : tripActionLoading
                      ? "Joining..."
                      : "Join Trip"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        id="features"
        className="features-section features-extra"
      >
        <div className="features-heading">
          <span className="section-label">BUILT FOR PASSENGERS</span>
          <h2>A better way to get there.</h2>

          <p>
            Live route and passenger information from the bus service.
          </p>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon icon-blue">⌖</div>
            <h3>Live Bus Tracking</h3>
            <p>
              Follow a bus on a real map once GPS data is integrated.
            </p>
            <span className="feature-link">Planned feature ↗</span>
          </article>

          <article className="feature-card">
            <div className="feature-icon icon-green">◷</div>
            <h3>Arrival Predictions</h3>
            <p>
              Estimate arrival times when route and live location data
              are available.
            </p>
            <span className="feature-link">Planned feature ↗</span>
          </article>

          <article className="feature-card">
            <div className="feature-icon icon-orange">♧</div>
            <h3>Crowd Updates</h3>
            <p>
              Check ticket-derived passenger counts, available seats
              and crowd status as buses update.
            </p>
            <span className="feature-link">
              Crowd updates enabled ↗
            </span>
          </article>

          <article className="feature-card">
            <div className="feature-icon icon-purple">⇄</div>
            <h3>Route Information</h3>
            <p>
              Expand route data to show stops, directions and
              destinations.
            </p>
            <span className="feature-link">Planned feature ↗</span>
          </article>
        </div>
      </section>
    </div>
  );
}

// =====================================================
// BUS TRACKING PAGE
// =====================================================

function TrackingPage() {
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBuses = useCallback(async () => {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Unable to load buses");
      }

      const data = await response.json();

      const busList = Array.isArray(data.buses)
        ? data.buses
        : [];

      setBuses(busList);

      setSelectedBusId((previous) => {
        if (busList.some((bus) => bus._id === previous)) {
          return previous;
        }

        return busList[0]?._id || "";
      });

      setError("");
    } catch (err) {
      console.error("Tracking error:", err);
      setError("Unable to connect to the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuses();

    const intervalId = setInterval(
      fetchBuses,
      REFRESH_INTERVAL
    );

    return () => clearInterval(intervalId);
  }, [fetchBuses]);

  const selectedBus =
    buses.find((bus) => bus._id === selectedBusId) || null;

  return (
    <section className="portal-page">
      <span className="section-label">LIVE BUS INFORMATION</span>
      <h1>Bus Tracking</h1>

      <p>
        Select a bus to view its route and latest coordinates.
      </p>

      {loading ? (
        <p>Loading buses...</p>
      ) : error ? (
        <div className="portal-empty">
          {error}

          <button
            type="button"
            className="search-button"
            onClick={fetchBuses}
          >
            Try again
          </button>
        </div>
      ) : buses.length === 0 ? (
        <div className="portal-empty">
          No buses available.
        </div>
      ) : (
        <>
          <label
            className="portal-select-label"
            htmlFor="tracking-bus"
          >
            Select bus
          </label>

          <select
            id="tracking-bus"
            className="portal-select"
            value={selectedBusId}
            onChange={(event) =>
              setSelectedBusId(event.target.value)
            }
          >
            {buses.map((bus) => (
              <option key={bus._id} value={bus._id}>
                Bus {bus.busNumber} — {bus.route}
              </option>
            ))}
          </select>

          {selectedBus && (
            <>
              <div className="portal-bus-summary">
                <strong>Bus {selectedBus.busNumber}</strong>
                <span>Route: {selectedBus.route}</span>
                <span>Status: {selectedBus.status}</span>

                <span>
                  GPS: {selectedBus.latitude ?? "—"},{" "}
                  {selectedBus.longitude ?? "—"}
                </span>
              </div>

              <div className="portal-map-container">
                <BusMap bus={selectedBus} />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

// =====================================================
// MAIN APP
// =====================================================

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(getStoredUser);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("velocity-theme");

    return savedTheme === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("velocity-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === "light" ? "dark" : "light"
    );
  };

  // Refresh stored user when navigating
  useEffect(() => {
    setUser(getStoredUser());
    setSidebarOpen(false);
  }, [location.pathname]);

  // Listen for login/logout events
  useEffect(() => {
    const refreshUser = () => setUser(getStoredUser());

    window.addEventListener("storage", refreshUser);
    window.addEventListener(
      "velocity-auth-changed",
      refreshUser
    );

    return () => {
      window.removeEventListener("storage", refreshUser);
      window.removeEventListener(
        "velocity-auth-changed",
        refreshUser
      );
    };
  }, []);

  // Close sidebar with Escape
  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setSidebarOpen(false);
    setUser(null);

    window.dispatchEvent(new Event("velocity-auth-changed"));

    navigate("/", { replace: true });
  };

  const defaultPath = getDashboardPath(user);

  return (
    <Routes>
      {/* PUBLIC ROUTES */}

      <Route
        path="/"
        element={<RoleSelection theme={theme} onToggleTheme={toggleTheme} />}
      />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/conductor/login" element={<Login />} />

      <Route
        path="/driver/signup"
        element={<DriverSignup />}
      />

      <Route
        path="/conductor/signup"
        element={<ConductorSignup />}
      />

      <Route
        path="/driver/login"
        element={<DriverLogin />}
      />

      {/* PROTECTED APP LAYOUT */}

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="portal-layout">
              <button
                type="button"
                className={`portal-sidebar-backdrop ${
                  sidebarOpen ? "visible" : ""
                }`}
                aria-label="Close navigation menu"
                aria-hidden={!sidebarOpen}
                tabIndex={sidebarOpen ? 0 : -1}
                onClick={() => setSidebarOpen(false)}
              />

              <aside
                id="velocity-sidebar"
                className={`portal-sidebar ${
                  sidebarOpen ? "is-open" : ""
                }`}
              >
                <NavLink
                  to={defaultPath}
                  className="portal-brand"
                  onClick={() => setSidebarOpen(false)}
                  tabIndex={sidebarOpen ? 0 : -1}
                >
                  <span className="portal-logo">V</span>

                  <span className="portal-brand-text">
                    Velo<strong>City</strong>
                    <small>SMART TRANSIT</small>
                  </span>
                </NavLink>

                <p className="portal-menu-title">
                  MAIN MENU
                </p>

                <nav className="portal-nav">
                  {menuItems
                    .filter((item) =>
                      item.roles.includes(user?.role)
                    )
                    .map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.end}
                        onClick={() => setSidebarOpen(false)}
                        tabIndex={sidebarOpen ? 0 : -1}
                        className={({ isActive }) =>
                          `portal-nav-link ${
                            isActive ? "active" : ""
                          }`
                        }
                      >
                        <span className="portal-nav-icon">
                          {item.icon}
                        </span>

                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                </nav>

                <div className="portal-sidebar-footer">
                  <span className="portal-online-dot" />
                  <span>VeloCity</span>

                  <small>
                    {user?.firstName || user?.role}
                  </small>

                  <button
                    type="button"
                    className="search-button"
                    onClick={handleLogout}
                    tabIndex={sidebarOpen ? 0 : -1}
                    style={{
                      marginTop: "12px",
                      width: "100%",
                    }}
                  >
                    Logout
                  </button>
                </div>
              </aside>

              <div className="portal-main">
                <header className="portal-topbar">
                  <button
                    type="button"
                    className="portal-menu-toggle"
                    onClick={() =>
                      setSidebarOpen((open) => !open)
                    }
                    aria-label={
                      sidebarOpen ? "Close menu" : "Open menu"
                    }
                    aria-expanded={sidebarOpen}
                    aria-controls="velocity-sidebar"
                  >
                    {sidebarOpen ? "✕" : "☰"}
                  </button>

                  <div className="portal-topbar-title">
                    <span>
                      VELOCITY • SMART TRANSPORT
                    </span>

                    <h2>Welcome to VeloCity</h2>
                  </div>

                  <button
                    type="button"
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label={`Switch to ${
                      theme === "light" ? "dark" : "light"
                    } mode`}
                    title="Change website appearance"
                  >
                    <span className="theme-toggle-icon">
                      {theme === "light" ? "🌙" : "☀️"}
                    </span>

                    <span className="theme-toggle-label">
                      {theme === "light"
                        ? "Dark Mode"
                        : "Light Mode"}
                    </span>
                  </button>

                  <span className="portal-status">
                    ● {user?.role || "User"} Dashboard
                  </span>
                </header>

                <main className="portal-content">
                  <Routes>
                    {/* DEFAULT DASHBOARD */}

                    <Route
                      path="/"
                      element={
                        <Navigate
                          to={defaultPath}
                          replace
                        />
                      }
                    />

                    {/* HOME */}

                    <Route
                      path="/home"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Passenger", "Admin"]}
                        >
                          <HomePage />
                        </ProtectedRoute>
                      }
                    />

                    {/* BUS TRACKING */}

                    <Route
                      path="/tracking"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Passenger", "Admin"]}
                        >
                          <TrackingPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* BUS–DRIVER ASSIGNMENT */}

                    <Route
                      path="/assign-driver"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Admin"]}
                        >
                          <DriverAssignment />
                        </ProtectedRoute>
                      }
                    />

                    {/* BUS–CONDUCTOR ASSIGNMENT */}

                    <Route
                      path="/assign-conductor"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Admin"]}
                        >
                          <ConductorAssignment />
                        </ProtectedRoute>
                      }
                    />

                    {/* DRIVER DASHBOARD */}

                    <Route
                      path="/driver"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Driver"]}
                        >
                          <DriverDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* CONDUCTOR DASHBOARD */}

                    <Route
                      path="/conductor"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Conductor"]}
                        >
                          <ConductorDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* ADMIN DASHBOARD */}

                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Admin"]}
                        >
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* ADD BUS */}

                    <Route
                      path="/admin/add-bus"
                      element={
                        <ProtectedRoute
                          allowedRoles={["Admin"]}
                        >
                          <AddBus />
                        </ProtectedRoute>
                      }
                    />

                    {/* UNKNOWN ROUTES */}

                    <Route
                      path="*"
                      element={
                        <Navigate
                          to={defaultPath}
                          replace
                        />
                      }
                    />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
