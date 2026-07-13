import { defineConfig } from "drizzle-kit";

// D1 = SQLite dialect. `generate` only needs schema + out; no driver required.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
