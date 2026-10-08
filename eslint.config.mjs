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

  // La simulación de La Torre es TypeScript puro (ver docs/ARCHITECTURE.md).
  {
    files: ["src/tower/sim/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "next", "next/*", "three", "three/*", "@react-three/*", "zustand", "zustand/*", "@supabase/*", "@/*", "../*"],
              message: "tower/sim/ es TypeScript puro y determinista: no conoce React, three, el store ni la base.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
