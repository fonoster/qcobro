import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { RecoveryKind } from "@qcobro/common";
import { RecoveryListCard, type GestionFilter, type RecoveryListRow } from "./RecoveryListCard.js";

const money = (value: number) => `$${value.toLocaleString("en-US")}`;
const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(date));

function item(
  id: string,
  fullName: string,
  externalId: string,
  kind: RecoveryKind,
  installments: number,
  amount: number,
  lastTouch: { agentType: string; days: number } | null
): RecoveryListRow {
  return {
    id,
    portfolioId: "p1",
    portfolioAccountId: `a-${id}`,
    externalId,
    fullName,
    kind,
    installments,
    amount,
    detectedAt: "2026-11-12T15:00:00.000Z",
    context: {
      hasGestion: lastTouch !== null,
      touches: lastTouch ? 1 : 0,
      activeCampaigns: [],
      lastTouch: lastTouch
        ? {
            contactLogId: `l-${id}`,
            agentType: lastTouch.agentType,
            delivery: "DELIVERED",
            path: "ENGAGED",
            outcome: null,
            contactedAt: "2026-11-11T15:00:00.000Z"
          }
        : null,
      daysSinceLastTouch: lastTouch?.days ?? null
    }
  };
}

const ITEMS = [
  item("1", "Ana Pérez", "LN-54091", "CAUGHT_UP", 3, 4500, { agentType: "VOICE_AI", days: 1 }),
  item("2", "Luis Gómez", "LN-23174", "PARTIAL", 2, 3000, { agentType: "SMS", days: 3 }),
  item("3", "Sofía Méndez", "LN-67438", "PAID_OFF", 1, 2100, { agentType: "WHATSAPP", days: 5 }),
  item("4", "Carlos Ruiz", "LN-19863", "PARTIAL", 1, 1500, null)
];

function Interactive({ items, totalPages = 1 }: { items: RecoveryListRow[]; totalPages?: number }) {
  const [kind, setKind] = useState<RecoveryKind | "all">("all");
  const [gestion, setGestion] = useState<GestionFilter>("all");
  const [page, setPage] = useState(1);
  return (
    <div className="w-[640px]">
      <RecoveryListCard
        items={items}
        kind={kind}
        onKindChange={setKind}
        gestion={gestion}
        onGestionChange={setGestion}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        money={money}
        formatDate={formatDate}
      />
    </div>
  );
}

const meta = {
  title: "Portfolios/RecoveryListCard",
  component: RecoveryListCard,
  parameters: { layout: "padded" }
} satisfies Meta<typeof RecoveryListCard>;

export default meta;

export const Default: StoryObj = { render: () => <Interactive items={ITEMS} /> };
export const Paged: StoryObj = { render: () => <Interactive items={ITEMS} totalPages={3} /> };
export const Empty: StoryObj = { render: () => <Interactive items={[]} /> };
