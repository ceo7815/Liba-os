import { blockedPull, type ShemeshConnector } from "@/lib/shemesh/connectors/types";

const readyMessage =
  "נמצא חשבון Google Ads של שמש. הסנכרון לא הופעל עד לאימות הרשאת הקריאה.";

export const googleAdsConnector: ShemeshConnector = {
  id: "google_ads",
  label: "גוגל",
  pulls: "קמפיינים של פיננסים, עלות ולידים",
  envKeys: ["SHEMESH_GOOGLE_ADS_CUSTOMER_ID", "SHEMESH_GOOGLE_ADS_REFRESH_TOKEN"],
  blockedMessage:
    "אין חשבון Google Ads של שמש. החיבור הקיים של ליבה לגוגל לא משמש את המערכת הזו.",
  pull: (env) => Promise.resolve(blockedPull(googleAdsConnector, env, readyMessage)),
};
