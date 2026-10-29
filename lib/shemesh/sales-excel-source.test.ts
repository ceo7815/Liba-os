import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseShemeshExcelRead,
  SHEMESH_WORKBOOK_STALE_MS,
  shemeshWorkbookStaleWarning,
} from "./sales-excel-source";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");

test("Shemesh sync prefers the local file, then its own Graph item, and does not pretend a stored copy was refreshed", () => {
  assert.deepEqual(
    chooseShemeshExcelRead({
      localFileExists: true,
      driveId: "drive",
      itemId: "item",
      hasStoredWorkbook: true,
    }),
    { kind: "local" },
  );
  assert.deepEqual(
    chooseShemeshExcelRead({
      localFileExists: false,
      driveId: " drive ",
      itemId: " item ",
      hasStoredWorkbook: true,
    }),
    { kind: "graph", driveId: "drive", itemId: "item" },
  );
  assert.deepEqual(
    chooseShemeshExcelRead({
      localFileExists: false,
      driveId: "drive",
      itemId: "",
      hasStoredWorkbook: true,
    }),
    { kind: "stored" },
  );
  assert.deepEqual(
    chooseShemeshExcelRead({
      localFileExists: false,
      hasStoredWorkbook: false,
    }),
    { kind: "missing" },
  );
});

test("a Shemesh workbook older than two days is marked stale without changing numbers", () => {
  assert.equal(
    shemeshWorkbookStaleWarning(new Date(NOW - SHEMESH_WORKBOOK_STALE_MS).toISOString(), NOW),
    null,
  );
  assert.match(
    shemeshWorkbookStaleWarning(new Date(NOW - SHEMESH_WORKBOOK_STALE_MS - 1).toISOString(), NOW) ?? "",
    /יותר מיומיים/,
  );
  assert.match(shemeshWorkbookStaleWarning(null, NOW) ?? "", /עדיין לא סונכרן/);
});
