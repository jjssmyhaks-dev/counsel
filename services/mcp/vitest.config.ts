import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    timeout: 60_000,
    retry: 2,
    reporters: ["verbose"],
  },
});
