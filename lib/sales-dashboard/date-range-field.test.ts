import assert from "node:assert/strict";
import test from "node:test";
import {
  commitDateRange,
  dateRangeButtonLabel,
  dateRangePresets,
  formatHebrewDay,
} from "../../components/ui/date-range-field";

const TODAY = "2026-11-10";

test("date presets keep the old native input days, and add this year and all time", () => {
  const presets = Object.fromEntries(dateRangePresets(TODAY).map((preset) => [preset.id, preset]));
  assert.deepEqual(
    { from: presets.month.from, to: presets.month.to },
    { from: "2026-11-01", to: "2026-11-10" },
  );
  assert.deepEqual(
    { from: presets.prev.from, to: presets.prev.to },
    { from: "2026-10-01", to: "2026-10-31" },
  );
  assert.deepEqual(
    { from: presets.d30.from, to: presets.d30.to },
    { from: "2026-10-12", to: "2026-11-10" },
  );
  assert.equal(presets.year.label, "השנה");
  assert.deepEqual(
    { from: presets.year.from, to: presets.year.to },
    { from: "2026-01-01", to: "2026-11-10" },
  );
  assert.equal(presets.all.label, "כל הזמן");
  assert.deepEqual({ from: presets.all.from, to: presets.all.to }, { from: "", to: "" });
});

test("the first calendar click does not apply a one-day range", () => {
  assert.equal(commitDateRange(null, "2026-03-02"), null);
  assert.deepEqual(commitDateRange("2026-03-10", "2026-03-02"), {
    from: "2026-03-02",
    to: "2026-03-10",
  });
  assert.deepEqual(commitDateRange("2026-03-10", "2026-03-10"), {
    from: "2026-03-10",
    to: "2026-03-10",
  });
});

test("cleared range reads as all time and ISO days are not shifted", () => {
  assert.equal(dateRangeButtonLabel("", ""), "כל הזמן");
  assert.equal(formatHebrewDay("2026-03-02"), "02.03.2026");
  assert.equal(dateRangeButtonLabel("2026-03-02", "2026-03-10"), "02.03.2026 – 10.03.2026");
});
