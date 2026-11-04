# Обновление зависимостей (issue #8)

Дата исследования: 2026-11-04. Метки: **[V]** — проверено по первоисточнику
(исходники пакета в `node_modules`, npm registry, CHANGELOG/README/issues
dmotz/trystero, запуск кода); **[I]** — вывод, не проверенный запуском в браузере.

## TL;DR

1. **Главная находка — вероятная причина #1 «звонки не соединяются».**
   В установленном `@trystero-p2p/core@0.25.0` обработчики событий комнаты —
   *свойства* (`room.onPeerJoin = cb`), а не функции регистрации. Наш код вызывает
   `room.onPeerJoin(cb)` (`src/connection/trysteroAdapter.js:32`), это бросает
   `TypeError: room.onPeerJoin is not a function`. Исключение ловит `try` (стр. 49),
   поэтому `onPeerStream` и `onPeerLeave` (стр. 36, 42) не регистрируются ни для
   одного транспорта. Удалённый поток никогда не попадает в `<video>`, а в логе
   дважды пишется `Connection error: room.onPeerJoin is not a function`. [V]
2. Тесты этого не ловят: `FakeRoom` в `src/__tests__/trysteroAdapter.test.js:4` и
   `src/__tests__/error-retry.test.js:5` реализует старый API с методами (0.24). [V]
3. Trystero: lockfile держит 0.25.0, последняя — **0.26.0** (2026-10-04). Переход
   0.25.0 → 0.26.0 не ломает API медиа и событий. В 0.26.0 исправлено много
   проблем с соединением, в том числе класс багов «peers never connect». [V]
4. Остальное: безопасные минорные обновления закрывают `npm audit` по vite и
   undici. Мажорные обновления dev-инструментов (vitest 5, eslint 10, jsdom 30,
   stylelint 18) требуют Node ≥ 22 и связаны друг с другом. `eslint-plugin-vitest`
   заброшен. `vite-plugin-node-polyfills` не используется. [V]

## 1. Trystero

### 1.1 Версии [V]

Источник: `npm view @trystero-p2p/core versions time`.

| Версия | Дата публикации в npm |
|---|---|
| 0.24.0 | 2026-04-27 |
| 0.25.0 (у нас, `package-lock.json`) | 2026-05-23 |
| 0.25.1 | 2026-05-26 |
| 0.25.2 | 2026-06-11 |
| 0.25.3 | 2026-07-13 |
| 0.25.4 (`wanted` для `^0.25.0`) | 2026-08-30 |
| **0.26.0 (latest)** | 2026-10-04 |

Пакеты монорепо: `core firebase ipfs mqtt nostr supabase torrent trystero ws-relay`
(`gh api repos/dmotz/trystero/contents/packages`).

### 1.2 Сверка нашего кода с API 0.25+ [V]

Источники: `node_modules/@trystero-p2p/core/dist/types.d.mts` (тип `Room`),
`core/dist/room.mjs:191-215` (getter/setter `onPeerJoin`/`onPeerStream`…),
CHANGELOG 0.25.0 «Room event handlers are now nullable callback properties
instead of registration functions», README «send stream to peers who join later».

| Место | Сейчас | Должно быть (0.25+) | Последствие |
|---|---|---|---|
| `trysteroAdapter.js:32` | `room.onPeerJoin((peerId) => …)` | `room.onPeerJoin = (peerId) => …` | **TypeError, ломает весь join** |
| `trysteroAdapter.js:33` | `room.addStream(localStream, peerId)` | `room.addStream(localStream, { target: peerId })` | строка как `options` → `options.target === undefined` → рассылка всем пирам вместо одного |
| `trysteroAdapter.js:36` | `room.onPeerStream((stream, peerId) => …)` | `room.onPeerStream = (stream, peerId, metadata) => …` | не выполняется: код падает раньше, на стр. 32 |
| `trysteroAdapter.js:42` | `room.onPeerLeave((peerId) => …)` | `room.onPeerLeave = (peerId) => …` | то же |
| `trysteroAdapter.js:23-25` | `relayConfig: { urls }`, `turnConfig` | совпадает с `JoinRoomConfig` | OK |
| `trysteroAdapter.js:27` | `joinRoom(config, roomId)` без 3-го аргумента | `joinRoom(config, roomId, { onJoinError })` | не видим ошибок «SDP обменялись, но WebRTC не поднялся, нужен TURN» (появилось в 0.25.0) |
| `TrysteroAdapter.destroy` | `r?.leave?.()` | `leave()` возвращает `Promise<void>` | OK, но промис не ждём |

Проверка запуском (Node 26, заглушка `RTCPeerConnection`, реальный
`@trystero-p2p/mqtt@0.25.0`):

```
typeof onPeerJoin = object null
THROWS: TypeError room.onPeerJoin is not a function
```

Как сейчас выглядит сбой (по `controller.js:135-141`) [I]: `room.addStream(localStream)`
(стр. 31) успевает выполниться, комната подключается к релеям и, вероятно, даже
поднимает WebRTC-соединение, но `onPeerStream`/`onConnect` не срабатывают никогда.
Пользователь видит «Connecting…» и строку `Connection error: …` в логе.

### 1.3 Breaking changes 0.25.0 → 0.26.0 [V]

Источник: [CHANGELOG.md](https://github.com/dmotz/trystero/blob/main/CHANGELOG.md).

- **0.25.0** (по сравнению с 0.24) — то, что выше: события комнаты стали свойствами;
  медиа-API принимает `options` (`{ target, metadata }`) в `addStream`,
  `removeStream`, `addTrack`, `removeTrack`, `replaceTrack`; `makeAction()`
  возвращает объект вместо кортежа (мы `makeAction` не используем).
- 0.25.1–0.25.4 — без ломающих изменений.
- **0.26.0**: лимит входящих данных по умолчанию 256 MiB (`maxReceiveBytes`);
  изменился внутренний wire-формат actions, поэтому **все пиры должны быть на
  одной версии**. Для нас это значит: после деплоя старая вкладка (PWA-кеш) и
  новая могут не договориться [I]. Медиа и события между 0.25 и 0.26 не менялись.

### 1.4 Исправления, связанные с соединением, ICE, реконнектом и релеями [V]

| Версия | Что исправлено |
|---|---|
| 0.25.1 | Релейные сокеты переподключаются надёжнее (capped/jittered backoff); ошибки announce логируются и не останавливают следующие попытки; Nostr восстанавливает подписки после реконнекта |
| 0.25.2 | `leave()` больше не создаёт заново и не оставляет осиротевшие сокеты |
| 0.25.3 | Новый трекер по умолчанию `open.ftorrent.com`; `relayConfig.warnOnRelayFailure` |
| 0.25.4 | Меньше сигнального трафика (быстрый «burst», потом редкий steady-announce); Torrent учитывает интервал, который запросил трекер; подписки и announce восстанавливаются после реконнекта. Автор: «recommended to upgrade … as soon as possible» |
| 0.26.0 | Восстановление после потерянных сигнальных сообщений (повторы offer, повтор answer); исправлены «stale peers» после быстрого rejoin и долгого простоя; конфликты renegotiation и устаревшие offer; **Torrent: медленная установка соединения и устаревшие offer**; offer создаются по требованию вместо заранее прогретых `RTCPeerConnection`; MQTT: пакетные подписки, обновлён список брокеров |

Известные баги, похожие на «пиры никогда не соединяются»:

- [dmotz/trystero#204](https://github.com/dmotz/trystero/issues/204) «Offers older
  than offerTtl are ICE-restarted, then go out with no candidates, so peers never
  connect» — воспроизведено на 0.25.4, закрыт 2026-09-26. Срабатывает, если один
  пир простоял больше минуты: типичный сценарий «создал комнату, отправил ссылку,
  ждёт». Скорее всего, исправлен в 0.26.0 через «offers on demand» и «stale
  offers» [I]. Наш 0.25.0 тоже должен быть затронут [I].
- [#203](https://github.com/dmotz/trystero/issues/203) — зависание при быстром
  rejoin (stale shared-peer binding), закрыт 2026-09-26, в 0.26.0 есть пункт
  «stale peers after quick room rejoins». [V]
- [#207](https://github.com/dmotz/trystero/issues/207) (открыт, на 0.26.0) —
  вторая комната, открытая при уже открытой, использует релеи первой. Репро —
  на одной стратегии (`ws-relay`). У нас MQTT и Torrent — разные стратегии с
  отдельными relay-менеджерами, так что нас, скорее всего, не касается [I].
- [#208](https://github.com/dmotz/trystero/issues/208) (открыт) — релейный сокет,
  который не отвечал около минуты, «списывается» навсегда, и новые комнаты молча
  используют его же [V: заголовок]. Это риск для долгоживущей вкладки.

### 1.5 Настройка ICE и релеев (README, 0.26.0) [V]

- `turnConfig: TurnServerConfig[]` — **добавляется** к дефолтным STUN Trystero
  (`peer.mjs:13`: `iceServers: defaultIceServers.concat(turnConfig ?? [])`).
- `rtcConfig: RTCConfiguration` — разворачивается **после** дефолтов, поэтому
  `rtcConfig.iceServers` полностью **заменяет** STUN Trystero (README: «this won't
  inherit Trystero's defaults»).
- `relayConfig`: `urls` (если задан, `redundancy` игнорируется), `redundancy`,
  `manualReconnection` (Nostr/Torrent), `warnOnRelayFailure` (с 0.25.3).
- `trickleIce`: по умолчанию `true`, но для Torrent и IPFS — `false`.
- `passive` (0.25.0), `maxReceiveBytes` (0.26.0), `callbacks.onJoinError`,
  `onPeerHandshake`, `handshakeTimeoutMs`.
- У нас `getIceServers()`/`STUN_SERVERS` в Trystero не передаются: они идут только
  в `DirectAdapter` (`controller.js:58-62`, `directAdapter.js:12`). Кроме того,
  `getTurnConfig()`/`getIceServers()`/`fromEnv()` читают `globalThis.process?.env`
  (`stun.js:15,24`, `relays.js:14`), а в браузерной сборке этого объекта нет. Значит,
  TURN через env сейчас не настраивается вообще; работают только URL-параметры
  релеев. [V: код]

### 1.6 Стратегии сигнализации

Доступны `nostr` (по умолчанию в пакете `trystero`), `mqtt`, `torrent`, `ipfs`,
`supabase`, `firebase` и с 0.24.0 **`ws-relay`** — самостоятельно хостимый
WebSocket-релей (`@trystero-p2p/ws-relay`, серверная часть —
`@trystero-p2p/ws-relay/server`). README советует порядок надёжности для
децентрализованных стратегий: Nostr → MQTT → BitTorrent → IPFS. [V]

Для нашего VPS (TURN уже в планах) `ws-relay` проще и надёжнее публичных
MQTT-брокеров и трекеров [I].

## 2. Остальные зависимости

Источники: `npm outdated`, `npm view <pkg> time engines peerDependencies`,
GitHub releases. Node в `package.json#engines` — `>=18`.

| Пакет | Текущая | Latest (дата) | Breaking? | Усилия |
|---|---|---|---|---|
| `@trystero-p2p/mqtt`, `/torrent` | 0.25.0 | 0.26.0 (2026-10-04) | нет для нашего API; несовместимый wire-формат между 0.25 и 0.26 | S — плюс обязательная правка адаптера (раздел 1.2) |
| `qrcode` | 1.5.4 | 1.5.4 | — | — |
| `vite` | 8.0.13 | 8.3.5 (2026-10-21) | нет (минор); закрывает high-уязвимости из `npm audit` (8.0.0–8.1.5) | XS |
| `prettier` | 3.8.3 | 3.9.10 (2026-10-10) | нет, но может переформатировать файлы | XS |
| `vitest`, `@vitest/coverage-v8` | 4.1.6 | 4.1.12 / **5.1.0** (5.0.0 — 2026-09-03) | 5.x: Node ≥ 22.12, Vite ≥ 6.4, **моки очищаются перед каждым тестом по умолчанию**, удалены опция `sequential` и устаревшие entry points | 4.1.12 — XS; 5.x — S/M (прогнать 161 тест, проверить `vi.fn` в `beforeAll`) |
| `jsdom` | 29.1.1 | 30.1.3 (30.0.0 — 2026-07-27) | Node ^22.22.2 \|\| ^24.15 \|\| ≥26; закрывает undici (high) | S |
| `eslint` | 9.39.4 | 9.39.5 / **10.14.0** (10.0.0 — 2026-02-06) | Node ^20.19 \|\| ^22.13 \|\| ≥24; flat config у нас уже есть | M, связан с двумя строками ниже |
| `eslint-plugin-vitest` | 0.5.4 (2024-04-23) | 0.5.4 | заброшен, peer `eslint ^8 \|\| ^9`; замена — `@vitest/eslint-plugin` 1.6.28 (Node ≥ 22, peer `typescript >=6`, `@typescript-eslint/eslint-plugin`) | S |
| `eslint-plugin-unicorn` | 64.0.0 | 79.0.0 (2026-10-23) | 15 мажоров; peer `eslint >=10.4`, Node ≥ 22; будут новые правила | M |
| `@html-eslint/*` | 0.60.0 | 0.67.0 (2026-10-14) | 0.x — минор может ломать правила | S |
| `stylelint` | 17.11.1 | 17.16.0 / **18.0.0** (2026-11-03) | 13 breaking (миграционный гайд `to-18.md`), Node ^22.22.2 | S |
| `stylelint-config-standard` | 40.0.0 | 41.0.0 (2026-11-03) | peer `stylelint ^18` | вместе со stylelint |
| `stylelint-config-html`, `postcss-html` | 1.1.0 / 1.8.1 | 2.0.0 (2026-08-01 / 07-31) | Node ^22.12 | вместе со stylelint |
| `vite-plugin-pwa` | 1.3.0 | 2.0.0 (2026-10-03) | единственное изменение — разрешён peer `@vite-pwa/assets-generator ^2`; мы его не используем | XS |
| `vite-plugin-node-polyfills` | 0.26.0 | 0.28.0 | **не используется**: нет в `vite.config.js`, импортов нет; тянет low-уязвимости (`elliptic`, `browserify-sign`…) | XS — удалить |

`npm audit` (lockfile как есть): 35 уязвимостей (10 low, 15 moderate, 10 high).
Прямые: `vite` (high), `vitest`/`@vitest/coverage-v8`, `vite-plugin-pwa`,
`eslint-plugin-vitest`, `vite-plugin-node-polyfills`. Транзитивные high: `undici`
(через `jsdom`), `postcss`, `nanoid`, `js-yaml`, `brace-expansion`, `fast-uri`,
`ip-address`, `source-map-js`, `browserslist`. Почти все — dev-окружение,
в браузерный бандл не попадают [I]. Большую часть закрывает `npm audit fix`
без мажоров. [V]

## 3. Рекомендованный порядок

1. **Сейчас (чинит #1 на текущей 0.25.0):** перевести `trysteroAdapter.js:32-45`
   на присваивание свойств и `{ target: peerId }`; переписать `FakeRoom` в тестах
   под API со свойствами (getter/setter); передать `callbacks.onJoinError` в
   `onError`.
2. Поднять `@trystero-p2p/*` до 0.26.0 (fixes #204/#203 и Torrent). Деплоить
   так, чтобы обе стороны звонка гарантированно получили новую версию: wire-формат
   изменился.
3. `npm audit fix` и минорные обновления (vite 8.3.5, vitest 4.1.12, prettier,
   stylelint 17.16), удалить `vite-plugin-node-polyfills`.
4. Отдельной задачей: поднять `engines.node` до 22, затем мажоры одним
   пакетом — eslint 10 + unicorn 79 + `@vitest/eslint-plugin`, vitest 5,
   jsdom 30, stylelint 18 + конфиги.
5. Отдельной задачей: TURN/STUN через `import.meta.env` (`VITE_*`) вместо
   `process.env`; рассмотреть `ws-relay` на своём VPS.
