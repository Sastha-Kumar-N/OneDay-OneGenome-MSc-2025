import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Start with Next.js presets (core-web-vitals + typescript)
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Add your own flat-config layer(s)
  {
    // Turn off the rule that’s breaking your build
    rules: {
      "@typescript-eslint/no-explicit-any": "off",     // or "warn"
      // Optional: quiet unused vars during refactors
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // (Optional) Ignore whole paths/patterns in the flat config
  {
    ignores: [
      "node_modules",
      ".next",
      "dist",
      // Add any noisy folders/files here:
      // "src/lib/legacy/**",
      // "scripts/**",
    ],
  },
];

export default eslintConfig;
