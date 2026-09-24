// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The SDK is consumed from TypeScript source inside the monorepo, so Next must transpile it.
  transpilePackages: ["@opentape/sdk"],
};

export default nextConfig;
