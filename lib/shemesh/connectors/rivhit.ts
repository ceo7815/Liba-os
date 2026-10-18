import { blockedPull, type ShemeshConnector } from "@/lib/shemesh/connectors/types";

const readyMessage =
  "נמצאו פרטי גישה לריווחית. משיכת חשבוניות והוצאות לא הופעלה עד לאימות ה-API.";

export const rivhitConnector: ShemeshConnector = {
  id: "rivhit",
  label: "ריווחית",
  pulls: "חשבוניות והוצאות",
  envKeys: ["SHEMESH_RIVHIT_API_URL", "SHEMESH_RIVHIT_API_KEY"],
  blockedMessage: "אין כתובת API ואין מפתח גישה של שמש לריווחית.",
  pull: (env) => Promise.resolve(blockedPull(rivhitConnector, env, readyMessage)),
};
