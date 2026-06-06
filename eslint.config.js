import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },

  // src/_hidden/** is parked code (e.g. SalesView, slated for Phase 2 rework);
  // it is not part of the active build, so it is excluded from linting until
  // un-hidden, at which point it should be cleaned up as active code.
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'src/_hidden/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        gtag: 'readonly', // Google Analytics, injected by the GA snippet
      },
    },
  },

  // Node-context files: build/test config, setup and CLI scripts.
  {
    files: ['scripts/**', '**/*.config*.js', '**/*.config*.mjs', 'src/test/**'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  skipFormatting,

  {
    rules: {
      // UI primitives (Button, Input, Toast, Sidebar, ...) intentionally use
      // single-word names; this stylistic Vue rule is not a fit for this app.
      'vue/multi-word-component-names': 'off',
      // Allow an underscore prefix to mark an intentionally-unused argument or
      // caught error (e.g. interface stub methods, signature-shaped callbacks).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
])
