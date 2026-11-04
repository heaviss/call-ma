# Связь без чужих TURN/STUN-серверов

Ресерч к issue #4 (родитель #1). Дата: 2026-11-04.
Пометки: **[V]** — проверено по первоисточнику (ссылка рядом), **[I]** — вывод, не проверен напрямую.

## Короткий ответ

Между двумя браузерами за NAT (а мобильный интернет в РФ — почти всегда CGNAT) звонок **без какого-либо STUN или TURN невозможен**. Без STUN браузер знает только свои локальные адреса, и ни одна сторона не узнаёт адрес, по которому до неё можно достучаться. Без серверов работают три частных случая: одна локальная сеть, глобальный IPv6 у обоих пиров и пир с публичным IP. Остальные варианты (ретрансляция через других пиров, libp2p, ICE-TCP, WebTransport) либо сами требуют публично доступного узла, то есть чужой инфраструктуры, либо не решают NAT между браузерами.

Практический минимум для #1: **чужой публичный STUN** (сейчас Google, `src/shared/config/stun.js`). Отказаться от него без потери связности нельзя. Можно только подобрать STUN, доступные из РФ, а это вопрос #3 и замера у собеседника.

## Почему без STUN не обойтись

- ICE различает 4 типа кандидатов: host (локальный адрес), server-reflexive (адрес на NAT, узнанный через STUN-сервер), peer-reflexive и relayed (через TURN). [V] [RFC 8445 §4](https://www.rfc-editor.org/rfc/rfc8445.html)
- Peer-reflexive кандидаты «are learned from the connectivity checks performed by ICE» [V] [RFC 8445 §5.1.2.1](https://www.rfc-editor.org/rfc/rfc8445.html). Такой кандидат появляется, только когда пакет проверки уже дошёл до пира. Если оба пира за NAT и ни у кого нет srflx-адреса, ни одна проверка не дойдёт [I].
- RFC признаёт, что «use of STUN and TURN servers may be unnecessary in certain networks» [V] (там же). Речь о сетях без NAT между пирами.

## Варианты

| Вариант | Работает в браузере (2026) | Цена / ограничения | Готовое |
|---|---|---|---|
| Host/mDNS-кандидаты, одна сеть | Да | Только одна LAN/Wi-Fi | Встроено в браузеры |
| Глобальный IPv6 у обоих | Да, если у обоих есть IPv6 | В РФ IPv6 редок; фаервол оператора может резать входящие | Встроено |
| ICE-TCP | Только в сторону сервера | Между браузерами за NAT не помогает | — |
| Ретрансляция через других пиров | Технически да | Ретранслятор должен быть достижим обоим, то есть та же проблема NAT; задержка, трафик чужого человека | Нет готового для медиа |
| libp2p circuit relay v2 + `/webrtc` | Да | Нужен публичный relay-узел (не браузер) **и** STUN | js-libp2p |
| WebTransport | Только клиент–сервер | Нужен HTTP/3-сервер | — |
| Медиа через data channel | Да (WebCodecs + RTCDataChannel) | NAT не решает; свой jitter buffer, выше задержка | Нет стандартного |

### 1. Host- и mDNS-кандидаты в одной сети

- Браузеры заменяют локальный IP на случайное имя `<uuid>.local`. «While mDNS names are usually only valid within a local network, the same is true for private IP addresses.» Если mDNS не сработал, ICE откатывается «to either NAT hairpin, if supported, or TURN relay if not». [V] [draft-ietf-mmusic-mdns-ice-candidates-03, 2021-12-05, истёк в 2022 и не стал RFC](https://datatracker.ietf.org/doc/html/draft-ietf-mmusic-mdns-ice-candidates)
- Вывод для проекта: в одной Wi-Fi звонок должен работать вообще без ICE-серверов. Если он не работает (поломка А в #1), причина не в STUN/TURN [I].

### 2. Глобальный IPv6

- Глобальный IPv6-адрес попадает в ICE как обычный host-кандидат, и NAT для него нет. Если у обоих пиров есть IPv6 и фаервол оператора пропускает встречные UDP-пакеты, звонок соединяется без серверов [I].
- В РФ IPv6 распространён мало. По скану Enterno.io (март 2026) IPv6 есть у 11% популярных российских сайтов, а IPv6 абонентам дают «only 30% of ISPs». Источник вторичный [I]: [enterno.io](https://enterno.io/en/s/research-ipv6-adoption-runet-2026). МТС с 2018 года включает IPv6 по умолчанию на новых устройствах Apple [I, слайды RIPE NCC 2019]. Рассчитывать на IPv6 нельзя, но у собеседника его стоит проверить в `chrome://webrtc-internals`.

### 3. ICE-TCP (RFC 6544)

- В RFC 6544 три типа TCP-кандидатов: active, passive и simultaneous-open. ICE-TCP «has, in general, lower success probability for enabling connectivity without a relay». В старом замере simultaneous-open «worked in roughly 45% of the cases». [V] [RFC 6544, 2012](https://www.rfc-editor.org/rfc/rfc6544.html)
- Firefox 54 выдаёт только **active**-кандидаты, а passive и S-O выключены. Mozilla прямо пишет: «this feature won't help improve direct connectivity between two WebRTC enabled browsers». [V] [Mozilla WebRTC blog, 2017-04-06](https://blog.mozilla.org/webrtc/active-ice-tcp-punch-firewalls-directly/)
- Chrome (libwebrtc) выдаёт passive host TCP-кандидаты и не поддерживает S-O. Passive за NAT бесполезен [I, не сверено с исходниками Chromium].
- Итог: ICE-TCP полезен только в сторону сервера, то есть TURN/TCP или SFU. Задачу «без серверов» он не решает.

### 4. Ретрансляция через других пиров, libp2p circuit relay v2

- Circuit relay v2: клиент бронирует слот (`RESERVE`), релей может ограничить `duration` и `data`. Ограниченные релеи нужны, чтобы «seamlessly support pervasive hole punching». [V] [libp2p specs: circuit-v2](https://github.com/libp2p/specs/blob/master/relay/circuit-v2.md)
- В libp2p `/webrtc` между браузерами signaling идёт через relayed-соединение. Для адреса нужен STUN: «The only browser supported mechanism to discover ones public IP and port». TURN в спецификации не упоминается. [V] [libp2p specs: webrtc](https://github.com/libp2p/specs/blob/master/webrtc/webrtc.md)
- Браузер не может принимать входящие соединения, поэтому релей — это публичный узел (Node/Go), а не браузер другого пользователя [V, там же: «unable to listen for incoming connections»]. Чужой libp2p-релей по сути заменяет signaling-брокер, но не STUN.
- Своя схема, где третий пользователь пересылает медиа по своим data channel'ам, возможна. Но ретранслятор должен соединиться с обоими пирами, а значит, нужны те же STUN или IPv6 [I]. Кроме того, это трафик и батарея чужого человека, и в проекте нет пула таких пользователей.

### 5. WebTransport

- Спецификация описывает только обмен «between a browser and server» поверх HTTP/3 (unreliable, UDP) или HTTP/2 (reliable-only, TCP). [V] [W3C WebTransport, CR Snapshot 2026-07-30](https://www.w3.org/TR/webtransport/)
- Для P2P без сервера не подходит. Ранний P2P-эксперимент RTCQuicTransport в Chrome был свёрнут [I].

### 6. Медиа через data channel

- Можно кодировать видео через WebCodecs и слать по RTCDataChannel [I, общеизвестно, первоисточник не сверялся]. Пути через NAT это не меняет, потому что data channel идёт по тому же ICE. Имеет смысл только как транспорт для ретрансляции из п. 4. Цена — свой jitter buffer и контроль перегрузки, выше задержка.

### 7. Маскировка от DPI

- В браузере нельзя управлять DTLS- и STUN-отпечатками WebRTC, их задаёт libwebrtc или стек Firefox [I].
- РФ умеет блокировать WebRTC по отпечатку. 2021-12-01 Snowflake заблокировали у части провайдеров по DTLS: признаком было расширение `supported_groups` в DTLS Server Hello библиотеки Pion. [V] [Bocovich et al., USENIX Security 2024, §5.1](https://www.usenix.org/conference/usenixsecurity24/presentation/bocovich). С 2024-11 у Snowflake в РФ соединение устанавливается, а затем перестаёт передавать данные. Механизм неясен, и это «не простой DTLS-фингерпринтинг» [I, переписка Tor anti-censorship, вторичный пересказ](https://lists.torproject.org/mailman3/hyperkitty/list/anti-censorship-team@lists.torproject.org/message/E2PLZRIAFTHCZOMFYIRWYQ32RK67C465/attachment/2/attachment.html).
- Snowflake сознательно берёт пул **чужих публичных STUN**, потому что свои «a censor would experience no collateral harm in blocking them» [V, там же, §3]. Отсюда вывод для нас: популярный чужой STUN лучше своего [I].
- Браузерный WebRTC выглядит как Google Meet или звонок VK. Это защита за счёт сопутствующего ущерба, а не маскировка [I].
- С мая 2025 мобильный интернет в РФ регулярно отключают, оставляя белый список. С августа 2025 ограничены звонки в WhatsApp и Telegram [I, вторичные: [Global Voices 2025-10-07](https://globalvoices.org/2025/10/07/inside-net-russia-is-dismantling-free-internet-connections/), [The Insider](https://theins.press/en/news/284015)]. Технических замеров по STUN/TURN/WebRTC я не нашёл. Если включён белый список, P2P на произвольный IP, скорее всего, не пройдёт ни с какой маскировкой [I].

## Что это значит для #1

1. Сценарий «вообще без серверов» сводится к одной LAN или IPv6. Это хороший тест для поломки А: в одной Wi-Fi можно выставить `iceServers: []`, и звонок должен работать.
2. Для РФ без своей инфраструктуры реальный минимум такой: чужие публичные STUN (несколько, случайный выбор, как у Snowflake) плюс, если UDP режут, чужой TURN/TCP/TLS на 443. Своего TURN нет, поэтому за симметричным CGNAT связь не гарантирована [I].
3. Нужен замер у собеседника в РФ: какие кандидаты (host/srflx/IPv6) он получает в `chrome://webrtc-internals` с Google STUN и без него, проходит ли UDP, какой тип NAT.

## Источники

- RFC 8445 (ICE): https://www.rfc-editor.org/rfc/rfc8445.html
- RFC 6544 (ICE-TCP): https://www.rfc-editor.org/rfc/rfc6544.html
- draft-ietf-mmusic-mdns-ice-candidates-03: https://datatracker.ietf.org/doc/html/draft-ietf-mmusic-mdns-ice-candidates
- W3C WebTransport (CR 2026-07-30): https://www.w3.org/TR/webtransport/
- libp2p circuit relay v2: https://github.com/libp2p/specs/blob/master/relay/circuit-v2.md
- libp2p WebRTC (browser-to-browser): https://github.com/libp2p/specs/blob/master/webrtc/webrtc.md
- Mozilla, Active ICE TCP (2017): https://blog.mozilla.org/webrtc/active-ice-tcp-punch-firewalls-directly/
- Trystero README (rtcConfig/turnConfig, TURN только серверный): https://github.com/dmotz/trystero
- Snowflake, USENIX Security 2024: https://www.usenix.org/conference/usenixsecurity24/presentation/bocovich
