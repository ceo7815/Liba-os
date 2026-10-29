import { surenseConfigured, surenseFetch, surensePost } from "@/lib/surense/client";
import { publicErrorText } from "@/lib/sync-log";
import { isMissingRelation } from "@/lib/shemesh/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHEMESH_HANDLERS, SHEMESH_SUPPLIER_SOURCES } from "@/lib/shemesh/catalog";
import { isShemeshSourceName } from "@/lib/finance/operating-brand";
import { normKey, type GviyaDeal, type SheetContact } from "@/lib/shemesh/gviya";

export type SurensePerson = {
  name: string;
  phone: string;
  idNumber: string;
  source: string;
  handler: string;
  kind: "lead" | "process";
};

export type SurenseMatch = {
  configured: boolean;
  error: string | null;
  scanned: number;
  dealMatched: Set<string>;
  contactFound: Set<string>;
};

const EMPTY: SurenseMatch = {
  configured: false,
  error: null,
  scanned: 0,
  dealMatched: new Set(),
  contactFound: new Set(),
};

function text(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function inList(value: string, list: readonly string[]): boolean {
  const key = normKey(value);
  if (!key) return false;
  return list.some((item) => normKey(item) === key || key.includes(normKey(item)));
}

function asPerson(row: Record<string, unknown>, kind: "lead" | "process"): SurensePerson | null {
  const name = text(row, ["fullName", "customerFullName", "name", "customerName"]);
  const phone = text(row, ["phone", "mobile", "phoneNumber", "cellPhone", "phoneNumber1"]);
  const idNumber = text(row, ["idNumber", "nationalId", "zehut", "customerIdNumber"]);
  const source = text(row, ["sourceName", "source"]);
  const handler = text(row, ["assigneeName", "assignedUserName", "ownerName", "handlerName"]);
  if (!name && !phone && !idNumber) return null;
  if (source && !inList(source, SHEMESH_SUPPLIER_SOURCES)) return null;
  if (handler && !inList(handler, SHEMESH_HANDLERS)) return null;
  return { name, phone, idNumber, source, handler, kind };
}

async function searchPages(path: string, source: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let start = 0;
  for (let page = 0; page < 4; page += 1) {
    const response = await surensePost(path, {
      startRow: start,
      endRow: start + 50,
      filtersOperator: "and",
      filters: [{ field: "sourceName", operator: "equals", value: source }],
    });
    if (!response.ok) {
      const detail = publicErrorText(await response.text().catch(() => ""));
      throw new Error(detail ? `Surense ${path} ${response.status}: ${detail}` : `Surense ${path} ${response.status}`);
    }
    const payload = (await response.json()) as { results?: Record<string, unknown>[]; hasNextPage?: boolean };
    const batch = payload.results ?? [];
    rows.push(...batch);
    if (!payload.hasNextPage || batch.length === 0) break;
    start += 50;
  }
  return rows;
}

export async function matchShemeshSurense(
  deals: GviyaDeal[],
  contacts: SheetContact[],
): Promise<SurenseMatch> {
  if (!surenseConfigured()) return EMPTY;
  try {
    const batches = await Promise.all(
      SHEMESH_SUPPLIER_SOURCES.flatMap((source) => [
        searchPages("/leads/search", source).catch(() => [] as Record<string, unknown>[]),
        searchPages("/workflows/search", source).catch(() => [] as Record<string, unknown>[]),
      ]),
    );
    const people: SurensePerson[] = [];
    batches.forEach((rows, index) => {
      const kind = index % 2 === 0 ? "lead" : "process";
      for (const row of rows) {
        const person = asPerson(row, kind);
        if (person) people.push(person);
      }
    });
    if (people.length === 0) {
      const probe = await surenseFetch("/customers/sources");
      if (!probe.ok) {
        const detail = publicErrorText(await probe.text().catch(() => ""));
        return {
          ...EMPTY,
          configured: true,
          error: detail ? `Surense /customers/sources ${probe.status}: ${detail}` : `Surense ${probe.status}`,
        };
      }
    }
    const byName = new Set(people.map((person) => normKey(person.name)).filter(Boolean));
    const byPhone = new Set(people.map((person) => digits(person.phone)).filter((value) => value.length >= 9));
    const byId = new Set(people.map((person) => digits(person.idNumber)).filter((value) => value.length >= 8));
    const dealMatched = new Set<string>();
    for (const deal of deals) {
      if (byName.has(normKey(deal.client))) dealMatched.add(deal.id);
    }
    const contactFound = new Set<string>();
    for (const contact of contacts) {
      const phone = digits(contact.phone);
      const idNumber = digits(contact.idNumber);
      if (
        (contact.name && byName.has(normKey(contact.name))) ||
        (phone.length >= 9 && byPhone.has(phone)) ||
        (idNumber.length >= 8 && byId.has(idNumber))
      ) {
        contactFound.add(contact.id);
      }
    }
    return { configured: true, error: null, scanned: people.length, dealMatched, contactFound };
  } catch (error) {
    const message = publicErrorText(error instanceof Error ? error.message : "Surense לא זמין");
    console.error("[surense-sync] shemesh match failed", { message });
    return { ...EMPTY, configured: true, error: message };
  }
}

function handlerMatches(value: string): boolean {
  const key = normKey(value);
  if (!key) return false;
  return SHEMESH_HANDLERS.some((name) => key === normKey(name) || key.includes(normKey(name)));
}

function indexPeople(people: SurensePerson[], deals: GviyaDeal[], contacts: SheetContact[]): SurenseMatch {
  const byName = new Set(people.map((person) => normKey(person.name)).filter(Boolean));
  const dealMatched = new Set<string>();
  for (const deal of deals) {
    if (byName.has(normKey(deal.client))) dealMatched.add(deal.id);
  }
  const contactFound = new Set<string>();
  for (const contact of contacts) {
    if (contact.name && byName.has(normKey(contact.name))) contactFound.add(contact.id);
  }
  return { configured: true, error: null, scanned: people.length, dealMatched, contactFound };
}

/** Read-only match against the last stored Surense snapshot. Never calls Surense. */
export async function matchStoredSnapshot(deals: GviyaDeal[], contacts: SheetContact[]): Promise<SurenseMatch> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("lead_control_snapshots")
      .select("items")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error.message)) {
        return { ...EMPTY, error: "צילום שורנס עדיין לא קיים במסד. אחרי «סנכרון מערכת» תופיע כאן ההצלבה." };
      }
      return { ...EMPTY, configured: true, error: error.message };
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    const people: SurensePerson[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as { name?: unknown; source?: unknown; assignee?: unknown; kind?: unknown };
      const name = typeof row.name === "string" ? row.name : "";
      const source = typeof row.source === "string" ? row.source : "";
      const handler = typeof row.assignee === "string" ? row.assignee : "";
      const sourceOk = isShemeshSourceName(source);
      const handlerOk = handlerMatches(handler);
      if (source && handler && !(sourceOk && handlerOk)) continue;
      if (!sourceOk && !handlerOk) continue;
      if (!name) continue;
      people.push({
        name,
        phone: "",
        idNumber: "",
        source,
        handler,
        kind: row.kind === "workflow" ? "process" : "lead",
      });
    }
    return indexPeople(people, deals, contacts);
  } catch (error) {
    const message = publicErrorText(error instanceof Error ? error.message : "הצילום לא נקרא");
    return { ...EMPTY, error: message };
  }
}
