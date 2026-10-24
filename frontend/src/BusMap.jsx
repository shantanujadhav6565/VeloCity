
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./BusMap.css";

const defaultCenter = [18.5204, 73.8567];

const cityCoordinates = {
  solapur: [17.6599, 75.9064],
  pune: [18.5204, 73.8567],
  hinjawadi: [18.5913, 73.7389],
  "hinjawadi phase 3": [18.5913, 73.7389],
  barshi: [18.2334, 75.6942],
};

function validCoordinate(lat, lng) {
  if (
    lat === null ||
    lat === undefined ||
    lng === null ||
    lng === undefined ||
    lat === "" ||
    lng === ""
  ) {
    return false;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getCityCoordinates(name) {
  if (!name) return null;

  const normalizedName = String(name)
    .trim()
    .toLowerCase();

  if (cityCoordinates[normalizedName]) {
    return cityCoordinates[normalizedName];
  }

  // Match known city names inside longer location labels.
  const match = Object.keys(cityCoordinates).find((city) =>
    normalizedName.includes(city)
  );

  return match ? cityCoordinates[match] : null;
}

function MapUpdater({ position, source, destination }) {
  const map = useMap();

  useEffect(() => {
    if (source && destination) {
      const bounds = L.latLngBounds([source, destination]);

      if (position) {
        bounds.extend(position);
      }

      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 12,
      });
    } else if (position) {
      map.setView(position, 14);
    } else {
      map.setView(defaultCenter, 10);
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(timer);
  }, [
    map,
    source?.[0],
    source?.[1],
    destination?.[0],
    destination?.[1],
    position?.[0],
    position?.[1],
  ]);

  return null;
}

// Large bus marker
const busIcon = L.divIcon({
  className: "transit-bus-icon",
  html: `
    <div style="
      width: 44px;
      height: 44px;
      background: #2563eb;
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 27px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
    ">🚌</div>
  `,
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  popupAnchor: [0, -25],
});

// Source marker
const sourceIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      box-sizing: border-box;
      background: #16a34a;
      color: white;
      border: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 17px;
      box-shadow: 0 2px 8px #555;
    ">S</div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

// Destination marker
const destinationIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      box-sizing: border-box;
      background: #dc2626;
      color: white;
      border: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 17px;
      box-shadow: 0 2px 8px #555;
    ">D</div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

export default function BusMap({ bus }) {
  const [roadRoute, setRoadRoute] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const hasLocation =
    Boolean(bus) &&
    validCoordinate(bus.latitude, bus.longitude);

  const position = hasLocation
    ? [Number(bus.latitude), Number(bus.longitude)]
    : null;

  const source = useMemo(() => {
    if (!bus) return null;

    if (
      validCoordinate(
        bus.sourceLatitude,
        bus.sourceLongitude
      )
    ) {
      return [
        Number(bus.sourceLatitude),
        Number(bus.sourceLongitude),
      ];
    }

    return getCityCoordinates(bus.source);
  }, [
    bus?.source,
    bus?.sourceLatitude,
    bus?.sourceLongitude,
  ]);

  const destination = useMemo(() => {
    if (!bus) return null;

    if (
      validCoordinate(
        bus.destinationLatitude,
        bus.destinationLongitude
      )
    ) {
      return [
        Number(bus.destinationLatitude),
        Number(bus.destinationLongitude),
      ];
    }

    return getCityCoordinates(bus.destination);
  }, [
    bus?.destination,
    bus?.destinationLatitude,
    bus?.destinationLongitude,
  ]);

  const hasRoute = Boolean(source && destination);

  // Build GPS history from MongoDB locationHistory.
  const travelledRoute = useMemo(() => {
    const history = Array.isArray(bus?.locationHistory)
      ? bus.locationHistory
      : [];

    const points = [];

    for (const point of history) {
      if (
        !validCoordinate(
          point?.latitude,
          point?.longitude
        )
      ) {
        continue;
      }

      const nextPoint = [
        Number(point.latitude),
        Number(point.longitude),
      ];

      const previousPoint = points[points.length - 1];

      // Avoid consecutive duplicate coordinates.
      if (
        !previousPoint ||
        previousPoint[0] !== nextPoint[0] ||
        previousPoint[1] !== nextPoint[1]
      ) {
        points.push(nextPoint);
      }
    }

    // Include the current location if it is newer than history.
    if (position) {
      const lastPoint = points[points.length - 1];

      if (
        !lastPoint ||
        lastPoint[0] !== position[0] ||
        lastPoint[1] !== position[1]
      ) {
        points.push(position);
      }
    }

    return points;
  }, [
    bus?.locationHistory,
    position?.[0],
    position?.[1],
  ]);

  // Fetch the road route between source and destination.
  useEffect(() => {
    if (!source || !destination) {
      setRoadRoute([]);
      setRouteError("");
      setRouteLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadRoadRoute() {
      setRouteLoading(true);
      setRouteError("");

      try {
        const url =
          "https://router.project-osrm.org/route/v1/driving/" +
          `${source[1]},${source[0]};${destination[1]},${destination[0]}` +
          "?overview=full&geometries=geojson";

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Road route service is unavailable.");
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No road route was found.");
        }

        const coordinates =
          data.routes[0].geometry.coordinates;

        setRoadRoute(
          coordinates.map(([lng, lat]) => [lat, lng])
        );
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Road route error:", error);
          setRoadRoute([]);
          setRouteError(
            "Road route could not load. Please try again later."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    }

    loadRoadRoute();

    return () => controller.abort();
  }, [
    source?.[0],
    source?.[1],
    destination?.[0],
    destination?.[1],
  ]);

  if (!bus) {
    return (
      <div className="real-map-wrapper">
        Bus details unavailable.
      </div>
    );
  }

  return (
    <div className="real-map-wrapper">
      <MapContainer
        center={position || source || defaultCenter}
        zoom={11}
        scrollWheelZoom={true}
        className="real-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater
          position={position}
          source={source}
          destination={destination}
        />

        {/* Blue: full road route */}
        {roadRoute.length > 1 && (
          <Polyline
            positions={roadRoute}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.8,
            }}
          />
        )}

        {/* Orange: actual GPS path travelled */}
        {travelledRoute.length > 1 && (
          <Polyline
            positions={travelledRoute}
            pathOptions={{
              color: "#f97316",
              weight: 6,
              opacity: 1,
            }}
          />
        )}

        {/* Source marker */}
        {source && (
          <Marker position={source} icon={sourceIcon}>
            <Popup>
              <strong>
                START: {bus.source || "Source"}
              </strong>
            </Popup>
          </Marker>
        )}

        {/* Destination marker */}
        {destination && (
          <Marker
            position={destination}
            icon={destinationIcon}
          >
            <Popup>
              <strong>
                DESTINATION: {bus.destination || "Destination"}
              </strong>
            </Popup>
          </Marker>
        )}

        {/* Bus marker follows current GPS position */}
        {position && (
          <Marker position={position} icon={busIcon}>
            <Popup>
              <strong>Bus {bus.busNumber}</strong>
              <br />
              Status: {bus.status || "Unknown"}
              <br />
              Trip: {bus.tripStatus || "Unknown"}
              <br />
              Latitude: {position[0].toFixed(5)}
              <br />
              Longitude: {position[1].toFixed(5)}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {!hasLocation && (
        <div className="map-empty-message">
          <strong>Waiting for actual GPS location</strong>
        </div>
      )}

      <div className="map-location-info">
        <strong>
          {hasLocation
            ? "Actual GPS Location"
            : "Waiting for GPS"}
        </strong>

        <div className="map-route-text">
          🟢 {bus.source || "Source"} → 🔴{" "}
          {bus.destination || "Destination"}
        </div>

        {position && (
          <div className="map-coordinates">
            Latitude: {position[0].toFixed(5)} · Longitude:{" "}
            {position[1].toFixed(5)}
          </div>
        )}

        <div className="map-note">
          🔵 Blue: Full road route
          <br />
          🟠 Orange: GPS path travelled
          <br />

          {routeLoading && "Loading road route..."}

          {routeError && <p>{routeError}</p>}

          {travelledRoute.length < 2 &&
            "Travelled route will appear after multiple GPS points are saved."}
        </div>
      </div>
    </div>
  );
}
