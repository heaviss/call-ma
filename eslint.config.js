import js from '@eslint/js';
import html from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import playwright from 'eslint-plugin-playwright';
import unicorn from 'eslint-plugin-unicorn';
import vitest from '@vitest/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import nounsanitized from 'eslint-plugin-no-unsanitized';
import deMorgan from 'eslint-plugin-de-morgan';
import globals from 'globals';

export default [
  { ignores: ['node_modules', 'coverage', 'dist'] },

  // ── JS ────────────────────────────────────────────────────────────────────
  js.configs.recommended,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  comments.recommended,
  importX.flatConfigs.recommended,
  promise.configs['flat/recommended'],
  regexp.configs.recommended,
  security.configs.recommended,
  nounsanitized.configs.recommended,
  deMorgan.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error' },
    settings: { 'import-x/resolver-next': [createNodeResolver()] },
  },
  // PROTOTYPE: стартовый набор §3.2 ресерча
  {
    files: ['src/**/*.js'],
    ignores: ['src/**/*.{test,spec}.js', 'src/__tests__/**'],
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 5],
      'max-statements': ['error', 12],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['error', 3],
      'max-classes-per-file': ['error', 1],
      'no-magic-numbers': ['error', { ignore: [-1, 0, 1, 2], ignoreDefaultValues: true, ignoreArrayIndexes: true, enforceConst: true }],
      'sonarjs/cognitive-complexity': ['error', 12],
      'sonarjs/expression-complexity': ['error', { max: 3 }],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/nested-control-flow': ['error', { maximumNestingLevel: 3 }],
      'import-x/max-dependencies': ['error', { max: 12 }],
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      'id-length': ['error', { min: 2, max: 45, exceptions: ['_'] }],
      'id-denylist': ['error', 'data', 'result', 'item', 'obj', 'value', 'tmp'],
      curly: ['error', 'all'],
      'no-param-reassign': ['error', { props: true }],
      'require-await': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-mutable-exports': 'error',
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },
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
      'unicorn/no-unused-array-method-return': 'off', // false positives on our own .join() (TrysteroAdapter/FakeRoom), unrelated to Array#join
    },
  },

  // ── Test files ─────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{test,spec}.js'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/max-expects': ['error', { max: 5 }],
      'vitest/max-nested-describe': ['error', { max: 2 }],
      'vitest/no-conditional-in-test': 'error',
      'vitest/no-conditional-expect': 'error',
      'vitest/prefer-strict-equal': 'error',
      'vitest/require-to-throw-message': 'error',
      'vitest/consistent-test-it': 'error',
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
