import { facebookAdsConnector } from "@/lib/shemesh/connectors/facebook-ads";
import { googleAdsConnector } from "@/lib/shemesh/connectors/google-ads";
import { growConnector } from "@/lib/shemesh/connectors/grow";
import { insuranceConnector } from "@/lib/shemesh/connectors/insurance";
import { rivhitConnector } from "@/lib/shemesh/connectors/rivhit";
import { sharedFolderConnector } from "@/lib/shemesh/connectors/shared-folder";
import {
  credentialsPresent,
  type ShemeshConnector,
  type ShemeshSourceStatus,
} from "@/lib/shemesh/connectors/types";

export const SHEMESH_CONNECTORS: readonly ShemeshConnector[] = [
  insuranceConnector,
  facebookAdsConnector,
  googleAdsConnector,
  rivhitConnector,
  growConnector,
  sharedFolderConnector,
];

export function assessShemeshSources(env: NodeJS.ProcessEnv): ShemeshSourceStatus[] {
  return SHEMESH_CONNECTORS.map((connector) => {
    const ready = connector.isReady
      ? connector.isReady(env)
      : credentialsPresent(env, connector.envKeys);
    return {
      id: connector.id,
      label: connector.label,
      pulls: connector.pulls,
      connection: ready ? "credentials_present" : "awaiting_access",
      lastSyncedAt: null,
      message: ready
        ? connector.readyMessage ??
          "פרטי הגישה קיימים. הסנכרון עדיין לא רץ, כי צריך לאמת קודם את ה-API וההרשאות."
        : connector.blockedMessage,
    };
  });
}
