import { Routes, Route, Navigate } from "react-router-dom";
import { useI18n } from "./lib/i18n.js";
import { LanguageSwitcher } from "./components/LanguageSwitcher.js";
import { Home } from "./pages/Home.js";

export default function App() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold">{t("app.title")}</h1>
          <p className="text-sm text-gray-500">{t("app.tagline")}</p>
        </div>
        <LanguageSwitcher />
      </header>
      <main className="px-6 py-8">
        <Routes>
          <Route index element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
