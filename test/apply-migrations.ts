import { applyD1Migrations, env } from "cloudflare:test";

// Applies all D1 migrations to the test database before each test file.
// With isolatedStorage, writes roll back between tests but the schema persists.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
