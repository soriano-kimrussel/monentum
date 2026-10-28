// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'firebase/**/lib/*', 'coverage/*'],
  },
  {
    // Resolve the `@/` alias from tsconfig paths in every file type.
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' }, node: true },
    },
  },
]);
