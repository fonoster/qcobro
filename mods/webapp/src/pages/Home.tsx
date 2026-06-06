import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";

export function Home() {
  const { t } = useI18n();
  const ping = trpc.health.ping.useQuery({ message: "hello from the console" });

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{t("home.heading")}</h2>
      <p className="text-gray-600">{ping.data ? ping.data.message : "…"}</p>
    </section>
  );
}
