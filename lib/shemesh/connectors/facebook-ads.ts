import { blockedPull, type ShemeshConnector } from "@/lib/shemesh/connectors/types";

const readyMessage =
  "נמצא חשבון המודעות של שמש. הסנכרון לא הופעל עד לאימות הרשאת הקריאה בפייסבוק.";

export const facebookAdsConnector: ShemeshConnector = {
  id: "facebook_ads",
  label: "פייסבוק",
  pulls: "קמפיינים, עלות ולידים מחשבון המודעות של שמש",
  envKeys: ["SHEMESH_FACEBOOK_AD_ACCOUNT_ID", "SHEMESH_FACEBOOK_ACCESS_TOKEN"],
  blockedMessage:
    "אין חשבון מודעות של שמש. החיבור הקיים של ליבה לפייסבוק לא משמש את המערכת הזו.",
  pull: (env) => Promise.resolve(blockedPull(facebookAdsConnector, env, readyMessage)),
};
