# Integration rehearsal

Branch `cursor/integration-rehearsal` starts at `origin/main` (`4cce0b1`), merges `origin/cursor/design-upgrade` (`4981ac5`), then merges `origin/cursor/shemesh-phase1` (`41f5027`).

Do not push those two source branches. Repeat this file when `shemesh-phase1` moves.

## Order

```bash
git fetch origin main cursor/design-upgrade cursor/shemesh-phase1
git checkout -b cursor/integration-rehearsal origin/main
git merge --no-edit origin/cursor/design-upgrade
git merge --no-edit origin/cursor/shemesh-phase1
```

`design-upgrade` merged with no conflicts on this base. `call-control-screen.tsx` also merged with no conflict: the CDR status block from main stayed, and the Hebrew `DateRangeField` from design stayed. If it conflicts later, keep the CDR fields and the date field, and restyle only class names.

## Rule

Keep Shemesh data paths, information architecture, and filters. Put design tokens and shared components on that behavior. Do not restore a design-only control that Shemesh replaced with different logic.

## Resolutions

### `app/(authenticated)/employees/page.tsx`

Shemesh locks the page to the Liba brand (`lockedBrand="liba"`) so Shemesh staff are not mixed into this list. Keep that prop. Keep design's full-width section (`w-full`), not Shemesh's `max-w-[72rem]`.

### `app/shemesh/layout.tsx`

Keep design's aurora, `os-mesh`, and page padding (`px-4 py-6 lg:py-8`). Keep Shemesh's breadcrumbs and `ShemeshSkeleton` loading state. Drop the duplicate `Aurora` import if both sides add one. Toaster stays out of the root layout (audit placement) and remains on this shell without `theme="light"`.

### `components/sales-dashboard/sales-excel-report-screen.tsx`

Shemesh removed the Liba/Shemesh brand toggle and filters rows with `includeInLibaSalesReport`. Do not restore `brand`, `brandCounts`, or `OPERATING_BRAND_LABEL`. Keep the design filter card (`border-border bg-card`) and `DateRangeField` around Shemesh's date, status, and agent controls.

### `components/shemesh/dashboard-screen.tsx`

The numbers (`readBoard`, `sliceAds`, `sliceMoney`) were already the same. Take the design presentation: `kpi-band`, `kpi-cube`, `kpi-hero`, `kpi-badge`, and separate campaign cards. Do not put the tiles back inside Shemesh's single bordered grid.

### `components/shemesh/nav.tsx`

Keep `SHEMESH_IA`, the stored open groups (`shemesh-nav-open`), and nested links. Highlight with `activePath` so a design-lab `?view=` still lights the real route. Glass shell is `side-glass` plus `border-black/[0.06]`. Icon color is `hsl(var(--highlight))`, not a hardcoded blue.

### `components/shemesh/topbar.tsx`

Search, sync, clock, and sign-out are unchanged. The avatar stays the quiet gray circle from design, not a `kpi-badge`.

### `components/shemesh/mobile-dock.tsx`

Keep Shemesh's four destinations: בקרה, תיקים, פדיונות, רווח. Use design's `mobile-dock shemesh-os` and `activePath`. The sheet sidebar uses `!m-0 !rounded-none` so the full menu fills the drawer, with `border-sidebar-border` and `bg-sidebar`.

### `components/shemesh/filters.tsx`, `revenue-screen.tsx`, `portfolio-report-screen.tsx`

These were extra conflicts. Keep `HebrewDateRange` and `HebrewDateInput`. They already render the design `DateRangeField` / `DateField` and still post an ISO value. On the revenue screen, keep `resetPageAnd(setTo)` so the page index resets with the range.

## After the next Shemesh update

1. Reset or recreate `cursor/integration-rehearsal` from current `origin/main`.
2. Merge `origin/cursor/design-upgrade`, then the new `origin/cursor/shemesh-phase1`.
3. Re-apply the decisions above. If Shemesh adds a real behavior next to a class-name conflict, keep the behavior and only swap the class onto a token (`border-border`, `bg-card`, `side-glass`, `nav-live`, `kpi-cube`).
