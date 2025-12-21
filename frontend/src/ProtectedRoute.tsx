// ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const isAuthenticated =
    typeof window !== "undefined" &&
    localStorage.getItem("isAuthenticated") === "true";

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}