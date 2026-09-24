// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
