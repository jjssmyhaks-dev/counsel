import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-secret-for-vitest',
      NODE_ENV: 'test',
    },
  },
});
