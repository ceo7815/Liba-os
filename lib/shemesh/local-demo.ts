import { execFile } from "node:child_process";
import type { Profile } from "@/lib/types";

/** Local review only. Never set this on the server. */
export function localDemoEnabled(): boolean {
  return process.env.SHEMESH_LOCAL_DEMO === "1";
}

export const LOCAL_DEMO_PROFILE: Profile = {
  id: "local-demo",
  email: "demo@shemesh.local",
  full_name: "הדגמה",
  role: "admin",
  is_active: true,
  created_at: "2026-10-01T00:00:00.000Z",
  permissionKeys: ["shemesh.view", "shemesh.manage"],
};

const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLE = /^shemesh_[a-z0-9_]+$/;

export type ShemeshResult = {
  data: any;
  error: { message: string } | null;
  count: number | null;
};

type Mode = "many" | "maybe" | "single";

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error("שם עמודה לא תקין");
  return `"${name}"`;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function definedRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function literal(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "object") return `${quote(JSON.stringify(value))}::jsonb`;
  return quote(String(value));
}

function psql(sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "sudo",
      ["-u", "postgres", "psql", "-d", "shemesh_demo", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
      { maxBuffer: 8 * 1024 * 1024, env: { ...process.env, PGCLIENTENCODING: "UTF8" } },
      (error, stdout, stderr) => {
        if (error) {
          const message = `${stderr || ""}`.trim() || error.message;
          reject(new Error(message));
          return;
        }
        resolve(String(stdout).trim());
      },
    );
  });
}

const primaryKeys = new Map<string, string[]>();

async function primaryKey(table: string): Promise<string[]> {
  const cached = primaryKeys.get(table);
  if (cached) return cached;
  const sql = `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) WHERE i.indrelid = 'public.${table}'::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`;
  const text = await psql(sql);
  const columns = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!columns.length) throw new Error(`אין מפתח ל־${table}`);
  primaryKeys.set(table, columns);
  return columns;
}

export class LocalQuery implements PromiseLike<ShemeshResult> {
  private filters: { column: string; value: unknown }[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private columns = "*";
  private head = false;
  private operation: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Record<string, unknown> | null = null;
  private mode: Mode = "many";
  private returning = false;

  constructor(private readonly table: string) {
    if (!TABLE.test(table)) throw new Error("טבלה לא של שמש");
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    this.columns = columns;
    this.head = Boolean(options?.head);
    if (this.operation === "insert" || this.operation === "upsert") this.returning = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.limitN = count;
    return this;
  }

  insert(row: Record<string, unknown>): this {
    this.operation = "insert";
    this.payload = row;
    return this;
  }

  update(row: Record<string, unknown>): this {
    this.operation = "update";
    this.payload = row;
    return this;
  }

  upsert(row: Record<string, unknown>): this {
    this.operation = "upsert";
    this.payload = row;
    return this;
  }

  maybeSingle(): Promise<ShemeshResult> {
    this.mode = "maybe";
    return this.run();
  }

  single(): Promise<ShemeshResult> {
    this.mode = "single";
    this.returning = true;
    return this.run();
  }

  then<TResult1 = ShemeshResult, TResult2 = never>(
    onfulfilled?: ((value: ShemeshResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private where(): string {
    if (!this.filters.length) return "";
    const parts = this.filters.map((filter) => `${ident(filter.column)} = ${literal(filter.value)}`);
    return ` WHERE ${parts.join(" AND ")}`;
  }

  private columnList(): string {
    if (this.columns.trim() === "*") return "*";
    return this.columns.split(",").map((column) => ident(column.trim())).join(", ");
  }

  private async run(): Promise<ShemeshResult> {
    try {
      if (this.operation === "select") return await this.runSelect();
      if (this.operation === "insert") return await this.runInsert(false);
      if (this.operation === "upsert") return await this.runInsert(true);
      return await this.runUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "המסד המקומי לא נקרא";
      return { data: null, error: { message }, count: null };
    }
  }

  private async runSelect(): Promise<ShemeshResult> {
    if (this.head) {
      const countText = await psql(`SELECT count(*)::int FROM public.${this.table}${this.where()}`);
      return { data: null, error: null, count: Number(countText) || 0 };
    }
    let sql = `SELECT coalesce(json_agg(row_to_json(q)), '[]'::json) FROM (SELECT ${this.columnList()} FROM public.${this.table}${this.where()}`;
    if (this.orderBy) sql += ` ORDER BY ${ident(this.orderBy.column)} ${this.orderBy.ascending ? "ASC" : "DESC"}`;
    if (this.limitN != null) sql += ` LIMIT ${Math.max(0, Math.floor(this.limitN))}`;
    sql += ") q";
    const rows = JSON.parse(await psql(sql)) as unknown[];
    if (this.mode === "many") return { data: rows, error: null, count: null };
    if (rows.length > 1) return { data: null, error: { message: "יותר משורה אחת" }, count: null };
    if (this.mode === "single" && rows.length !== 1) return { data: null, error: { message: "השורה לא נמצאה" }, count: null };
    return { data: rows[0] ?? null, error: null, count: null };
  }

  private async runInsert(conflictUpdate: boolean): Promise<ShemeshResult> {
    const row = definedRow(this.payload ?? {});
    const keys = Object.keys(row);
    if (!keys.length) return { data: null, error: { message: "אין עמודות" }, count: null };
    const cols = keys.map((key) => ident(key)).join(", ");
    const values = keys.map((key) => literal(row[key])).join(", ");
    let sql = `INSERT INTO public.${this.table} (${cols}) VALUES (${values})`;
    if (conflictUpdate) {
      const keysToKeep = await primaryKey(this.table);
      const updates = keys.filter((key) => !keysToKeep.includes(key)).map((key) => `${ident(key)} = EXCLUDED.${ident(key)}`);
      sql += ` ON CONFLICT (${keysToKeep.map((key) => ident(key)).join(", ")}) DO ${updates.length ? `UPDATE SET ${updates.join(", ")}` : "NOTHING"}`;
    }
    if (this.returning || this.mode !== "many") sql += ` RETURNING row_to_json(${this.table})`;
    if (!sql.includes("RETURNING")) {
      await psql(sql);
      return { data: null, error: null, count: null };
    }
    const text = await psql(sql);
    const data = text ? JSON.parse(text) : null;
    return { data, error: null, count: null };
  }

  private async runUpdate(): Promise<ShemeshResult> {
    const row = definedRow(this.payload ?? {});
    const keys = Object.keys(row);
    if (!keys.length) return { data: null, error: null, count: null };
    const sets = keys.map((key) => `${ident(key)} = ${literal(row[key])}`).join(", ");
    await psql(`UPDATE public.${this.table} SET ${sets}${this.where()}`);
    return { data: null, error: null, count: null };
  }
}

export function localDemoAdmin(): { from: (table: string) => LocalQuery } {
  return { from: (table: string) => new LocalQuery(table) };
}
