import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // The extension is a set of plain browser scripts loaded via <script>
    // tags (no bundler, no ES modules), so a top-level `const` in one file
    // that's only referenced from another (e.g. auth.js's `JoblyAuth`
    // global, used by popup.js/options.js) looks "unused" to a
    // module-aware linter even though it's intentionally global.
    files: ["extension/**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
