import { JERUSALEM_TZ } from "@/lib/social-media/constants";

/** Combine YYYY-MM-DD + HH:mm in Asia/Jerusalem → ISO UTC string. */
export function jerusalemDateTimeToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error("Invalid date or time");
  }

  for (const offsetHours of [2, 3]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, hh - offsetHours, mm, 0));
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: JERUSALEM_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";

    const checkDate = `${get("year")}-${get("month")}-${get("day")}`;
    const checkTime = `${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`;

    if (checkDate === date && checkTime === time) {
      return candidate.toISOString();
    }
  }

  throw new Error("Could not resolve Jerusalem timezone for date/time");
}

export function isoToJerusalemDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function isoToJerusalemTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: JERUSALEM_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function monthRangeIso(year: number, month: number): {
  start: string;
  end: string;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;
  return {
    start: jerusalemDateTimeToIso(startDate, "00:00"),
    end: jerusalemDateTimeToIso(endDate, "23:59"),
  };
}
