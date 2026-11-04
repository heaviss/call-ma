# Строгий линтинг для call-ma: аналог wemake-python-styleguide для JS/CSS

Дата исследования: 2026-11-04. Пометки: **[V]** — проверено по первоисточнику или запуском в этом репозитории; **[I]** — вывод или оценка автора, не проверенная напрямую.

## TL;DR

- Прямого аналога wemake для JS нет [V/I]. Ближе всего собрать его из ядра ESLint (`complexity`, `max-*`, `id-length`, `no-magic-numbers`), `eslint-plugin-sonarjs` (cognitive/expression complexity, дублирование строк), `eslint-plugin-unicorn` (стиль и рискованные конструкции), а типы проверять через `checkJs` + `tsc`. Не закрываются Jones complexity, line complexity, лимит членов модуля и `MAX_LOCAL_VARIABLES`.
- **Текущий стек частично устарел.** ESLint 9 «reached end-of-life on 2026-08-06» [V: eslint.org/version-support]. `eslint-plugin-vitest@0.5.4` последний раз выходил 2024-04-23 и падает на ESLint 10 [V: запуск]. Его преемник — `@vitest/eslint-plugin` (репозиторий vitest-dev) [V: npm + GitHub].
- Свежие версии требуют **Node ≥ 22**: unicorn 79, `@vitest/eslint-plugin`, jsdoc 65, stylelint 18, html-validate 11, dependency-cruiser 18 [V: `engines` в npm]. Переход CI на Node 22+ обязателен, если нужны актуальные правила.
- Замеры на текущем коде: рекомендуемый стартовый набор даёт **309** нарушений (157 в коде приложения, 152 в тестах). Из них 83 приходятся на `unicorn/name-replacements` — это переименованный `prevent-abbreviations`, который в проекте сознательно выключен. Без него остаётся около 226. Максимально строгая сборка («всё включено» + type-checked) даёт **2260** нарушений, `tsc --checkJs --strict` — **553** ошибки [V: запуск].
- Главные очаги сложности: `initApp` (cyclomatic 17, 146 строк, 37 statements), `startDirectMode` (cognitive 18), `deriveMetrics` (cognitive 19, вложенность 4), `checkSupport` (cyclomatic 12) [V].

## 0. Текущее состояние (на коммите 4edd7de) [V]

- `eslint.config.js` (flat config) подключает `js.configs.recommended`, `unicorn.configs.recommended` (5 правил выключено, включая `prevent-abbreviations` и `no-null`), около 20 правил ядра (`eqeqeq`, `no-shadow`, `no-param-reassign`, `consistent-return`…), `eslint-plugin-vitest` recommended для тестов, `eslint-plugin-playwright` flat/recommended для e2e и `@html-eslint` recommended с дополнениями для HTML.
- Правил сложности (`complexity`, `max-*`) нет. Нет sonarjs, проверки eslint-disable-комментариев, правил безопасности, JSDoc и проверки типов.
- `.stylelintrc.json`: `stylelint-config-standard` + `stylelint-config-html` и несколько правил (`selector-max-id: 1`, `selector-max-compound-selectors: 4`).
- Версии: `eslint@^9.39.4`, `eslint-plugin-unicorn@^65`, `stylelint@^17`, `engines.node >=18`. Сейчас `npm run lint` проходит без ошибок.

## 1. Категории wemake → эквиваленты в JS/CSS

Источник по wemake: `wemake_python_styleguide/violations/*.py` и `options/defaults.py` в master; последний релиз 1.8.1 вышел 2026-09-12 [V: PyPI]. Сейчас в каталоге `violations/` есть модули complexity (39 нарушений), naming (19), consistency (68), best_practices (85), refactoring (37), oop (18) и system. Отдельного модуля `tokenize` в 1.x нет [V: листинг каталога].

### 1.1 Complexity (WPS2xx)

| wemake (дефолт) | JS-эквивалент | Статус |
|---|---|---|
| `MAX_COGNITIVE_SCORE=12` | `sonarjs/cognitive-complexity: 12`; Biome `noExcessiveCognitiveComplexity` | ✅ |
| `MAX_COGNITIVE_AVERAGE=8` (на модуль) | — | ❌ нет среднего по модулю |
| McCabe (через flake8, обычно 6–10) | `complexity` (ядро), `sonarjs/cyclomatic-complexity` | ✅ |
| `MAX_ARGUMENTS=5` | `max-params: 5` | ✅ |
| `MAX_LOCAL_VARIABLES=5` | — (`max-statements` закрывает задачу частично) | ⚠️ |
| `MAX_EXPRESSIONS=9` | `max-statements: 9` (считает statements, не expressions) | ⚠️ |
| `MAX_RETURNS=5` | — | ❌ (нужно своё правило или `no-restricted-syntax` не справится) |
| `MAX_AWAITS=5` | — | ❌ |
| `MAX_RAISES=3` | — | ❌ |
| `MAX_MODULE_MEMBERS=7` | — (`max-lines`, `import-x/max-dependencies` — косвенно) | ❌ |
| `MAX_METHODS=7`, `MAX_ATTRIBUTES=6` | — (`max-classes-per-file` о другом) | ❌ |
| `MAX_IMPORTS=12` | `import-x/max-dependencies: 12` | ✅ |
| `MAX_IMPORT_FROM_MEMBERS=8` | — | ❌ |
| TooDeepNesting | `max-depth: 3`, `sonarjs/nested-control-flow: 3`, `max-nested-callbacks: 3` | ✅ |
| `MAX_CONDITIONS=4` / TooLongCompare | `sonarjs/expression-complexity: 3` | ✅ |
| `MAX_LINE_COMPLEXITY=14`, `MAX_JONES_SCORE=12` | — | ❌ нет аналога |
| `MAX_STRING_USAGES=3` (OverusedString) | `sonarjs/no-duplicate-string: {threshold: 3}` | ✅ |
| OverusedExpression (7/4) | `sonarjs/no-identical-functions`, jscpd | ⚠️ |
| `MAX_CALL_LEVEL=3` / `MAX_ACCESS_LEVEL=4` | — | ❌ |
| `MAX_TRY_BODY_LENGTH=1` | `unicorn/try-complexity` (unicorn 79, сработал 6 раз) [V] | ⚠️ (порог другой) |
| TooManyElifs / match cases (7) | `sonarjs/max-switch-cases: 7`, `sonarjs/elseif-without-else` | ⚠️ |
| TooManyAsserts (5) | `vitest/max-expects: 5` | ✅ |
| `MAX_TUPLE_UNPACK_LENGTH=4` | — | ❌ |
| Длина функции и модуля | `max-lines-per-function`, `max-lines`, `sonarjs/max-lines` | ✅ (у wemake этих лимитов нет) |

### 1.2 Naming

| wemake | JS |
|---|---|
| TooShortName (`MIN_NAME_LENGTH=2`), TooLongName (45) | `id-length: {min: 2, max: 45}` ✅ |
| WrongVariableName (blacklist: `data`, `result`, `item`…) | `id-denylist` ✅ (список придётся вести самим) |
| UnreadableName, ConsecutiveUnderscores, TrailingUnderscore | `id-match` с регэкспом ✅, `no-underscore-dangle` ✅ |
| BuiltinShadowing | `no-shadow-restricted-names`, `no-shadow: {builtinGlobals: true}` ✅ |
| Module names | `unicorn/filename-case`, `eslint-plugin-check-file` ✅ |
| UnusedVariableIsUsed (`_x` используется) | `no-unused-vars: {reportUsedIgnorePattern: true}` ✅ |
| Аббревиатуры | `unicorn/name-replacements` (бывший `prevent-abbreviations`) ✅ |
| Булевы имена | `unicorn/consistent-boolean-name` (unicorn 79) ✅ [V] |
| Регистр констант (UpperCaseAttribute) | `camelcase`, `@stylistic`; нет правила «module const → UPPER_CASE» ⚠️ |

### 1.3 Consistency

Большую часть берут на себя Prettier (кавычки, скобки, отступы) и правила ядра или unicorn: `consistent-return`, `no-useless-*`, `yoda`, `no-implicit-coercion`, `prefer-template`, `operator-assignment`, `unicorn/numeric-separators-style`, `unicorn/number-literal-case`, `no-else-return`, `perfectionist/*` (порядок импортов, ключей, членов класса). Порядок методов (WrongMethodOrder) закрывают `perfectionist/sort-classes` или `unicorn/consistent-class-member-order` ✅. Walrus и прочие Python-специфичные пункты переносить не нужно.

### 1.4 Best practices

| wemake | JS |
|---|---|
| OveruseOfNoqa (`MAX_NOQA_COMMENTS=10`), ForbiddenInlineIgnore, WrongMagicComment | `@eslint-community/eslint-comments/*` (`require-description`, `no-unlimited-disable`, `no-unused-disable`, `no-use` с allowlist), `linterOptions.reportUnusedDisableDirectives` ✅. Лимита количества нет ⚠️ |
| MagicNumber | `no-magic-numbers` ✅ |
| NestedFunction / NestedClass | `sonarjs/no-nested-functions`, `no-inner-declarations` ⚠️ |
| MutableModuleConstant | `functional/no-let`, `import-x/no-mutable-exports`, `functional/immutable-data` (требует типов) ⚠️ |
| UnreachableCode, StatementHasNoEffect | `no-unreachable`, `no-unused-expressions` ✅ |
| BooleanPositionalArgument | `sonarjs/no-selector-parameter` (не входит в recommended) ✅ |
| AwaitInLoop | `no-await-in-loop` ✅ |
| ProtectedAttribute | `no-underscore-dangle`, `unicorn/prefer-private-class-fields` ✅ |
| OuterScopeShadowing | `no-shadow` ✅ |
| EmptyModule / EmptyComment | `unicorn/no-empty-file`, `@eslint-community/eslint-comments/no-*` ✅ |
| Bare/loose except, BaseException | `no-empty` в catch, `unicorn/prefer-optional-catch-binding`, `@typescript-eslint/use-unknown-in-catch-callback-variable`, `prefer-promise-reject-errors` ✅ |
| Безопасность (у wemake косвенно, через bandit в составе flakehell-сборок) | `eslint-plugin-security`, `eslint-plugin-no-unsanitized`, `unicorn/no-unsafe-dom-html` ✅ |

### 1.5 Refactoring

Почти всё есть: `no-lonely-if`, `no-else-return`, `no-unneeded-ternary`, `no-nested-ternary` / `sonarjs/no-nested-conditional`, `sonarjs/prefer-single-boolean-return`, `sonarjs/no-collapsible-if`, `sonarjs/no-identical-conditions`, `sonarjs/no-duplicated-branches`, `unicorn/prefer-ternary`, `unicorn/prefer-early-return`, `eslint-plugin-de-morgan` (NegatedConditions, NotOperatorWithCompare), `prefer-object-has-own`, `unicorn/prefer-at` (ImplicitNegativeIndex) ✅.

### 1.6 OOP

`class-methods-use-this` (StaticMethod), `no-useless-constructor`, `@typescript-eslint/no-extraneous-class`, `no-constructor-return`, `unicorn/no-thenable`, `unicorn/custom-error-definition`, `max-classes-per-file`, `perfectionist/sort-classes` ✅. Аналогов MAX_METHODS, MAX_BASE_CLASSES и WrongSlots нет ❌.

### 1.7 Чего нет у wemake, но нужно для JS

- **Типы.** Аналог mypy — `tsc --noEmit` с `checkJs` и `strict` плюс type-checked правила typescript-eslint. JSDoc-типы при этом обязательны.
- **Документация.** wemake её не проверяет: в 1.x нет правил на наличие docstring [I]. Для JS — `eslint-plugin-jsdoc` (`require-jsdoc` с `publicOnly`).
- **Качество тестов.** `@vitest/eslint-plugin` (82 правила [V]), `eslint-plugin-playwright`.
- **CSS/HTML.** У wemake аналогов нет; см. §2.4.

## 2. Кандидаты (данные npm на 2026-11-04 [V], если не указано иное)

### 2.1 ESLint и ядро

| Пакет | Версия, дата | ESLint | Node | Комментарий |
|---|---|---|---|---|
| `eslint` | 10.14.0, 2026-10-30 | — | `^20.19 \|\| ^22.13 \|\| >=24` | Поддерживается только v10; v9 EOL 2026-08-06 [V: eslint.org/version-support] |
| `@eslint/js` | 10.0.1 | ^10 | — | В `configs.all` 200+ правил; много шума (`one-var`, `sort-keys`, `no-ternary`) [V: запуск] |
| `@stylistic/eslint-plugin` | 5.10.0, 2026-08 | ^9 \|\| ^10 | — | Не нужен: форматирование уже делает Prettier [I] |

### 2.2 Плагины ESLint

| Пакет | Версия / дата | Flat / ESLint 10 | Node | Оценка |
|---|---|---|---|---|
| `eslint-plugin-sonarjs` | 4.2.2 / 2026-09-28 | ✅ / ^8–^10 | — | **Брать.** 295 правил, лицензия **LGPL-3.0-only** [V]; как devDependency это обычно не проблема [I] |
| `eslint-plugin-unicorn` | 79.0.0 / 2026-10-23 | ✅ / **>=10.4** | **>=22** | **Брать.** 396 правил, 380 в recommended [V]; `prevent-abbreviations` → `name-replacements` |
| `@eslint-community/eslint-plugin-eslint-comments` | 4.8.1 / 2026-09 | ✅ / до ^10 | — | **Брать** (аналог noqa-правил) |
| `eslint-plugin-functional` | 10.0.1 / 2026-09 | ✅ / ^9 \|\| ^10 | >=20 | Выборочно: `no-let`, `no-loop-statements`. `immutable-data` и `prefer-tacit` без типов не работают — ESLint падает [V] |
| `eslint-plugin-import-x` | 4.17.1 / 2026-06-28 | ✅ / до ^10 | >=18.18 | **Брать** (`no-cycle`, `max-dependencies`, `no-mutable-exports`). Нужен `settings['import-x/resolver-next']: [createNodeResolver()]`, иначе падает [V] |
| `eslint-plugin-n` | 18.5.0 / 2026-10 | ✅ | — | Только для конфиг-файлов Node; 0 нарушений [V] |
| `eslint-plugin-promise` | 7.3.0 / 2026-04-27 | ✅ / до ^10 | — | Брать; 20 срабатываний `param-names` на тестовом `new Promise(r => …)` [V] |
| `eslint-plugin-regexp` | 3.3.3 / 2026-11-01 | ✅ / >=9.38 | — | Брать recommended; `all` требует флаг `v` у регулярок |
| `eslint-plugin-security` | 4.2.1 / 2026-10-30 | ✅ | >=18.18 | Брать; `detect-object-injection` шумит (5 ложных срабатываний) [V/I] |
| `eslint-plugin-no-unsanitized` (Mozilla) | 4.1.5 / 2026-02-19 | ✅ / ^9 \|\| ^10 | — | **Брать** (проект трогает DOM) |
| `eslint-plugin-jsdoc` | 65.4.3 / 2026-11-03 | ✅ / до ^10 | **^22.22.2 \|\| >=24.15** | Брать вместе с checkJs; конфиг `flat/recommended-typescript-flavor-error` |
| `@vitest/eslint-plugin` | 1.6.28 / 2026-10-22 | ✅ / >=8.57 | **>=22** | **Заменить им `eslint-plugin-vitest`.** В `configs.all` есть typed-правило `unbound-method` — без типов падает [V] |
| `eslint-plugin-vitest` | 0.5.4 / **2024-04-23** | ESLint ≤9 | — | **Убрать**: на ESLint 10 падает при загрузке [V] |
| `eslint-plugin-playwright` | 2.12.2 / 2026-11-02 | ✅ / >=8.40 | — | Оставить |
| `@html-eslint/eslint-plugin` | 0.67.0 / 2026-10-14 | ✅ / до ^10 | — | Оставить. `eslint-plugin-html` (8.2.1) нужен, только если линтовать inline-`<script>` |
| `eslint-plugin-perfectionist` | 5.13.0 / 2026-10-20 | ✅ | ^20 \|\| >=22 | По желанию; 272 нарушения, почти все исправляются `--fix` [V] |
| `eslint-plugin-de-morgan` | 2.3.0 / 2026-10-23 | ✅ | — | Брать (0 нарушений) |
| `typescript-eslint` | 8.72.1 / 2026-10-26 | ✅ / до ^10 | >=18.18 | Peer `typescript >=4.8.4 <6.1.0` — **TS 7 не поддерживается** [V]. `strictTypeChecked` на JS без JSDoc-типов дал 1029 нарушений, почти все `no-unsafe-*` [V] |
| `xo` | 5.0.1 / 2026-09-18 | flat | >=22 | Готовая обёртка (unicorn, import, n…), но без сложности/sonar; кастомизация хуже голого ESLint [I] |

### 2.3 Альтернативные линтеры

| Инструмент | Версия | Сильные стороны | Чего не хватает |
|---|---|---|---|
| **oxlint** | 1.91.0 / 2026-11-03 | 872 встроенных правила, есть порты unicorn, vitest, import, promise, jsdoc [V: oxc.rs]; JS-плагины в статусе «alpha»; type-aware через tsgo | Нет sonarjs и cognitive complexity [I: в выводе не встретилось ни одного правила `complexity`]. На категориях `pedantic+style+restriction` дал 1568 нарушений, с шумом (`one-var`, `sort-keys`, `no-async-await`) [V] |
| **Biome** | 2.6.5 / 2026-11-04 | Быстрый, есть `noExcessiveCognitiveComplexity` [V] | Плагинов sonar и unicorn нет; на recommended — 9 предупреждений [V] |

Вывод [I]: для максимальной строгости основным остаётся ESLint 10. oxlint можно поставить перед ним ради скорости (через `eslint-plugin-oxlint` дубли выключаются), но для этого маленького репозитория (~2.6 тыс. строк JS) выигрыш несущественный.

### 2.4 CSS / HTML

| Пакет | Версия / дата | Node | Оценка |
|---|---|---|---|
| `stylelint` | **18.0.0 / 2026-11-03** | ^22.22.2 \|\| ^24.15 \|\| >=26 | Мажорный релиз вчерашний; переходить после 1–2 патчей [I] |
| `stylelint-config-standard` | 41.0.0 / 2026-11-03 | то же | Брать вместе со stylelint 18 |
| `stylelint-config-recess-order` (+ `stylelint-order` 8.1.3) | 7.10.0 / 2026-11-02 | — | Брать: порядок свойств, 8 нарушений, `--fix` [V] |
| `stylelint-declaration-strict-value` | 1.12.1 / 2026-08-24 | — | Брать: цвета и z-index только через `var()` (2 нарушения) [V] |
| `stylelint-high-performance-animation` | 2.0.0 / 2026-01-25 | — | Брать (0 нарушений) |
| `stylelint-plugin-logical-css` | 2.1.0 / 2026-03-29 | — | По желанию (2 нарушения) |
| `stylelint-config-strict-scss` | 0.5.0 / **2022-05** | — | Не брать: заброшен и сделан под SCSS |
| `html-validate` | 11.18.0 / 2026-11-01 | ^22.22 \|\| >=24.8 | Брать: 3 нарушения (`no-autoplay` ×2 — для видеозвонка ожидаемо, `doctype-style`) [V] |

Строгий stylelint (standard 41 + recess-order + strict-value + logical + `selector-max-id: 0`, `selector-max-specificity: 0,3,0`, `max-nesting-depth: 2`, `declaration-no-important`, `color-named: never`) на `index.html` дал **16** нарушений [V].

### 2.5 Дополнительные инструменты

| Инструмент | Версия | Результат на репозитории [V] |
|---|---|---|
| `knip` 6.44.1 (dead code) | 2026-10-31 | `vite-plugin-node-polyfills` объявлен, но не используется; `@eslint/js` и `globals` используются, но не объявлены (приходят транзитивно); дублирующий экспорт `getIceServers` / `getStunServers` в `src/shared/config/stun.js` |
| `jscpd` 5.4.2 (дубли, `--min-tokens 50`) | 2026-10-20 | 18 клонов, 5.66 % строк, в основном в тестах |
| `dependency-cruiser` 18.7.2 | 2026-11-02, Node ^22 | Не запускался; `import-x/no-cycle` циклов не нашёл. Полезен для слоёв app → connection → shared [I] |
| `type-coverage` 2.31.1 | 2026-10-31 | Не запускался; осмыслен только после аннотирования JSDoc [I] |
| `tsc` (`checkJs`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | TS 6.0.3 и 7.0.2 | **553** ошибки, 122 в коде приложения. TS 7 даёт столько же, то есть checkJs работает и в нативном TS 7 [V]. Основные коды: TS7005/7006/7034 (implicit any) |

## 3. Рекомендация

### 3.1 Стек

1. **Node ≥ 22** в `engines` и CI (без этого не встанут unicorn 79, `@vitest/eslint-plugin`, jsdoc, stylelint 18).
2. **ESLint 10** + `@eslint/js` 10: recommended и пороги из §3.2.
3. Плагины: `eslint-plugin-sonarjs`, `eslint-plugin-unicorn` (recommended), `@eslint-community/eslint-plugin-eslint-comments`, `eslint-plugin-import-x`, `eslint-plugin-promise`, `eslint-plugin-regexp`, `eslint-plugin-security` + `eslint-plugin-no-unsanitized`, `eslint-plugin-de-morgan`, `eslint-plugin-jsdoc`, **`@vitest/eslint-plugin`** (вместо `eslint-plugin-vitest`), `eslint-plugin-playwright`, `@html-eslint`.
4. **Типы:** `tsconfig.json` с `checkJs` и `strict`, скрипт `typecheck: tsc --noEmit`. Включать постепенно: сначала `src/shared`, потом `connection`, `app`, тесты. typescript-eslint `strictTypeChecked` — только после того, как `tsc` станет зелёным; до тех пор `no-unsafe-*` дают около тысячи срабатываний. Держаться TS 6.0.x, пока typescript-eslint не поддерживает TS 7.
5. **CSS/HTML:** stylelint 18 + standard 41 + recess-order + declaration-strict-value + high-performance-animation; html-validate.
6. **CI-гейты:** `knip`, `jscpd --threshold 5`.

### 3.2 Стартовый набор правил (пороги в духе wemake)

```js
// приложение (src/**, кроме тестов)
complexity: ['error', 10],
'max-depth': ['error', 3],
'max-params': ['error', 5],                // MAX_ARGUMENTS=5
'max-statements': ['error', 12],           // wemake MAX_EXPRESSIONS=9; 12 — компромисс
'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
'max-nested-callbacks': ['error', 3],
'max-classes-per-file': ['error', 1],
'id-length': ['error', { min: 2, max: 45, exceptions: ['_'] }],
'id-denylist': ['error', 'data', 'result', 'item', 'obj', 'value', 'tmp'],
'no-magic-numbers': ['error', { ignore: [-1, 0, 1, 2], ignoreDefaultValues: true, ignoreArrayIndexes: true, enforceConst: true }],
curly: ['error', 'all'],
eqeqeq: ['error', 'always'],
'no-param-reassign': ['error', { props: true }],
'require-await': 'error',
'sonarjs/cognitive-complexity': ['error', 12],      // MAX_COGNITIVE_SCORE=12
'sonarjs/expression-complexity': ['error', { max: 3 }],
'sonarjs/no-duplicate-string': ['error', { threshold: 3 }], // MAX_STRING_USAGES=3
'sonarjs/nested-control-flow': ['error', { maximumNestingLevel: 3 }],
'sonarjs/max-switch-cases': ['error', 7],
'import-x/max-dependencies': ['error', { max: 12 }], // MAX_IMPORTS=12
'import-x/no-cycle': 'error',
'import-x/no-mutable-exports': 'error',
'functional/no-let': 'error',
'@eslint-community/eslint-comments/require-description': 'error',
'@eslint-community/eslint-comments/no-unlimited-disable': 'error',
'jsdoc/require-jsdoc': ['error', { publicOnly: true }],
// linterOptions: { reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error' }

// тесты: снять max-statements/lines/nested-callbacks/magic-numbers/no-duplicate-string, добавить
'vitest/max-expects': ['error', { max: 5 }],        // MAX_ASSERTS=5
'vitest/max-nested-describe': ['error', { max: 2 }],
'vitest/no-conditional-in-test': 'error',
'vitest/no-conditional-expect': 'error',
'vitest/prefer-strict-equal': 'error',
'vitest/require-to-throw-message': 'error',
'vitest/consistent-test-it': 'error',
```

Пороги wemake по умолчанию [V: `options/defaults.py`]: `MAX_ARGUMENTS=5`, `MAX_LOCAL_VARIABLES=5`, `MAX_EXPRESSIONS=9`, `MAX_RETURNS=5`, `MAX_MODULE_MEMBERS=7`, `MAX_METHODS=7`, `MAX_LINE_COMPLEXITY=14`, `MAX_JONES_SCORE=12`, `MAX_IMPORTS=12`, `MAX_COGNITIVE_SCORE=12`, `MAX_COGNITIVE_AVERAGE=8`, `MAX_STRING_USAGES=3`, `MAX_CONDITIONS=4`, `MAX_ASSERTS=5`, `MAX_NOQA_COMMENTS=10`, `MIN_NAME_LENGTH=2`, `MAX_NAME_LENGTH=45`.

### 3.3 Сколько нарушений даст текущий код (замер ESLint 10.14 + unicorn 79 и т. д., `npm i --no-save`) [V]

| Слой | Всего | Код приложения | Тесты и e2e | Взрывоопасность |
|---|---:|---:|---:|---|
| **Стартовый набор (§3.2, без jsdoc и functional)** | **309** | 157 | 152 | средняя; 83 из них — `unicorn/name-replacements` (выключить, как было), 32 `curly` (`--fix`) |
| `@eslint/js` `configs.all` + пороги wemake | 407 | 139 | 268 | высокая (`no-underscore-dangle` 64, `id-length` 46, `no-promise-executor-return` 37) |
| unicorn `configs.all` | 244 | 119 | 125 | высокая (`name-replacements` 83, `no-null` 57, `filename-case` 23) |
| sonarjs recommended + пороги | 24 | 10 | 14 | низкая |
| eslint-comments (строгий `no-use`) | 1 | 0 | 1 | нет |
| functional (`no-let`, `no-loop-statements`) | 25 | 12 | 13 | низкая |
| import-x recommended + `no-default-export` | 6 | 6 | 0 | нет (4 — конфиги, которым нужен default export; 2 — необъявленные `@eslint/js` и `globals`) |
| promise | 20 | 0 | 20 | низкая (`param-names` в тестах) |
| regexp `all` | 45 | 3 | 42 | низкая (флаги `u`/`v`) |
| security + no-unsanitized | 6 | 3 | 3 | низкая |
| jsdoc (`publicOnly`) | 45 | 45 | 0 | средняя (писать JSDoc на всё публичное) |
| perfectionist | 272 | 84 | 188 | высокая по числу, но почти всё `--fix` |
| @vitest/eslint-plugin `all` | 206 | 0 | 206 | высокая (`require-mock-type-parameters` 35, `prefer-importing-vitest-globals` 32) |
| typescript-eslint `strictTypeChecked` | 1029 | 321 | 708 | **очень высокая** (`no-unsafe-*` ≈ 930) |
| **Всё вместе** | **2260** | 686 | 1574 | — |
| `tsc --checkJs --strict` | 553 | 122 | 431 | **очень высокая** |
| stylelint strict (index.html) | 16 | — | — | низкая |
| html-validate recommended | 3 | — | — | нет |

Нарушения порогов сложности, которые придётся рефакторить руками [V]:

- `src/app/controller.js:14` `initApp`: cyclomatic 17, cognitive 16, 146 строк, 37 statements.
- `src/app/controller.js:55` `startDirectMode`: cyclomatic 15, cognitive 18, 63 строки, 26 statements.
- `src/shared/stats.js:1` `deriveMetrics`: cyclomatic 15, cognitive 19, вложенность 4.
- `src/shared/browserSupport.js:12` `checkSupport`: cyclomatic 12.
- `src/connection/trysteroAdapter.js:19` `join`: 14 statements.
- `e2e/direct-connect.spec.js:8`: 21 statement в тесте.

### 3.4 Порядок внедрения [I]

1. Node 22, ESLint 10, `@vitest/eslint-plugin`, unicorn 79 (`name-replacements: off`) — текущий lint остаётся зелёным.
2. sonarjs, eslint-comments, security, no-unsanitized, regexp, promise, import-x, de-morgan — около 60 нарушений.
3. Пороги сложности как `error` и рефакторинг `initApp`, `startDirectMode`, `deriveMetrics`.
4. JSDoc и `tsc --checkJs` по каталогам (`shared` → `connection` → `app` → тесты); потом typescript-eslint `strictTypeChecked`.
5. stylelint 18 со строгими плагинами, html-validate, knip, jscpd в CI.

## Источники

- wemake-python-styleguide: https://github.com/wemake-services/wemake-python-styleguide/blob/master/wemake_python_styleguide/options/defaults.py ; каталог `violations/` там же; PyPI https://pypi.org/project/wemake-python-styleguide/ (1.8.1, 2026-09-12).
- ESLint version support: https://eslint.org/version-support/ («ESLint v9.x reached end-of-life on 2026-08-06 and is no longer maintained.»).
- npm registry (`npm view <pkg> --json`: `version`, `time`, `engines`, `peerDependencies`, `license`) — для всех пакетов в таблицах §2, на 2026-11-04.
- @vitest/eslint-plugin: https://github.com/vitest-dev/eslint-plugin-vitest
- oxlint: https://oxc.rs/docs/guide/usage/linter.html («872 built-in rules», «JS plugins (alpha)»).
- Biome: `biome explain noExcessiveCognitiveComplexity` (2.6.5).
- Замеры: временные `eslint.strict.config.js`, `tsconfig.json`, `stylelint.strict.json`, `.htmlvalidate.json` в worktree; в репозиторий не коммитились.
