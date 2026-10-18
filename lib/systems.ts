export const OS_SYSTEM_COOKIE = "os_system";

export const OS_SYSTEMS = ["liba", "shemesh"] as const;

export type OsSystem = (typeof OS_SYSTEMS)[number];

export function isOsSystem(value: string | undefined | null): value is OsSystem {
  return value === "liba" || value === "shemesh";
}

export function osSystemHome(system: OsSystem | null | undefined) {
  return system === "shemesh" ? "/shemesh" : "/dashboard";
}
