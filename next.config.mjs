const hebcalPackages = ["@hebcal/core", "@hebcal/hdate", "@hebcal/noaa"];
const serverOnlyPackages = [...hebcalPackages, "xlsx"];

const tracedNativePackages = [
  "./node_modules/@hebcal/**/*",
  "./node_modules/quick-lru/**/*",
  "./node_modules/temporal-polyfill/**/*",
  "./node_modules/xlsx/**/*",
  "./node_modules/pngjs/**/*",
  "./node_modules/sharp/**/*",
  "./node_modules/@img/**/*",
  "./node_modules/detect-libc/**/*",
  "./node_modules/semver/**/*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Next 15 name — kept so an upgrade does not silently re-bundle hebcal.
  serverExternalPackages: serverOnlyPackages,
  experimental: {
    // Next 14.2.35 (this project) — serverExternalPackages is ignored here.
    serverComponentsExternalPackages: serverOnlyPackages,
    outputFileTracingIncludes: {
      // Inline on purpose: same paths as tracedNativePackages, so this block
      // stays a plain array and can merge with the Shemesh trace list.
      "/*": [
        "./node_modules/@hebcal/**/*",
        "./node_modules/quick-lru/**/*",
        "./node_modules/temporal-polyfill/**/*",
        "./node_modules/xlsx/**/*",
        "./node_modules/pngjs/**/*",
        "./node_modules/sharp/**/*",
        "./node_modules/@img/**/*",
        "./node_modules/detect-libc/**/*",
        "./node_modules/semver/**/*",
      ],
    },
    // These routes never import xlsx or hebcal. The blanket include above
    // otherwise ships ~13MB into their standalone trace and slows cold start.
    outputFileTracingExcludes: {
      "/login": tracedNativePackages,
      "/forgot-password": tracedNativePackages,
      "/set-password": tracedNativePackages,
      "/sales-tv": tracedNativePackages,
      "/api/auth/login": tracedNativePackages,
      "/api/health": tracedNativePackages,
    },
    serverActions: {
      // Call-control uploads can be long recordings (and FormData overhead).
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
