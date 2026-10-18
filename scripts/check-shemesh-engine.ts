import assert from "node:assert/strict";
import { buildShemeshView } from "../lib/shemesh/engine";
import { recognizeShemeshIncome } from "../lib/shemesh/formulas";
import type { ShemeshFilter, ShemeshSnapshot } from "../lib/shemesh/model";

const filter: ShemeshFilter = {
  from: "2026-10-01",
  to: "2026-10-31",
  adPlatform: "all",
  campaignId: "all",
  incomeKind: "all",
};

const snapshot: ShemeshSnapshot = {
  leads: [
    {
      sourceId: "insurance",
      externalId: "lead-1",
      adPlatform: "facebook",
      campaignId: "c1",
      campaignName: "קמפיין א",
      status: "new",
      arrivedOn: "2026-10-02",
      convertedOn: null,
    },
    {
      sourceId: "insurance",
      externalId: "lead-1",
      adPlatform: "facebook",
      campaignId: "c1",
      campaignName: "קמפיין א",
      status: "lost",
      arrivedOn: "2026-10-02",
      convertedOn: null,
    },
    {
      sourceId: "shared_folder",
      externalId: "lead-1",
      adPlatform: "google",
      campaignId: "c2",
      campaignName: "קמפיין ב",
      status: "converted",
      arrivedOn: "2026-10-03",
      convertedOn: "2026-10-04",
    },
  ],
  spend: [
    {
      sourceId: "facebook_ads",
      externalId: "spend-1",
      adPlatform: "facebook",
      campaignId: "c1",
      campaignName: "קמפיין א",
      day: "2026-10-02",
      spend: 200,
    },
    {
      sourceId: "facebook_ads",
      externalId: "spend-1",
      adPlatform: "facebook",
      campaignId: "c1",
      campaignName: "קמפיין א",
      day: "2026-10-02",
      spend: 999,
    },
  ],
  revenue: [
    {
      sourceId: "insurance",
      externalId: "rev-1",
      kind: "fee",
      amount: 1000,
      day: "2026-10-05",
      adPlatform: "facebook",
      campaignId: "c1",
    },
    {
      sourceId: "grow",
      externalId: "rev-2",
      kind: "insurance_sale",
      amount: 500,
      day: "2026-10-06",
      adPlatform: "google",
      campaignId: "c2",
    },
  ],
  expenses: [
    {
      sourceId: "rivhit",
      externalId: "exp-1",
      kind: "salary",
      amount: 300,
      day: "2026-10-07",
      employeeName: null,
      invoiceRef: null,
    },
  ],
};

const view = buildShemeshView(snapshot, filter);
assert.equal(view.droppedDuplicates, 2);
assert.equal(view.marketing.leads, 2);
assert.equal(view.marketing.spend, 200);
assert.equal(view.marketing.cpl, 100);
assert.equal(view.leads.converted, 1);
assert.equal(view.leads.conversionRate, 0.5);
assert.equal(view.revenue.recorded, 1500);
assert.equal(view.revenue.recognition.ok, false);
assert.equal(view.reports.mode, "company");
assert.equal(view.reports.result, 1000);

const media = buildShemeshView(snapshot, { ...filter, adPlatform: "facebook" });
assert.equal(media.reports.mode, "media");
assert.equal(media.reports.expenses, null);
assert.equal(media.reports.result, 800);
assert.equal(media.marketing.leads, 1);

const empty = buildShemeshView(
  { leads: [], spend: [], revenue: [], expenses: [] },
  filter,
);
assert.equal(empty.marketing.spend, null);
assert.equal(empty.marketing.cpl, null);
assert.equal(empty.reports.result, null);

const noLeads = buildShemeshView(
  { ...snapshot, leads: [] },
  filter,
);
assert.equal(noLeads.marketing.cpl, null);

assert.equal(recognizeShemeshIncome().ok, false);

console.log("shemesh engine ok");
