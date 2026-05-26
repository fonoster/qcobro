import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Carteras } from "./pages/Carteras.js";
import { Campanas } from "./pages/Campanas.js";
import { Gestiones } from "./pages/Gestiones.js";
import { Promesas } from "./pages/Promesas.js";
import { Agentes } from "./pages/Agentes.js";
import { Rendimiento } from "./pages/Rendimiento.js";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/panel" replace />} />
        <Route path="/panel" element={<Dashboard />} />
        <Route path="/carteras" element={<Carteras />} />
        <Route path="/campanas" element={<Campanas />} />
        <Route path="/gestiones" element={<Gestiones />} />
        <Route path="/promesas" element={<Promesas />} />
        <Route path="/agentes" element={<Agentes />} />
        <Route path="/rendimiento" element={<Rendimiento />} />
      </Route>
    </Routes>
  );
}
