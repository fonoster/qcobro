import type { AccountRowInput } from "@qcobro/common";

export type { AccountRowInput as CsvRow };

function cell(cells: string[], header: string[], name: string): string {
  const idx = header.indexOf(name);
  return idx >= 0 ? (cells[idx] ?? "").trim() : "";
}

function num(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function int(v: string): number {
  const n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export function parseCsv(text: string): { rows: AccountRowInput[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ["El archivo debe tener encabezado y al menos una fila de datos."] };
  }

  const header = lines[0]
    .toLowerCase()
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const required = ["loan_id", "full_name", "outstanding_balance"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        `Columnas requeridas faltantes: ${missing.join(", ")}. Se esperaban: loan_id, full_name, outstanding_balance`
      ]
    };
  }

  const rows: AccountRowInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const c = (name: string) => cell(cells, header, name);

    const externalId = c("loan_id");
    const fullName = c("full_name");
    const rawBalance = c("outstanding_balance");

    if (!externalId) {
      errors.push(`Fila ${i + 1}: loan_id vacío`);
      continue;
    }
    if (!fullName) {
      errors.push(`Fila ${i + 1}: full_name vacío`);
      continue;
    }
    if (!rawBalance) {
      errors.push(`Fila ${i + 1}: outstanding_balance vacío`);
      continue;
    }

    const negotiationRaw = c("negotiation_options");
    let negotiationOptions: string | undefined;
    if (negotiationRaw && negotiationRaw !== "[]" && negotiationRaw !== "") {
      try {
        JSON.parse(negotiationRaw);
        negotiationOptions = negotiationRaw;
      } catch {
        // malformed JSON — drop silently
      }
    }

    rows.push({
      externalId,
      fullName,
      phone: c("phone_number") || undefined,
      preferredLanguage: c("preferred_language") || undefined,
      bestTimeToCall: c("best_time_to_call") || undefined,
      customerSegment: c("customer_segment") || undefined,
      principalAmount: num(c("principal_amount")),
      termsAmount: num(c("terms_amount")),
      termsFrequency: c("terms_frequency") || undefined,
      termsLength: int(c("terms_length")),
      outstandingBalance: num(rawBalance),
      daysPastDue: int(c("days_past_due")),
      missedInstallments: int(c("missed_installments")),
      lastPaymentDate: c("last_payment_date") || undefined,
      lastPaymentAmount: c("last_payment_amount") ? num(c("last_payment_amount")) : undefined,
      negotiationOptions
    });
  }

  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}
