import { blockedPull, type ShemeshConnector } from "@/lib/shemesh/connectors/types";

const readyMessage =
  "נמצאו פרטי גישה ל-Grow. משיכת סליקה ותשלומים לא הופעלה עד לאימות ה-API.";

export const growConnector: ShemeshConnector = {
  id: "grow",
  label: "Grow",
  pulls: "סליקה ותשלומים",
  envKeys: ["SHEMESH_GROW_API_URL", "SHEMESH_GROW_API_KEY"],
  blockedMessage: "אין כתובת API ואין מפתח גישה של שמש ל-Grow.",
  pull: (env) => Promise.resolve(blockedPull(growConnector, env, readyMessage)),
};
