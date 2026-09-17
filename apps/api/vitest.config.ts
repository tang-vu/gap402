import { defineConfig } from "vitest/config";

// The API suite builds a Fastify server + in-memory SQLite in beforeAll.
// Under parallel workspace test runs on slow mounts, module transform and
// native binding load can exceed the default timeouts — allow headroom.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
