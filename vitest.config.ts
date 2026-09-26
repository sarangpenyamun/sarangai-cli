import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment — sesuai untuk CLI (bukan DOM/browser)
    environment: 'node',

    // Pola file test
    include: ['tests/**/*.test.ts'],

    // Reset mock state antar test file agar isolasi bersih
    restoreMocks: true,

    // Gagal cepat jika ada test yang tersisa (unhandled errors)
    passWithNoTests: false,

    // Timeout untuk test yang melakukan I/O nyata di temp dir
    testTimeout: 10_000,
  },
});