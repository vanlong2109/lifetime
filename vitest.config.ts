import { fileURLToPath } from "node:url";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// vitest-pool-workers v0.18 (vitest 4): the pool is wired via the cloudflareTest
// Vite plugin. Per-test storage isolation is built in. Migrations are read at
// config time and applied per-file via ./test/apply-migrations.ts.
const migrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(migrationsDir);
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            AUTH_TOKEN: "test-secret-token",
            APP_USER_ID: "user-1",
            APP_TIMEZONE: "Asia/Bangkok",
            DOD_GATE_ENABLED: "true",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
