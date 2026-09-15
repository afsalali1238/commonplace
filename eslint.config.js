import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", "public/content/sources", "public/sw.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // App code must not reach into the content source of truth or the test
    // helper that reads it with node:fs — the bundled index + on-demand
    // bodies (src/lib/bodies.ts) are the only sanctioned paths. See
    // docs/CONTENT-LAYER.md.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/lib/testContent.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
            {
              name: "@/lib/testContent",
              message:
                "testContent reads content/ with node:fs and is test-only. Use the bundled index (@/data/nodes) or useNodeBody (@/lib/bodies).",
            },
          ],
          patterns: [
            {
              group: ["**/content/clusters/*", "**/content/*.json", "**/public/content/**"],
              message:
                "Don't import content JSON into app code — it would bundle the bodies back in. Use @/data/nodes (index) or @/lib/bodies (on-demand bodies).",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
