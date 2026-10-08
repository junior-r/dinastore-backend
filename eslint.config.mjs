// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Jest's mock functions (e.g. `expect(repo.method).toHaveBeenCalledWith(...)`)
    // trip this rule even though they aren't `this`-bound class methods.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      // Jest's asymmetric matchers (`expect.objectContaining(...)`,
      // `expect.any(...)`) are typed `any`, so nesting one inside an expected
      // object is flagged as an unsafe assignment. It is the documented way
      // to write a partial match, not a hole in the types.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // A test double often has to be `async` only to match the signature it
      // stands in for (`json: async () => ({})` for a fetch Response).
      '@typescript-eslint/require-await': 'off',
    },
  },
);
