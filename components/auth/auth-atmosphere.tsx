"use client";

/** Quiet brand wash behind the sign-in card. No colliding shapes. */
export function AuthAtmosphere({ tone = "liba" }: { tone?: "liba" | "shemesh" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={tone === "shemesh" ? "auth-mesh auth-mesh-shemesh" : "auth-mesh"} />
      <div className="auth-grain" />
    </div>
  );
}
