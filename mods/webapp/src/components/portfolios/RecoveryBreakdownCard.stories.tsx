import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { RecoveryBreakdown } from "@qcobro/common";
import { RecoveryBreakdownCard, type RecoveryDimension } from "./RecoveryBreakdownCard.js";

const money = (value: number) => `$${value.toLocaleString("en-US")}`;

const DATA: Record<RecoveryDimension, RecoveryBreakdown> = {
  DAYS_SINCE_TOUCH: {
    additive: true,
    rows: [
      { key: "0-1", name: null, amount: 4500, count: 2 },
      { key: "2-3", name: null, amount: 3000, count: 1 },
      { key: "4-7", name: null, amount: 2100, count: 1 }
    ]
  },
  CAMPAIGN: {
    additive: false,
    rows: [
      { key: "c1", name: "Mora 8–30", amount: 7500, count: 3 },
      { key: "c2", name: "Recordatorio SMS", amount: 3000, count: 1 }
    ]
  },
  CHANNEL: {
    additive: true,
    rows: [
      { key: "VOICE_AI", name: null, amount: 4500, count: 2 },
      { key: "SMS", name: null, amount: 3000, count: 1 },
      { key: "WHATSAPP", name: null, amount: 2100, count: 1 }
    ]
  },
  OUTCOME: {
    additive: true,
    rows: [
      { key: "PAYMENT_PROMISE", name: null, amount: 7500, count: 3 },
      { key: "ABANDONED", name: null, amount: 2100, count: 1 },
      { key: "NONE", name: null, amount: 3000, count: 1 }
    ]
  }
};

function Interactive({ initial, empty }: { initial: RecoveryDimension; empty?: boolean }) {
  const [by, setBy] = useState<RecoveryDimension>(initial);
  return (
    <div className="w-[560px]">
      <RecoveryBreakdownCard
        by={by}
        onByChange={setBy}
        data={empty ? { additive: by !== "CAMPAIGN", rows: [] } : DATA[by]}
        money={money}
      />
    </div>
  );
}

const meta = {
  title: "Portfolios/RecoveryBreakdownCard",
  component: RecoveryBreakdownCard,
  parameters: { layout: "padded" }
} satisfies Meta<typeof RecoveryBreakdownCard>;

export default meta;

export const Days: StoryObj = { render: () => <Interactive initial="DAYS_SINCE_TOUCH" /> };
export const Campaign: StoryObj = { render: () => <Interactive initial="CAMPAIGN" /> };
export const Channel: StoryObj = { render: () => <Interactive initial="CHANNEL" /> };
export const Outcome: StoryObj = { render: () => <Interactive initial="OUTCOME" /> };
export const Empty: StoryObj = { render: () => <Interactive initial="CHANNEL" empty /> };
