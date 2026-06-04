import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell.js";
import { Login } from "./pages/Login.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Portfolios } from "./pages/Portfolios.js";
import { Campaigns } from "./pages/Campaigns.js";
import { Activities } from "./pages/Activities.js";
import { Commitments } from "./pages/Commitments.js";
import { Agents } from "./pages/Agents.js";
import { Performance } from "./pages/Performance.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/portfolios" element={<Portfolios />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/commitments" element={<Commitments />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/performance" element={<Performance />} />
      </Route>
    </Routes>
  );
}
