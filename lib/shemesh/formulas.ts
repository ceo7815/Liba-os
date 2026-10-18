export type ShemeshFormulaStatus = "pending_verification" | "active";

export type ShemeshFormula = {
  id: "multiplier_8" | "settled_100";
  title: string;
  status: ShemeshFormulaStatus;
  note: string;
};

/** Income formulas stay inactive until the client confirms them. */
export const SHEMESH_FORMULAS: readonly ShemeshFormula[] = [
  {
    id: "multiplier_8",
    title: "מודל מכפלה 8",
    status: "pending_verification",
    note: "דורש אימות מול הלקוח לפני מימוש.",
  },
  {
    id: "settled_100",
    title: "סטטוס 100% נפרע",
    status: "pending_verification",
    note: "דורש אימות מול הלקוח לפני מימוש.",
  },
];

export type RecognitionResult =
  | { ok: true; amount: number }
  | {
      ok: false;
      code: "pending_verification";
      formulas: readonly ShemeshFormula[];
    };

export function recognizeShemeshIncome(): RecognitionResult {
  // A status of "active" is not enough. The arithmetic stays unimplemented
  // until multiplier 8 and the 100% settled rule are confirmed.
  return { ok: false, code: "pending_verification", formulas: SHEMESH_FORMULAS };
}
