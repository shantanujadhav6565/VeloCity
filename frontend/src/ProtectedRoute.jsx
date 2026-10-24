
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({
  children,
  allowedRoles,
}) {
  const location = useLocation();

  // Pratyek tab chi independent login session
  const token = sessionStorage.getItem("token");
  const savedUser = sessionStorage.getItem("user");

  let user = null;

  try {
    user = savedUser ? JSON.parse(savedUser) : null;
  } catch {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  }

  // Login nasel tar login page var pathva
  if (!token || !user || !user.role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // User role nusar access check kara
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "Admin") {
      return <Navigate to="/admin" replace />;
    }

    if (user.role === "Driver") {
      return <Navigate to="/driver" replace />;
    }

    if (user.role === "Passenger") {
      return <Navigate to="/home" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return children;
}
