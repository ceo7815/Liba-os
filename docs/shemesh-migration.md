# Shemesh migration

Apply only after review. The app keeps working if these tables are missing: screens show an empty state.

File: `supabase/migrations/20261029180000_shemesh_operations.sql`

It is safe to run more than once. It creates only new `public.shemesh_*` objects. It does not `ALTER` or `DROP` any existing Liba table. Row level security on the new tables calls `private.is_admin()`, which already exists in this project. The file inserts no rows and no amounts.

## Extension

- `pgcrypto` (for `gen_random_uuid()`), created only if it is missing

## Tables

| Table | What it holds |
| --- | --- |
| `shemesh_fee_settings` | One row (`id = 1`): redemption fee rate, tax fee rate, VAT rate, SLA days |
| `shemesh_audit` | Who changed what, and a short summary |
| `shemesh_cases` | Client, stage, status, handler, opened date, deadline, notes |
| `shemesh_case_tasks` | Tasks on a case |
| `shemesh_case_documents` | Document checklist on a case |
| `shemesh_case_notes` | Notes on a case |
| `shemesh_ledger` | Redemption and tax-refund lines, with fee rate, fee, and net stored from the settings at save time |
| `shemesh_rules` | Recurring or one-time cost, debt, income, payroll, and commission rules |
| `shemesh_month_lines` | Optional posted lines for a month. The monthly screen also derives lines from active rules |
| `shemesh_facebook_settings` | One row: Shemesh Meta token, encrypted |
| `shemesh_google_settings` | One row: refresh token, chosen customer, candidate customers |
| `shemesh_excel_settings` | One row: Graph drive and item ids for the Shemesh sales file |
| `shemesh_surense_settings` | One row: same agency or separate credentials |
| `shemesh_provider_secrets` | Rivhit, Grow, and insurance URL plus encrypted key |

## Indexes

- `shemesh_cases_stage_idx` on `(stage, status)`
- `shemesh_ledger_kind_idx` on `(kind, day)`
- `shemesh_audit_created_idx` on `created_at DESC`

## Access

For each table above:

- Row level security is enabled
- `anon` and `authenticated` have no default privileges
- `authenticated` may `SELECT`
- Policy `<table>_admin` allows `ALL` only when `private.is_admin()` is true

Writes from the app use the service role, which bypasses these policies.

## Earlier Shemesh files

Apply older Shemesh migrations first if they are not already on the database. They also create only `shemesh_*` objects:

- `20261011072606_shemesh_operating_model.sql` — sources, formulas, leads, spend, revenue, expenses
- `20261011123000_shemesh_sales_workbooks.sql` — stored sales workbook
- `20261029140000_shemesh_later_stages.sql` — fixed costs, obligations, receipts, bank lines, insurance rows, income items, settlements, pay profiles, agency settings, message templates, revival queue

## Demo data

`scripts/dev/shemesh-demo-seed.sql` is for a local database only. Do not run it in production.
