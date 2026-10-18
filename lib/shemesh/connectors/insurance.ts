import { blockedPull, type ShemeshConnector } from "@/lib/shemesh/connectors/types";

const readyMessage =
  "נמצאו פרטי גישה ל-Insurance. המשיכה לא הופעלה עד שיוודאו שה-API וההרשאות אכן מאפשרים קריאת לידים ועסקאות.";

export const insuranceConnector: ShemeshConnector = {
  id: "insurance",
  label: "ביטוח",
  pulls: "לידים ונתוני עסקאות",
  envKeys: ["SHEMESH_INSURANCE_API_URL", "SHEMESH_INSURANCE_API_KEY"],
  blockedMessage: "אין כתובת API ואין מפתח גישה של שמש ל-Insurance.",
  pull: (env) => Promise.resolve(blockedPull(insuranceConnector, env, readyMessage)),
};
