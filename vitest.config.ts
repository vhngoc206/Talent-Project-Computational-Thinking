import { defineConfig } from 'vitest/config';

// Cấu hình test tách riêng: các thuật toán/service là TypeScript thuần nên chạy được trong môi trường node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
