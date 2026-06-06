import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";

export function Home() {
  const { t } = useI18n();
  const me = trpc.auth.me.useQuery();

  if (me.isLoading) {
    return <p className="text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{t("home.welcome")}</h2>
      {me.data?.user && <p className="text-gray-600">{me.data.user.accessKeyId}</p>}
      {me.data?.workspace && (
        <p className="text-sm text-gray-500">
          {t("home.role")}: {me.data.workspace.role}
        </p>
      )}
    </section>
  );
}
