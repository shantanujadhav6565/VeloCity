
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({
  children,
  allowedRoles,
}) {
  const location = useLocation();

  const token =
    sessionStorage.getItem("token") ||
    localStorage.getItem("token");

  const savedUser =
    sessionStorage.getItem("user") ||
    localStorage.getItem("user");

  let user = null;

  try {
    user = savedUser ? JSON.parse(savedUser) : null;
  } catch {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  if (!token || !user || !user.role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  const dashboardPaths = {
    Admin: "/admin",
    Driver: "/driver",
    Conductor: "/conductor",
    Passenger: "/home",
  };

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    const correctPath = dashboardPaths[user.role] || "/login";

    return (
      <Navigate
        to={correctPath}
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}
