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

  // Fronteras React ⇄ KAPLAY (ver docs/ARCHITECTURE.md)
  {
    files: ["src/game/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "next",
                "next/*",
                "zustand",
                "zustand/*",
                "@supabase/*",
                "@/*",
                "!@/game",
                "!@/game/**",
              ],
              message:
                "game/ es TypeScript puro: se comunica con la UI solo a través de game/contract.ts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/game/**", "src/bridge/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["kaplay", "kaplay/*", "@/game", "@/game/**"],
              message: "Solo bridge/ habla con el motor: importá desde @/bridge/*.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
