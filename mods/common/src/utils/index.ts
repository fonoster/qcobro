export function formatMoney(amount: number, currency = "DOP"): string {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}
