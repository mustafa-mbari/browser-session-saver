import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  { ignores: ['dist', 'node_modules', 'web', 'admin'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Calling a loader that sets loading state from an effect is common here and
      // works; warn until those components are refactored.
      'react-hooks/set-state-in-effect': 'warn',
      // Only relevant when building with the React Compiler, which this project does not use.
      'react-hooks/incompatible-library': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
