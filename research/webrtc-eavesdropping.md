# Можно ли подслушать или записать и расшифровать звонок call-ma

Ресерч к #47 (карта #39 «Безопасность звонков: модель угроз»). Код смотрел на `main` @ 87ae150, Trystero `@trystero-p2p/core` 0.26.0 из `node_modules`.

## Коротко

- Пассивно звонок не подслушать: ни провайдер, ни владелец TURN, ни релей сигнализации не видят звук и видео. Медиа шифрует DTLS-SRTP, ключи согласуются между браузерами.
- Если записать трафик сейчас, расшифровать его потом не получится: WebRTC обязан предпочитать наборы шифров с forward secrecy (ECDHE), а ключи сессии живут только в памяти браузеров.
- Слабое место — активная атака посредника (MITM): нужно подменить отпечаток DTLS-сертификата (`a=fingerprint`) в SDP и одновременно встать на медиапуть. Отпечаток защищён ровно настолько, насколько защищён канал сигнализации.
- У call-ma этот канал защищён слабо. SDP шифруется AES-GCM, но ключ выводится только из `appId` и ID Комнаты, без пароля. ID Комнаты — 8 символов `[a-z0-9]` из `Math.random`, а его SHA-1 публикуется на релеях как имя топика. Владелец релея может перебрать ID, получить ключ, расшифровать и подменить SDP.
- Ни call-ma, ни Trystero не дают пользователю сверить отпечатки (SAS или код на экране). Подмену никто не заметит.
- Метаданные открыты в любом случае: IP-адреса, время, длительность, размеры и тайминги пакетов. Если аудио идёт с переменным битрейтом, по размерам пакетов можно частично восстановить речь.

## Кто что видит

| Кто                                                                 | Что видит                                                                                     | Содержимое звонка                                                                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Провайдер или DPI на пути                                           | IP:порт сторон или TURN, UDP-поток SRTP, размеры и тайминги, DNS и TLS SNI к релеям           | Нет (пассивно). Активно — только вместе с подменой SDP                                                                                               |
| Владелец TURN                                                       | То же плюс учётку TURN; пересылает зашифрованные SRTP и DTLS как есть                         | Нет. TURN — посредник на медиапути, ему нужна только подмена отпечатка в сигнализации                                                                |
| Владелец STUN                                                       | Внешние IP:порт клиентов                                                                      | Нет                                                                                                                                                  |
| Релей сигнализации (MQTT, трекер, Nostr, IPFS)                      | Хеш-топик комнаты, зашифрованные offer, answer и ICE-кандидаты, IP самого подключения к релею | Сам по себе нет, но может перебрать ID Комнаты, расшифровать SDP и подменить отпечаток (см. ниже)                                                    |
| Тот, кто видел ссылку (мессенджер, превью ссылки, история браузера) | ID Комнаты или, в Direct mode, SDP целиком                                                    | Ссылка на Комнату даёт ключ сигнализации. Ссылка Direct mode — открытый SDP с отпечатком. Для MITM дополнительно нужно подменить ссылку при передаче |

## Как работает DTLS-SRTP

1. Каждый `RTCPeerConnection` генерирует самоподписанный сертификат и кладёт его хеш в SDP как `a=fingerprint` ([RFC 8842 §5.1](https://www.rfc-editor.org/rfc/rfc8842.html#section-5.1), атрибут из RFC 8122).
2. После ICE браузеры проводят DTLS-рукопожатие прямо по медиапути (напрямую или через TURN) и сверяют сертификат собеседника с отпечатком из SDP. При несовпадении сторона «MUST tear down the media session immediately» ([RFC 5763 §5](https://www.rfc-editor.org/rfc/rfc5763.html#section-5), [RFC 8842 §5.1](https://www.rfc-editor.org/rfc/rfc8842.html#section-5.1)).
3. Ключи SRTP выводятся из мастер-секрета DTLS через экспортёр ([RFC 5764](https://www.rfc-editor.org/rfc/rfc5764.html)). Шифруется только полезная нагрузка RTP; заголовки RTP, размеры пакетов и тайминги остаются открытыми.

### Forward secrecy

[RFC 8827 §6.5](https://www.rfc-editor.org/rfc/rfc8827.html#section-6.5):

> All implementations MUST support DTLS 1.2 with the TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 cipher suite

> Implementations MUST favor cipher suites which support Forward Secrecy (FS) over non-FS cipher suites

В DTLS 1.2 с ECDHE (и в DTLS 1.3, где обмен всегда эфемерный) мастер-секрет получается из одноразовых ключей Диффи — Хеллмана. Сертификат только подписывает рукопожатие. Поэтому запись трафика плюс даже последующая кража сертификата не дают расшифровать прошлый звонок. Сертификаты call-ma и так эфемерные: мы не передаём `certificates` в `RTCPeerConnection` (`src/connection/directAdapter.ts`, `rtcConfig` в `src/connection/trysteroAdapter.ts`), браузер генерирует их сам.

Вывод: сценарий «записать сейчас, расшифровать потом» для медиа не работает. Исключение — будущий квантовый компьютер против ECDHE; против него WebRTC сегодня не защищён, но это за рамками модели угроз.

## MITM через подмену отпечатка

[RFC 5763 §2](https://www.rfc-editor.org/rfc/rfc5763.html#section-2):

> The fingerprint alone protects against active attacks on the media but not active attacks on the signaling.

[RFC 5763 §8](https://www.rfc-editor.org/rfc/rfc5763.html#section-8): без защиты целостности сигнализации «the security provided is limited to defense against passive attack by intermediaries», а «an active attack on the signaling plus an active attack on the media plane» позволяет атакующему вклиниться.

[RFC 8827 §9.1](https://www.rfc-editor.org/rfc/rfc8827.html#section-9.1): даже по HTTPS «the signaling server can potentially mount a man-in-the-middle attack», если ключи нельзя проверить независимо. По [§4.3](https://www.rfc-editor.org/rfc/rfc8827.html#section-4.3) неаутентифицированный звонок держится на «minimal trust in the signaling service not to perform a man-in-the-middle attack».

Защиту дают два механизма из RFC:

- **Identity (IdP-утверждения)** из RFC 8827. Требует внешнего провайдера личности; в браузерах фактически не поддерживается (был только в Firefox). Для нас неприменим: своей инфраструктуры нет.
- **Сверка вне канала**. [RFC 8827 §6.5](https://www.rfc-editor.org/rfc/rfc8827.html#section-6.5) требует «some mechanism to allow an out-of-band verification of the peer», например «a certificate fingerprint or a Short Authentication String (SAS)». Это единственный вариант без сервера: обе стороны видят на экране короткий код из обоих отпечатков и сверяют его голосом.

### Как отпечаток едет в call-ma

**Режим Комнаты (Trystero).**

- `TrysteroAdapter._buildConfig` передаёт только `{ appId: 'call-ma' }`, без `password` (`src/connection/trysteroAdapter.ts:53`).
- Trystero выводит ключ AES-GCM как `SHA-256("${password}:${appId}:${roomId}")`, то есть при пустом пароле `SHA-256(":call-ma:<roomId>")` (`dist/crypto.mjs`, `genKey`; `dist/strategy.mjs:42`). Этим ключом шифруются offer, answer и ICE-кандидаты (`toCipher`, `encryptOffer`).
- Корневой топик на релеях — `sha1("Trystero@call-ma@<roomId>")` (`dist/strategy.mjs:39-40`, `topicPath` склеивает через `@`). Любой релей его видит.
- ID Комнаты: 8 символов из 36 (`generateRoomId` в `src/app/controller.ts:22`), это 36⁸ ≈ 2,8·10¹² вариантов. Генерируется через `Math.random`, а не `crypto.getRandomValues`.
- README Trystero прямо об этом предупреждает:
  > By default the SDP is encrypted using a key derived from your app ID and room ID to prevent plaintext session data from appearing in logs. This is fine for most use cases, however a relay strategy operator can reverse engineer the key using the room and app IDs.
- Оценка (моя, не из источника): 2,8·10¹² SHA-1 — это минуты на одной игровой видеокарте. Создатель ждёт, пока ссылка дойдёт до собеседника, так что у релея есть время подобрать ID до прихода второго участника.
- Итог: владелец любого из четырёх Транспортов может перебрать ID, расшифровать offer, подставить свой отпечаток и свои ICE-кандидаты, зашифровать обратно и стать посредником. Ни Trystero, ни call-ma этого не заметят: проверка в DTLS сравнивает сертификат с тем отпечатком, который пришёл, а пришёл подменённый.
- Опциональный `password` Trystero и хук `onPeerHandshake` дают вход по общему секрету. Но секрет всё равно надо передать вне канала, и если он едет в той же ссылке, что и ID, защиты не прибавится. Аутентификации отпечатков ни то, ни другое не даёт: handshake идёт уже по установленному соединению, и посредник пропустит его насквозь, если знает пароль.

**Direct mode.**

- SDP целиком, с `a=fingerprint`, сжимается deflate-raw и кодируется base64 в фрагменте ссылки (`src/shared/sdp.ts`, `buildDirectUrl` в `src/shared/link.ts`). Шифрования нет.
- Отпечаток защищён только каналом, по которому передают ссылку или QR-код. Мессенджер со сквозным шифрованием или показ QR лично — хорошая защита. Если канал позволяет подменить сообщение, посредник может подставить свой offer или answer.
- Фрагмент `#...` браузер не отправляет на сервер GitHub Pages, но он остаётся в тексте сообщения у мессенджера и в истории браузера.

## Утечки без расшифровки

- Заголовки RTP и RTCP открыты; при расширении audio level (RFC 6464) в заголовке виден уровень громкости.
- [RFC 6562 §1](https://www.rfc-editor.org/rfc/rfc6562.html#section-1): при VBR-кодеке «known phrases in an encrypted call … can be recognized with high accuracy», потому что SRTP не скрывает размер пакета. Рекомендация — CBR или паддинг до одного размера ([§5](https://www.rfc-editor.org/rfc/rfc6562.html#section-5)). Opus в браузерах по умолчанию работает в VBR (не проверял в исходниках Chromium; тема для отдельной проверки, если решим чинить).
- IP-адреса сторон, время и длительность звонка видят провайдеры, STUN/TURN и (по IP подключения) релеи. Это вопрос метаданных из раздела «Not yet specified» карты.

## Что из этого следует для фиксов

1. **Сверка кода безопасности (SAS) на экране.** Хеш от обоих отпечатков (`getStats` → `RTCCertificateStats.fingerprint` локальный и удалённый), показанный как 4–6 слов или цифр. Единственная защита от MITM без своей инфраструктуры; работает и в режиме Комнаты, и в Direct mode. Вопрос «нужно ли это бабушке» остаётся открытым в карте.
2. **Длинный ID Комнаты из `crypto.getRandomValues`.** Например, 128 бит. Перебор по топику станет невозможен, и ключ сигнализации будет знать только тот, у кого есть ссылка. Это не спасает от того, кто видел ссылку, но убирает атаку «любой оператор релея».
3. **Отдельный секрет в фрагменте ссылки как `password` Trystero.** Можно разделить: в топик идёт хеш одной части, ключ выводится из другой. Аналог п. 2, выбор зависит от длины ссылки.
4. **(Возможно) CBR или DTX-настройки Opus** против утечки речи по размерам пакетов. Низкий приоритет.

## Источники

- [RFC 8827](https://www.rfc-editor.org/rfc/rfc8827.html) — WebRTC Security Architecture, §4.3, §6.5, §9.1.
- [RFC 5763](https://www.rfc-editor.org/rfc/rfc5763.html) — DTLS-SRTP с SIP, §2, §5, §8.
- [RFC 5764](https://www.rfc-editor.org/rfc/rfc5764.html) — расширение DTLS для ключей SRTP.
- [RFC 8842](https://www.rfc-editor.org/rfc/rfc8842.html) — DTLS в SDP offer/answer, §5.1, §5.2.
- [RFC 6562](https://www.rfc-editor.org/rfc/rfc6562.html) — VBR-аудио и SRTP.
- Trystero 0.26.0: `node_modules/@trystero-p2p/core/README.md` (раздел Encryption, TURN), `dist/crypto.mjs`, `dist/strategy.mjs`, `dist/signal-handler.mjs`, `dist/handshake.mjs`.
- Код call-ma: `src/connection/trysteroAdapter.ts`, `src/app/controller.ts`, `src/shared/link.ts`, `src/shared/sdp.ts`, `src/connection/directAdapter.ts`.
