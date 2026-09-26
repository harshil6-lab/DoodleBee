// https://docs.expo.dev/guides/using-eslint/
// SDK 53+ uses ESLint flat config.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores([
    'dist/*',
    'node_modules/*',
    '.expo/*',
    'coverage/*',
    'android/*',
    'ios/*',
  ]),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // Root-level configuration files run in Node with CommonJS.
    files: [
      'eslint.config.js',
      '.prettierrc.js',
      'metro.config.js',
      'babel.config.js',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    rules: {
      // Strict TypeScript rules (docs/AGENTS.md section 11)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],

      // React
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // No console.log in production code
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
