const hebcalPackages = ["@hebcal/core", "@hebcal/hdate", "@hebcal/noaa"];
const serverOnlyPackages = [...hebcalPackages, "xlsx"];

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
      "/*": [
        "./node_modules/@hebcal/**/*",
        "./node_modules/quick-lru/**/*",
        "./node_modules/temporal-polyfill/**/*",
        "./node_modules/xlsx/**/*",
        "./node_modules/pngjs/**/*",
      ],
    },
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
