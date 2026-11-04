import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import html from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import vitest from '@vitest/eslint-plugin';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import deMorgan from 'eslint-plugin-de-morgan';
import { importX } from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import nounsanitized from 'eslint-plugin-no-unsanitized';
import perfectionist from 'eslint-plugin-perfectionist';
import playwright from 'eslint-plugin-playwright';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const SCRIPTS = ['**/*.{js,ts}'];
const TS = ['**/*.ts'];
const APP = ['src/**/*.ts'];
const APP_EXCLUDES = ['src/__tests__/**', 'src/**/*.test.ts'];

// wemake-python-styleguide VARIABLE_NAMES_BLACKLIST (constants.py), complete
const VARIABLE_NAMES_BLACKLIST = [
  // Meaningless words
  'arr', 'content', 'contents', 'data', 'do', 'file', 'handle', 'handler', 'info',
  'item', 'items', 'obj', 'objects', 'objs', 'param', 'parameters', 'params',
  'result', 'results', 'some', 'val', 'vals', 'value', 'values', 'var', 'variable', 'vars',
  // Confusables
  'false', 'no', 'true', 'yes',
  // Names from examples
  'bar', 'baz', 'foo', 'ham', 'spam', 'temp', 'tmp',
];

const scoped = (files, configs) => configs.map((config) => ({ ...config, files }));

// No `warn` level: presets that ship warnings are promoted to `error`.
const noWarn = (config) => {
  if (!config.rules) {
    return config;
  }
  const rules = Object.fromEntries(
    Object.entries(config.rules).map(([name, entry]) => {
      const [level, ...options] = Array.isArray(entry) ? entry : [entry];
      const promoted = level === 'warn' || level === 1 ? 'error' : level;
      return [name, Array.isArray(entry) ? [promoted, ...options] : promoted];
    }),
  );
  return { ...config, rules };
};

export default [
  { ignores: ['node_modules', 'coverage', 'dist', 'playwright-report', 'test-results'] },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },

  // ── JS / TS ───────────────────────────────────────────────────────────────
  // Script-only presets: unicorn 79 also reports on HTML attributes via the html-eslint AST
  ...scoped(SCRIPTS, [
    js.configs.recommended,
    unicorn.configs.recommended,
    sonarjs.configs.recommended,
    comments.recommended,
    importX.flatConfigs.recommended,
    promise.configs['flat/recommended'],
    regexp.configs['flat/recommended'],
    security.configs.recommended,
    nounsanitized.configs.recommended,
    deMorgan.configs.recommended,
  ]),
  ...scoped(TS, [
    importX.flatConfigs.typescript,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    jsdoc.configs['flat/recommended-typescript-error'],
  ]),
  {
    files: TS,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: SCRIPTS,
    plugins: { perfectionist },
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022, ...globals.node },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      'no-unused-vars':             ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console':                 'error',
      'no-empty':                   ['error', { allowEmptyCatch: true }],
      'eqeqeq':                     ['error', 'always', { null: 'ignore' }],
      'no-shadow':                  'error',
      'no-var':                     'error',
      'prefer-const':               'error',
      'prefer-template':            'error',
      'object-shorthand':           'error',
      'no-param-reassign':          ['error', { props: true }],
      'no-implicit-coercion':       'error',
      'no-throw-literal':           'error',
      'no-use-before-define':       ['error', { functions: false }],
      'no-promise-executor-return': 'error',
      'no-constructor-return':      'error',
      'consistent-return':          'error',
      'default-case':               'error',
      'guard-for-in':               'error',
      'curly':                      ['error', 'all'],
      'id-length':                  ['error', { min: 2, max: 45, exceptions: ['_'] }],
      'id-denylist':                ['error', ...VARIABLE_NAMES_BLACKLIST],
      'no-restricted-syntax': ['error',
        { selector: 'ImportDeclaration[specifiers.length>8]', message: 'Не больше 8 имён в одном импорте (wemake MAX_IMPORT_FROM_MEMBERS).' },
        { selector: 'ArrayPattern[elements.length>4]', message: 'Не больше 4 элементов в деструктуризации массива (wemake MAX_TUPLE_UNPACK_LENGTH).' },
        { selector: 'ClassBody[body.length>7]', message: 'Не больше 7 членов класса (wemake MAX_METHODS).' },
      ],

      // Inline directives: only the next-line form, always with a reason
      '@eslint-community/eslint-comments/no-use': ['error', { allow: ['eslint-disable-next-line'] }],
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',

      'import-x/no-cycle':           'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/no-unresolved':      ['error', { ignore: ['^virtual:'] }], // Vite virtual modules

      // Import order is owned by perfectionist
      'perfectionist/sort-imports':       'error',
      'perfectionist/sort-named-imports': 'error',

      'security/detect-object-injection': 'off', // flags every obj[key]; noise without type info

      // Project conventions override unicorn defaults
      'unicorn/name-replacements':          'off', // err, nav, el, btn are established
      'unicorn/no-null':                    'off', // null used intentionally
      'unicorn/no-negated-condition':       'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/filename-case':              'off', // camelCase files are established
      'unicorn/no-unused-builtin-method-return': 'off', // false positives on our own .join() (TrysteroAdapter/FakeRoom), unrelated to Array#join
    },
  },

  // ── TS ────────────────────────────────────────────────────────────────────
  {
    files: TS,
    rules: {
      'no-undef':                           'off', // tsc checks undefined names, incl. DOM/lib types ESLint does not know
      'no-unused-vars':                     'off', // reports parameter names in function types
      '@typescript-eslint/no-unused-vars':  ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Fixers off: they insert empty stub comments that only silence the rule
      'jsdoc/require-param': ['error', { enableFixer: false }],
      'jsdoc/require-jsdoc': ['error', {
        enableFixer: false,
        publicOnly: true,
        require: {
          ArrowFunctionExpression: true,
          ClassDeclaration: true,
          FunctionDeclaration: true,
          FunctionExpression: true,
          MethodDefinition: true,
        },
      }],
      'jsdoc/no-types': 'error',
      'jsdoc/check-alignment': 'off', // conflicts with unicorn/no-asterisk-prefix-in-documentation-comments (asterisk-free doc blocks)
    },
  },

  // ── Application code: thresholds (wemake numbers where they exist) ───────
  {
    files: APP,
    ignores: APP_EXCLUDES,
    rules: {
      'complexity':                     ['error', 6],
      'max-depth':                      ['error', 3],
      'max-params':                     ['error', 5],
      'max-statements':                 ['error', 9],
      'max-lines-per-function':         ['error', { max: 30, skipBlankLines: true, skipComments: true }],
      'max-lines':                      ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks':           ['error', 3],
      'max-classes-per-file':           ['error', 1],
      'no-magic-numbers':               'off',
      '@typescript-eslint/no-magic-numbers': ['error', { ignore: [-1, 0, 1, 2], ignoreDefaultValues: true, ignoreArrayIndexes: true, enforceConst: true }],
      'sonarjs/cognitive-complexity':   ['error', 12],
      'sonarjs/expression-complexity':  ['error', { max: 3 }],
      'sonarjs/no-duplicate-string':    ['error', { threshold: 3 }],
      'sonarjs/nested-control-flow':    ['error', { maximumNestingLevel: 3 }],
      'import-x/max-dependencies':      ['error', { max: 12 }],
    },
  },

  // ── Test files ─────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{test,spec}.ts'],
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
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
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
      'html/no-inline-styles':      'error',
      'html/use-baseline':          'off', // playsinline is required for WebRTC on iOS
      'html/indent':                ['error', 2],
    },
  },
].map(noWarn);
