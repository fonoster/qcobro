import { Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./pages/Login.js";
import { SignUp } from "./pages/SignUp.js";
import { CreateWorkspace } from "./pages/CreateWorkspace.js";
import { AcceptInvitation } from "./pages/AcceptInvitation.js";
import { Home } from "./pages/Home.js";
import { Members } from "./pages/Members.js";
import { RequireAuth } from "./components/RequireAuth.js";
import { AuthedLayout } from "./components/AuthedLayout.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/invite" element={<AcceptInvitation />} />
      <Route
        path="/create-workspace"
        element={
          <RequireAuth>
            <CreateWorkspace />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AuthedLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="members" element={<Members />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
