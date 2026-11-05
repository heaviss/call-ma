# Как в РФ блокируют WebRTC в 2026

Тикет: [#41](https://github.com/heaviss/call-ma/issues/41), карта [#37](https://github.com/heaviss/call-ma/issues/37). Дата: 2026-11-05.

Опирается на [#3](https://github.com/heaviss/call-ma/issues/3) (Google STUN заблокирован, OONI, заморозка после ~16 КБ, мобильные белые списки), [#4](https://github.com/heaviss/call-ma/issues/4) (без STUN/TURN через NAT нельзя), [#6](https://github.com/heaviss/call-ma/issues/6) (приёмы обхода DPI из браузера невоспроизводимы) и [#7](https://github.com/heaviss/call-ma/issues/7). Здесь — только новое.

## Короткий ответ

1. **WebRTC как протокол в РФ не запрещён.** На WebRTC работают звонки государственного Max. Блокируют не протокол, а конкретные сервисы, адреса и отпечатки.
2. **STUN режут по адресу назначения.** Запросы к публичным STUN (Google, Bethesda) блокируются с середины лета 2025, а STUN между двумя пирами проходит. Единственный найденный доступным сервер — `stun.rtc.yandex.net`.
3. **DTLS режут по отпечатку ClientHello.** С 2026-03-30 ТСПУ отбрасывал DTLS 1.2 со статическим отпечатком Pion (Snowflake). Затем заблокировали отпечаток, совпадающий с DTLS 1.2 Firefox. DTLS 1.2 Chrome и DTLS 1.3 не трогали. К сентябрю 2026 блокировка Snowflake ослабла.
4. **Звонки мессенджеров режут адресно.** Звонки WhatsApp и Telegram ограничены с 2025-08-11. Механизм, по неофициальным разборам, — сигнатура STUN-пакетов приложения и, вероятно, адреса relay-серверов. FaceTime заблокирован 2025-12-04, WhatsApp целиком — 2026-02-12, Telegram замедляют с 2026-02-10.
5. **Наш p2p WebRTC от них отличается.** Медиа идёт напрямую между абонентами, без адресов из чёрного списка, а STUN-пакеты такие же, как у любого браузера. Уязвимы три точки: публичный STUN, отпечаток DTLS Firefox и зарубежный TURN.
6. **Сплошной фильтрации UDP вне белых списков нет.** QUIC режут по SNI на любых UDP-портах (FOCI 2026), а не целиком. Полный запрет UDP описан только в режиме мобильного белого списка.
7. **Отдельного «замедления WebRTC» в источниках нет.** Есть заморозка соединений после ~16 КБ к зарубежным хостингам (#3, #6) и замедление отдельных сервисов.

## 1. STUN: блокировка по адресам публичных серверов

Отчёт из РФ в net4people, 2025-09-21 ([net4people/bbs#422, комментарий](https://github.com/net4people/bbs/issues/422#issuecomment-3316062302)):

> "I've noticed that stun protocol was blocked from mid-summer till today (it worked in June last time when I've used public stun to punch through NAT). Seems that only stun to public stun servers like `stun.l.google.com`, `stun.bethesda.net` were affected. Stun between webtunnel client and other webtunnel peer is not affected [...]. The only stun server that was accessible all that time was `stun.rtc.yandex.net`"

Tor anti-censorship team включила этот отчёт в заметки встречи 2025-10-02 ([forum.torproject.org](https://forum.torproject.org/t/tor-project-anti-censorship-team-meeting-notes-2025-10-02/20636)).

Выводы:

- Отчёт совпадает с данными OONI из #3: Google STUN не отвечает. Новое здесь то, что фильтр смотрит на **адрес назначения**: STUN-обмен между двумя пирами (connectivity checks ICE) проходит.
- Кандидат для замера — **`stun:stun.rtc.yandex.net:3478`**. Яндекс — российский сервис и, вероятно, попадает в мобильный белый список. Это предположение, а не замер, и основано оно на наблюдении одного человека летом 2025.
- Рабочие по OONI из #3 (nextcloud, sonetel, telnyx, epygi) остаются кандидатами. Список блокируемых адресов растёт, поэтому серверов STUN нужно несколько.

## 2. DTLS: блокировка по отпечатку ClientHello

Issue [net4people/bbs#603](https://github.com/net4people/bbs/issues/603) «Snowflake-targeted DTLS filtering in Russia, starting 2026-03-30». Snowflake построен на WebRTC (Pion), поэтому это ближайший к нам прецедент. В 2021-12 РФ уже блокировала Snowflake по DTLS (см. #4).

- 2026-04-07, cohosh (Tor): "The JA4 fingerprint matches the default pion/dtls handshake". Соединения с прокси на Pion не проходили, с браузерными и с covert-dtls — проходили.
- 2026-04-16, theodorsm: "the only handshake that was not blocked was from a webextension proxy as it had a DTLS 1.3 ClientHello, not DTLS 1.2 as supported by pion/snowflake currently."
- 2026-05-14, theodorsm: "the new CH fingerprint you discovered is exactly like DTLS 1.2 from Firefox (or mimicked by covert-dtls). They are either accepting the collateral damage, or they have some other way of fingerprint the connection beyond static CH fingerprints. I also see DTLS 1.2 CH from Chrome (or covert-dtls) not being blocked."
- 2026-09-24, kad09: "tor snowflake is fully working again [...] I noticed on one of the peers the old pion ja3 I've reported initially, and connection with that proxy succeded". Фильтр по отпечатку сняли или сделали выборочным.
- Механика: заблокированный ClientHello остаётся без ответа, пакеты отбрасываются молча. ClientHello шлёт сторона с ролью `active` по SDP (RFC 5763), в WebRTC это обычно отвечающая сторона.

Выводы для нас:

- Отпечаток DTLS браузера изменить нельзя (#4). Риск — DTLS 1.2 Firefox, если его снова внесут в список. Chrome в данных #603 не блокировался.
- Неизвестно, применяли блокировку ко всем UDP-потокам или только к похожим на Snowflake (адреса прокси, брокер). Прямых замеров браузерного звонка Firefox↔Firefox из РФ нет.
- В диагностике стоит логировать браузеры обеих сторон и `RTCDtlsTransport.state`, чтобы отличить блокировку DTLS от провала ICE.

## 3. Звонки WhatsApp, Telegram, FaceTime

| Сервис | Что и когда | Источник |
| --- | --- | --- |
| WhatsApp, Telegram | Звонки «частично ограничены» с 2025-08-11, РКН подтвердил 2025-08-13. К октябрю на юге ограничены полностью | [The Moscow Times](https://www.themoscowtimes.com/2025/08/13/roskomnadzor-says-it-is-restricting-whatsapp-telegram-calls-a90198), [Медиазона](https://en.zona.media/article/2026/04/07/russian_internet_censorship_2026) |
| Google Meet | Сбои с 2025-08-22 при отсутствии глобального сбоя у Google. РКН отрицает ограничения | [Медуза](https://meduza.io/news/2025/08/22/polzovateli-pozhalovalis-na-sboi-v-rabote-google-meet-v-rossii-servis-nabral-populyarnost-posle-blokirovki-zvonkov-v-telegram-i-whatsapp) |
| FaceTime | Сбои с 2025-09, РКН подтвердил блокировку 2025-12-04 | [Медиазона](https://zona.media/news/2025/12/04/facetime) |
| WhatsApp целиком | Замедление с 2025-11-28. Домены удалены из НСДИ, Кремль подтвердил блокировку 2026-02-12 | [The Moscow Times](https://www.themoscowtimes.com/2026/02/12/whatsapp-accuses-russian-government-of-trying-to-fully-block-platform-a91928) |
| Telegram | Замедление по всей стране с 2026-02-10. Полная блокировка официально не объявлена | [Медиазона](https://en.zona.media/article/2026/04/07/russian_internet_censorship_2026) |

Как режут технически (официальных деталей нет):

- Habr, 2025-11-29 ([habr.com/ru/articles/971480](https://habr.com/ru/articles/971480/)): «Фильтр настроен не на IP-адреса, а на сигнатуры протокола». DPI отбрасывает STUN-пакеты WhatsApp, поэтому «хендшейк не проходит, медиапоток (RTP) не поднимается». Обход — zapret с фейковым пакетом перед STUN (фильтр по Magic Cookie `0x2112A442`). Это мнение автора без измерений.
- Участники ntc.party в теме [«Блокировка Telegram и Whatsapp звонков»](https://ntc.party/t/18333) пишут, что Force TCP в Telegram помогает, и предполагают бан по IP relay-серверов. Это гипотезы.
- Вывод Habr расходится с net4people#422, где P2P STUN проходит. Их примиряет гипотеза, что фильтр сочетает адрес назначения (серверы Meta, Telegram, публичные STUN) и сигнатуру пакета.

Чем это отличается от нашего p2p WebRTC:

- Мессенджеры почти всегда соединяются через свои серверы (relay, reflector) с известными IP и AS. Для блокировки по адресу это готовая цель.
- У нас медиа идёт напрямую между двумя абонентскими IP: адреса меняются, общего AS нет. STUN-пакеты стандартные, как у любого браузерного WebRTC (Max, Телемост, Jitsi, видеозвонки банков). Блокировка по такой сигнатуре задела бы и отечественные сервисы.
- Слабые места у нас те же, что у мессенджеров: публичный STUN и TURN с известными адресами. Зарубежный TURN попадает и под блокировку по адресу, и под заморозку после ~16 КБ (#3).

## 4. UDP, замедление и белые списки

- **QUIC.** Статья FOCI 2026, Paderborn ([On Russia's Early Introduction of QUIC SNI Censorship](https://www.petsymposium.org/foci/2026/foci-2026-0010.php)): сплошную блокировку зарубежного QUIC 2022 года заменили фильтрацией по SNI. Пакеты отбрасываются на любых UDP-портах, затронут только QUIC v1. Значит, ТСПУ разбирает полезную нагрузку UDP на произвольных портах, не только на 443.
- **Заморозка ~16 КБ / ~25 пакетов на поток** к зарубежным хостингам (#3, #6) по данным net4people#490 действует и для UDP. TURN у Hetzner, OVH, DO или Cloudflare оборвёт звонок за секунды.
- **Мобильные белые списки** (#3). «Реестр социально значимых сервисов» существует с сентября 2025 (57 сайтов). Отключения мобильного интернета дошли до Москвы: в марте 2026 — почти три недели ([Медиазона](https://en.zona.media/article/2026/04/07/russian_internet_censorship_2026)). В этом режиме ничего зарубежного не проходит. Проходит ли P2P между абонентами, неизвестно.
- **Блокировка подсетей.** О блокировке целых AS и /24 хостеров в мае 2026 пишут только блоги VPN-сервисов (например, [fiery.host](https://dostup.fiery.host/en/blog/isp-throttling-vpn-russia-2026)). Независимого подтверждения нет.
- **Шейпинга медиапотока** по признаку SRTP ни OONI, ни net4people, ни FOCI не описывают.

## Что из этого следует для call-ma

1. Добавить `stun:stun.rtc.yandex.net:3478` в список ICE для замера у собеседника вместе с кандидатами из #3 и #7.
2. Зарубежный TURN на хостинге из списка (#3) в РФ почти бесполезен: известный адрес и заморозка после 16 КБ. Если брать чужой публичный TURN, то на AWS или в российской сети.
3. Замерять у собеседника в двух браузерах: Firefox (риск отпечатка DTLS 1.2) и Chrome.
4. В UX ошибок различать «ICE не нашёл пару» (STUN или UDP) и «ICE соединился, DTLS не поднялся» (отпечаток DTLS).

## Пробелы

- Замеров именно браузерного p2p WebRTC из РФ в 2026 нет. Все выводы перенесены со Snowflake и мессенджеров.
- Доступность `stun.rtc.yandex.net` подтвердил один человек у одного провайдера в 2025.
- ntc.party не открывался из среды исследования, его посты цитируются по поисковой выдаче.
