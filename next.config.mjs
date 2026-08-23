const hebcalPackages = ["@hebcal/core", "@hebcal/hdate", "@hebcal/noaa"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Next 15 name — kept so an upgrade does not silently re-bundle hebcal.
  serverExternalPackages: hebcalPackages,
  experimental: {
    // Next 14.2.35 (this project) — serverExternalPackages is ignored here.
    serverComponentsExternalPackages: hebcalPackages,
    outputFileTracingIncludes: {
      "/*": [
        "./node_modules/@hebcal/**/*",
        "./node_modules/quick-lru/**/*",
        "./node_modules/temporal-polyfill/**/*",
      ],
    },
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
