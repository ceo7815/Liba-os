import assert from "node:assert/strict";
import test from "node:test";
import {
  excelHttpSyncFailure,
  salesExcelSyncProblem,
  shemeshExcelSyncFailure,
} from "./excel-sync-guard";

test("a failed or empty Excel sync does not replace the live dashboard", () => {
  assert.equal(salesExcelSyncProblem(null), "סנכרון האקסל לא החזיר נתונים");
  assert.equal(
    salesExcelSyncProblem({ source: "empty", error: "אין נתוני מכירות שמורים" }),
    "אין נתוני מכירות שמורים",
  );
  assert.equal(
    salesExcelSyncProblem({ source: "empty" }),
    "דוח המנהלים לא עודכן. הנתונים שכבר על המסך נשארים.",
  );
  assert.equal(salesExcelSyncProblem({ source: "live" }), null);
  assert.match(
    salesExcelSyncProblem({ source: "live", error: "token=secret https://x.test/a?b=1" }) ?? "",
    /https:\/\/x\.test\/a$/,
  );
});

test("Shemesh Excel HTTP failure is only that source", () => {
  assert.equal(shemeshExcelSyncFailure(200, { error: "ignored" }), null);
  assert.equal(shemeshExcelSyncFailure(401, { error: "nope" }), "אין הרשאה לסנכרון אקסל");
  assert.equal(shemeshExcelSyncFailure(500, { error: "הקובץ חסר" }), "הקובץ חסר");
  assert.equal(shemeshExcelSyncFailure(500, null), "סנכרון אקסל נכשל");
  assert.equal(excelHttpSyncFailure(401), "אין הרשאה לסנכרון אקסל");
  assert.equal(excelHttpSyncFailure(200), null);
});
