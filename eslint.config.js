import js from '@eslint/js';
import html from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import playwright from 'eslint-plugin-playwright';
import unicorn from 'eslint-plugin-unicorn';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

export default [
  { ignores: ['node_modules', 'coverage', 'dist'] },

  // ── JS ────────────────────────────────────────────────────────────────────
  // JS-only presets: unicorn 79 also reports on HTML attributes via the html-eslint AST
  { files: ['**/*.js'], ...js.configs.recommended },
  { files: ['**/*.js'], ...unicorn.configs.recommended },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022, ...globals.node },
    },
    rules: {
      'no-unused-vars':             ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':                 'warn',
      'no-empty':                   ['error', { allowEmptyCatch: true }],
      'eqeqeq':                     ['error', 'always', { null: 'ignore' }],
      'no-shadow':                  'error',
      'no-var':                     'error',
      'prefer-const':               'error',
      'prefer-template':            'error',
      'object-shorthand':           'error',
      'no-param-reassign':          'error',
      'no-implicit-coercion':       'error',
      'no-throw-literal':           'error',
      'no-use-before-define':       ['error', { functions: false }],
      'no-promise-executor-return': 'error',
      'no-constructor-return':      'error',
      'consistent-return':          'error',
      'default-case':               'error',
      'guard-for-in':               'error',

      // Project conventions override unicorn defaults
      'unicorn/name-replacements':          'off', // err, nav, el, btn are established
      'unicorn/no-null':                    'off', // null used intentionally
      'unicorn/no-negated-condition':       'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/filename-case':              'off', // camelCase files are established
      'unicorn/no-unused-builtin-method-return': 'off', // false positives on our own .join() (TrysteroAdapter/FakeRoom), unrelated to Array#join
    },
  },

  // ── Test files ─────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{test,spec}.js'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'no-param-reassign':              'off',
      'unicorn/no-useless-undefined':   'off',
      'no-promise-executor-return':     'off', // tick-flush pattern: new Promise(r => setTimeout(r, 0))
    },
    languageOptions: {
      globals: { ...vitest.environments.env.globals },
    },
  },

  // ── E2E files ────────────────────────────────────────────────────────────
  {
    files: ['e2e/**/*.js', 'playwright.config.js'],
    ...playwright.configs['flat/recommended'],
  },

  // ── HTML files ─────────────────────────────────────────────────────────────
  {
    files: ['**/*.html'],
    ignores: ['dist/**'],
    plugins: { html },
    languageOptions: { parser: htmlParser },
    rules: {
      ...html.configs.recommended.rules,
      'html/require-lang':          'error',
      'html/require-meta-charset':  'error',
      'html/require-meta-viewport': 'error',
      'html/no-duplicate-id':       'error',
      'html/require-button-type':   'error',
      'html/no-target-blank':       'error',
      'html/no-inline-styles':      'warn',
      'html/use-baseline':          'off', // playsinline is required for WebRTC on iOS
      'html/indent':                ['error', 2],
    },
  },
];
