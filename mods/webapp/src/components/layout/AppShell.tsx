import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";

export function AppShell() {
  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
