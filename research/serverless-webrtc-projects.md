# Готовые решения для WebRTC без сигнального сервера

Ресерч к issue #7 (родитель #1). Дата: 2026-11-04.
Пометки: **[V]** — проверено по первоисточнику (код, README, API GitHub/npm), **[I]** — вывод, не проверен напрямую.

## Короткий ответ

Брать почти нечего. Все четыре проекта решают задачу так же или хуже, чем мы.

- `cjb/serverless-webrtc`, `xem/miniWebRTC` и `lesmana/webrtc-without-signaling-server` — одна линия демо 2013–2022 годов. Это ручной копипаст полного JSON `RTCSessionDescription` без trickle ICE, сжатия, QR и TURN, с одним STUN. Наш direct-режим (`src/connection/directAdapter.js`, `src/shared/sdp.js`) уже делает то же самое, а вдобавок сжимает SDP, кладёт его в ссылку и QR и передаёт медиа.
- `webConnect.js` — обёртка над Trystero (torrent + nostr + mqtt одновременно). Это та же архитектура, что у нас. Кроме того, опция ICE в ней из-за бага не применяется.
- Ни один проект не минимизирует SDP, не работает без STUN и не предлагает новых каналов обмена. Для РФ полезны только два адреса STUN-серверов для замера и мелкая оптимизация нашего формата (см. «Идеи»).

## Сравнение

| | cjb/serverless-webrtc | xem/miniWebRTC | lesmana/webrtc-without-signaling-server | webConnect.js | call-ma |
|---|---|---|---|---|---|
| Сигнализация | Ручной копипаст JSON SDP | Ручной копипаст JSON SDP | Ручной копипаст JSON SDP | Trystero: torrent + nostr + mqtt | Trystero (mqtt + torrent) + direct (ссылка/QR) |
| Trickle ICE | Нет, ждёт `candidate == null` | Нет, так же | Нет, так же | Как в Trystero 0.22: нет, ждёт `complete` до 5 с | Trystero 0.25: да; direct: нет, ждёт `complete` до 5 с |
| Сжатие SDP | Нет | Нет | Нет | — | deflate-raw + base64url |
| ICE по умолчанию | `stun:23.21.150.121` | `stun:stun.gmx.net` | `stun:stun.stunprotocol.org` | Google + Twilio STUN (не применяется, см. ниже) | Google STUN ×2 + TURN из env |
| Медиа | Видео/аудио + data channel | Только data channel | Только data channel | Медиа + данные | Видео/аудио |
| Последний коммит | 2021-09-03 | 2022-06-01 | 2021-12-21 | 2026-06-27 (README) | — |
| Звёзды / откр. issues | 1566 / 17 | 100 / 1 | 316 / 1 | 26 / 0 | — |
| Лицензия | MIT (+Apache/MIT для вендоров) | CC0 (`LICENSE.md`) | AGPL-3.0 | MIT | — |

Даты, звёзды и лицензии взяты из `gh api repos/...` 2026-11-04 [V].

## По проектам

### cjb/serverless-webrtc

- Пользователи вручную передают offer и answer, «for example via IM». Приложение может работать из `file:///` [V] [README](https://github.com/cjb/serverless-webrtc/blob/master/README.md).
- Код ждёт конца сбора кандидатов (`e.candidate == null`) и выводит `JSON.stringify(pc.localDescription)` [V] [js/serverless-webrtc.js](https://github.com/cjb/serverless-webrtc/blob/master/js/serverless-webrtc.js). Сжатия нет.
- ICE: `{'iceServers': [{urls: 'stun:23.21.150.121'}]}` [V] (там же). Это захардкоженный IP (старый STUN Mozilla на AWS); живость не проверял [I].
- Проект мёртв: последний коммит 2021-09-03, открытые issues вроде «This demo is completely broken» (#33, 2018) [V] [issues](https://github.com/cjb/serverless-webrtc/issues).

### xem/miniWebRTC

- Это упрощённый форк cjb: «no signaling server, but the STUN server is still necessary and used» [V] [README](https://github.com/xem/miniWebRTC/blob/gh-pages/README.md).
- README говорит об обмене «via an url», но в `index.html` есть только поля `<input>` для копипаста JSON [V] [index.html](https://github.com/xem/miniWebRTC/blob/gh-pages/index.html).
- ICE: `stun:stun.gmx.net` с устаревшим ключом `url`. Используются колбэчный `createOffer` и `DtlsSrtpKeyAgreement` [V] (там же). Имя `stun.gmx.net` резолвится в 212.227.67.33 (1&1, Германия) на 2026-11-04 [V, `getent hosts`].
- В issue #1 «Omit STUN?» автор пишет, что так и не смог обойтись без STUN: «the STUN server's main feature is to tell you what's your IP, which I think JS can't do alone» [V] [#1](https://github.com/xem/miniWebRTC/issues/1). Это совпадает с выводом #4.

### lesmana/webrtc-without-signaling-server

- README: «a free stun server is used if the connection goes over the internet. a turn server is never used». Обмен — «messaging services, emails, or pen and paper» [V] [README](https://github.com/lesmana/webrtc-without-signaling-server/blob/master/README.md). Целевой сценарий — игра в одной локальной сети.
- Код ждёт `event.candidate == null` и кладёт JSON SDP в `<textarea>` [V] [common.js](https://github.com/lesmana/webrtc-without-signaling-server/blob/master/common.js), [offering.js](https://github.com/lesmana/webrtc-without-signaling-server/blob/master/offering.js).
- ICE: `stun:stun.stunprotocol.org`. На 2026-11-04 имя не резолвится [V, `getent hosts`], то есть демо через интернет сломано.
- Единственный открытый issue #1 — «error trying to connect between different networks». Автор: «i am by for no webrtc expert… was not able to debug the problem» [V] [#1](https://github.com/lesmana/webrtc-without-signaling-server/issues/1).
- AGPL-3.0: код копировать нельзя без перелицензирования [V].

### webConnect.js (nuzulul/webConnect.js)

- Сайт: «leveraging already established public protocol, such as Torrent, MQTT and NOSTR for signaling» [V] [webconnect.js.org](https://webconnect.js.org/).
- Единственная зависимость — `"trystero": "^0.22.0"` [V] [package.json](https://github.com/nuzulul/webConnect.js/blob/main/package.json). В `src/webconnect.js` открываются три комнаты Trystero параллельно, а пиры дедуплицируются по массиву `engine`. Это то же, что `TrysteroAdapter` у нас [V] [src/webconnect.js](https://github.com/nuzulul/webConnect.js/blob/main/src/webconnect.js).
- Дефолтный ICE: `stun:stun.l.google.com:19302` + `stun:global.stun.twilio.com:3478` [V] (там же).
- **Баг:** конфиг передаётся как `rtcConfig: { config: iceConfiguration }` [V] (там же). Trystero 0.22 делает `new RTCPeerConnection({iceServers: defaultIceServers…, ...rtcConfig})` [V] [trystero@0.22.0/src/peer.js](https://unpkg.com/trystero@0.22.0/src/peer.js). Ключ `config` браузер игнорирует, поэтому реально используются дефолтные STUN Trystero (Google ×3 + Cloudflare), а опция `iceConfiguration` ни на что не влияет [I — вывод из чтения кода, не запускал].
- Перехватывает `console.warn` и заменяет «Trystero» на «webConnect.js» [V] (там же).
- npm `webconnect@0.0.12`, последнее изменение в реестре 2025-11-13. Последний коммит в репо 2026-06-27 («update readme») [V] [npm](https://registry.npmjs.org/webconnect), API GitHub. Проект маленький (26 звёзд), автор один.

## Идеи для заимствования

Из самих проектов:

1. **`global.stun.twilio.com:3478` — кандидат в список STUN для РФ.** Взято из дефолтов webConnect.js. На 2026-11-04 резолвится в `ec2-…eu-central-1.compute.amazonaws.com` [V, `getent hosts`]. По выводам #3 AWS в РФ не тормозят по 16 КБ, а STUN — это несколько UDP-пакетов. Доступность из РФ не проверена [I]. Добавить в замер вместе со списком из #3.
2. **`stun.gmx.net` (1&1, Германия) — ещё один кандидат для замера**, взят из miniWebRTC. Резолвится [V], доступность из РФ неизвестна [I].
3. **Канал обмена «pen and paper».** lesmana явно называет бумагу и голосовой канал допустимыми [V]. Для РФ при белых списках это значит, что хорошо бы иметь короткую, диктуемую форму SDP. Сейчас direct-режим отдаёт ссылку на ~1–2 КБ base64url [I], продиктовать её нельзя. Без минимизации SDP (п. 4) идея не реализуема.

Из сравнения (ни один проект этого не делает, это наши собственные выводы):

4. **Минимизация SDP перед сжатием** [I, нужен замер на реальном offer]:
   - не кодировать JSON-обёртку `{type, sdp}`: тип уже есть в `#offer=` / `#answer=` (`src/shared/link.js`), а `encodeSdp` в `src/shared/sdp.js` сериализует весь `RTCSessionDescription`;
   - выкидывать дубли кандидатов, `tcptype` и IPv6 link-local до кодирования;
   - сузить набор кодеков через `RTCRtpTransceiver.setCodecPreferences()` (один видео-, один аудиокодек). Строки `a=rtpmap`/`a=fmtp`/`a=rtcp-fb` — основной объём SDP для медиа [I];
   - радикальный вариант: передавать только `ice-ufrag`, `ice-pwd`, `fingerprint` и кандидаты, а SDP собирать на другой стороне по шаблону. Это хрупко между Chrome/Firefox/Safari; брать только если QR перестанет читаться.
5. **Ограничение QR как цель.** QR версии 40 вмещает 2953 байта в binary-режиме, но плотный QR плохо считывается с экрана телефона [I]. Перед любой оптимизацией стоит залогировать длину `encoded` для offer и answer в Chrome и Firefox.

Брать **не нужно**:

- код всех трёх демо: устаревшее API (`url`, колбэчный `createOffer`, `webkitRTCPeerConnection`), мёртвые STUN, только data channel; у lesmana ещё и AGPL;
- webConnect.js как зависимость: та же архитектура над Trystero, но более старая версия (0.22) и сломанный ICE-конфиг. Единственное, чего у нас может не быть, — Nostr-транспорт, а он есть в самом Trystero (`trystero/nostr`);
- trickle ICE для direct-режима: при ручном обмене одна ссылка в каждую сторону возможна только при non-trickle. Все три демо и наш `#waitForIce` делают так же [V].

## Источники

- https://github.com/cjb/serverless-webrtc — README, `js/serverless-webrtc.js`, `LICENSE`, issues (просмотрено 2026-11-04)
- https://github.com/xem/miniWebRTC — README, `index.html`, `LICENSE.md`, issues #1, #2
- https://github.com/lesmana/webrtc-without-signaling-server — README, `common.js`, `offering.js`, `answering.js`, issue #1
- https://webconnect.js.org/, https://github.com/nuzulul/webConnect.js — README, `package.json`, `src/webconnect.js`
- https://unpkg.com/trystero@0.22.0/src/peer.js — `rtcConfig`, `defaultIceServers`, `iceTimeout = 5000`
- `node_modules/@trystero-p2p/core/dist/peer.mjs` 0.25.0 — `trickleIce`, `iceTimeout = 15e3`
- Предыдущие ресерчи: #3 (`research/ru-signaling-channels`), #4 (`research/serverless-nat-traversal`)
