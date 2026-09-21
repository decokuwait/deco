import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * The repository carried `// eslint-disable-next-line` comments but no linter, so nothing enforced the
 * rules those comments were suppressing. `core-web-vitals` promotes the rules that affect real page
 * performance to errors, which is the point on a platform whose product is 60 marketing sites.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".data/**", ".qa/**", "public/**"]),
  {
    rules: {
      // Uploaded media lives on Cloudflare R2 and is already resized on the device before upload, so the
      // templates deliberately use plain <img>. Each site is also served on its own custom domain, which
      // next/image would have to be configured for per tenant.
      "@next/next/no-img-element": "off",
      // Unused values are a real signal here, but the leading-underscore escape hatch stays.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["src/templates/**/*.tsx"],
    rules: {
      // Template links to "/" are same-page fragment anchors (`/#top`, `/#services`). A router
      // navigation would reload the route instead of scrolling, and the same components render under
      // two different root layouts — the tenant tree and the platform's template preview — where "/"
      // is a different page. A plain anchor is the correct element here.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    // QA scripts are operator tools, not shipped code.
    files: ["scripts/**/*.ts", "tests/**/*.ts", "tests/**/*.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);
