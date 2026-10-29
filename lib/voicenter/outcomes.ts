/** Outcomes written for every CDR POST. Safe to import from client components. */
export const CDR_POST_OUTCOMES = [
  "unauthorized",
  "bad_json",
  "other_extension",
  "stored",
] as const;

export type CdrPostOutcome = (typeof CDR_POST_OUTCOMES)[number];
