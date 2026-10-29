import { formatCount, formatIls } from "@/lib/format/numbers";

export function formatShemeshMoney(value: number | null): string {
  return formatIls(value);
}

export function formatShemeshCount(value: number | null): string {
  return formatCount(value);
}

export function formatShemeshRate(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("he-IL", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatShemeshDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}

export function formatShemeshMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [year, monthNumber] = month.split("-");
  return `${monthNumber}.${year}`;
}
