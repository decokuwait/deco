import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // next/font/google only runs inside a Next.js build; tests get a stub with the same return shape.
  resolve: { alias: { "@": path.resolve(root, "src"), "next/font/google": path.resolve(root, "tests/stubs/next-font-google.ts") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  oxc: { jsx: { runtime: "automatic" } },
});
