import assert from "node:assert/strict";
import test from "node:test";
import { formatCount, formatDecimal, formatMoney } from "./numbers";

test("counts are integers with he-IL grouping", () => {
  assert.equal(formatCount(62.149), "62");
  assert.equal(formatCount(62.5), "63");
  assert.equal(formatCount(62149), "62,149");
  assert.equal(formatCount(0), "0");
  assert.equal(formatCount(null), "—");
});

test("money keeps agorot and hides them on whole shekels", () => {
  assert.match(formatMoney(100), /100/);
  assert.doesNotMatch(formatMoney(100), /100\.00/);
  assert.match(formatMoney(100.5), /100\.50/);
  assert.match(formatMoney(62.149), /62\.15/);
  assert.equal(formatMoney(null), "—");
});

test("decimals keep a fraction and still group", () => {
  assert.equal(formatDecimal(12.5, 1), "12.5");
  assert.equal(formatDecimal(62149.2, 1), "62,149.2");
});
