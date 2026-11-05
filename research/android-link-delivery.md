# Как доставить ссылку на звонок на Android-планшет в РФ

Вопрос: [#44](https://github.com/heaviss/call-ma/issues/44), карта [#38](https://github.com/heaviss/call-ma/issues/38).
Дата исследования: 2026-11-05. На реальном планшете в РФ ничего не проверялось. Поведение
Telegram подтверждено по исходному коду клиента, остальные мессенджеры описаны по документации и
косвенным данным.

Метки: **[проверено]** — первоисточник (документация, исходный код, официальный API);
**[вывод]** — следствие, прямой проверки нет; **[неизвестно]** — данных не нашлось.

## Коротко

| Канал    | Доходит ли сообщение в РФ                                                        | Где откроется ссылка                                             | Камера и микрофон                                                     |
| -------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Telegram | замедлен с 10.02.2026, но работает **[проверено, СМИ]**                          | встроенный браузер на WebView, по умолчанию **[проверено, код]** | работают после двух диалогов: Telegram и Android **[проверено, код]** |
| WhatsApp | ограничивается, РКН объявил о «последовательной» блокировке **[проверено, СМИ]** | браузер по умолчанию, то есть Chrome **[вывод]**                 | как в Chrome **[вывод]**                                              |
| MAX      | предустановлен, входит в белые списки **[проверено, СМИ]**                       | **[неизвестно]**                                                 | **[неизвестно]**, нужно проверить на планшете                         |
| VK       | работает, входит в белые списки **[проверено, СМИ]**                             | встроенный браузер, отключается в настройках **[вывод, форумы]** | **[неизвестно]**                                                      |
| SMS      | работает                                                                         | Chrome **[вывод]**                                               | как в Chrome                                                          |
| E-mail   | работает                                                                         | Chrome или WebView почтового клиента **[вывод]**                 | зависит от клиента                                                    |

Главное:

1. Канал для бабушки — MAX: он предустановлен на все устройства, проданные после 01.09.2025, и
   доступен даже в режиме белых списков. Как MAX открывает ссылки, не известно: проверить на
   планшете первым делом.
2. Встроенный браузер на WebView сам по себе не убивает звонок: WebRTC в WebView есть, а
   `getUserMedia` работает, если приложение переопределило `onPermissionRequest`. Без этого
   Android отказывает молча. Telegram это сделал, но показывает свой диалог поверх системного, то
   есть лишний шаг для бабушки.
3. Hash в ссылке не теряется: фрагмент не уходит на сервер при загрузке превью, а символы
   base64url (`A–Z a–z 0–9 - _`) не ломают автоссылки. Ссылка Direct mode (оценочно 1,5–4 тыс.
   символов) влезает в лимит сообщения Telegram (4096), MAX (4000) и WhatsApp, но не в одно SMS.
4. Вывод для карты: сценарий «ссылка в мессенджере → встроенный браузер» хрупок. Надёжнее
   один раз установить приложение как PWA или ярлык на постоянную комнату (#38, «Первичная
   настройка»), чтобы ссылка из мессенджера служила только напоминанием.

## 1. Какие каналы доходят в РФ в 2026

**WhatsApp.** Роскомнадзор в 2025 ограничил звонки, в январе 2026 депутаты анонсировали полную
блокировку до конца года ([The Moscow Times](https://ru.themoscowtimes.com/2026/01/15/vgosdume-anonsirovali-polnuyu-blokirovku-whatsapp-dokontsa-goda-a184602)),
в июле 2026 РКН подтвердил, что блокировка вводится «последовательно»
([Kod.ru](https://kod.ru/rkn-ban-whatsapp-posledovatelno)). По Mediascope, к августу 2026
суточная аудитория WhatsApp упала на 24 % до 22,6 млн
([MenToday, 20.10.2026](https://www.mentoday.ru/life/news/20-10-2026/byudjetnye-milliardy-v-pesok-zablokirovannye-whatsapp-i-telegram-snova-nachali-rasti-v-rossii/)).
**[проверено, СМИ]** Как основной канал для бабушки WhatsApp не годится.

**Telegram.** РКН официально начал замедлять Telegram 10.02.2026
([Meduza](https://meduza.io/news/2026/02/10/rbk-roskomnadzor-nachinaet-zamedlyat-telegram),
[Новая газета Европа](https://novayagazeta.eu/articles/2026/02/10/rbk-roskomnadzor-nachal-zamedliat-telegram-v-rossii-news)).
Слухи о полной блокировке с 1 апреля РКН не подтвердил ([comss.ru](https://www.comss.ru/page.php?id=19617)).
Суточная аудитория к августу 2026 — 33,8 млн, минус 33 % к апрелю (MenToday, там же).
**[проверено, СМИ]** Короткий текст со ссылкой при замедлении доходит; на блокировку в
будущем полагаться нельзя.

**MAX.** Распоряжение Правительства от 19.08.2025 № 2240-р с 01.09.2025 обязывает
предустанавливать MAX на смартфоны и планшеты, продаваемые в РФ
([ppt.ru](https://ppt.ru/obzory/vstupaet-v-silu/rasporyazhenie-pravitelstva-rf-19-08-2025-2240-r),
[Медиазона](https://zona.media/news/2025/08/21/max-maxing)). MAX и VK входят в белые списки,
которые действуют при отключениях мобильного интернета
([comss.ru о данных Vigo](https://www.comss.ru/page.php?id=21504),
[Amnezia](https://amnezia.org/ru/blog/internet-white-lists-russia-what-they-are-and-how-to-live-with-them)).
**[проверено, СМИ]** Планшет, купленный до сентября 2025, может быть без MAX: ставить вручную при
первичной настройке.

**Важное ограничение.** В режиме белого списка сообщение в MAX дойдёт, но страница call-ma на
GitHub Pages не откроется: `github.io` в белых списках нет **[вывод]**, а Transports Trystero там
тоже недоступны (см. `research/ru-signaling-channels.md` на ветке `research/ru-signaling-channels`).
По Vigo, в июле 2026 в ЦФО около 70 % мобильных сессий шли в режиме белых списков (comss.ru, там
же). Планшет бабушки должен звонить по домашнему Wi-Fi.

**SMS и e-mail** доходят всегда, но на планшете часто нет SIM, а почту пожилой человек открывает
редко **[вывод]**.

## 2. Где откроется ссылка

**Telegram** **[проверено, код]**. В `Browser.openUrl` клиента Android ссылка `http(s)`
открывается во встроенном браузере, если `MessagesController.isWebBrowserOpenInApp(url)`
([Browser.java](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/messenger/browser/Browser.java)).
Значение берётся из серверных настроек `webBrowserSettings.open_external_browser` с
исключениями по доменам ([MessagesController.java](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/messenger/MessagesController.java)).
Пользователь может выключить встроенный браузер в настройках или добавить домен в исключения
«открывать во внешнем браузере». Встроенный браузер построен на WebView
(`org.telegram.ui.web.BotWebViewContainer`), не на Custom Tabs.

**WhatsApp**: своего браузера на Android нет, ссылка уходит в браузер по умолчанию **[вывод]**:
первоисточника не нашлось, только сторонние инструкции.

**VK**: открывает ссылки во встроенном браузере, отключается в «Настройки → Основные →
Встроенный браузер» ([Habr Q&A](https://qna.habr.com/q/454686), ответ старый) **[вывод]**.

**MAX** **[неизвестно]**. Разбор APK показывает, что у MAX есть разрешения `CAMERA` и
`RECORD_AUDIO`, а звонки построены на WebRTC ([Habr](https://habr.com/ru/articles/938518/)). Но
открывает ли MAX внешние ссылки в WebView и пропускает ли туда камеру, не известно.

**Custom Tabs против WebView** **[проверено]**. Custom Tabs — это вкладка браузера
пользователя (обычно Chrome): «Any API or web platform feature is available there, and will be
available in your Custom Tab», «Shared cookie jar and permissions model»
([Chrome for Developers](https://developer.chrome.com/docs/android/custom-tabs)). Значит, разрешение
на камеру, выданное сайту в Chrome, работает и в Custom Tab. WebView — отдельный движок со своим
хранилищем; разрешения в нём выдаёт приложение-хозяин.

## 3. Работают ли getUserMedia и WebRTC во встроенном браузере

- Media Capture and Streams (`getUserMedia`) поддерживается в WebView с версии 55
  ([Chrome for Developers, WebView](https://developer.chrome.com/docs/multidevice/webview/)).
  **[проверено]**
- Камеру и микрофон WebView отдаёт, только если приложение переопределило
  `WebChromeClient.onPermissionRequest`: «If this method isn't overridden, the permission is
  denied» ([Android API](<https://developer.android.com/reference/android/webkit/WebChromeClient#onPermissionRequest(android.webkit.PermissionRequest)>)).
  Нужны ещё `CAMERA` и `RECORD_AUDIO` в манифесте приложения
  ([пример Google](https://github.com/googlesamples/android-PermissionRequest)). **[проверено]**
- Telegram это переопределил: на запрос камеры и микрофона показывает свой диалог «сайт
  `<домен>` просит доступ к камере и микрофону», затем системный запрос Android, затем
  `request.grant(...)` ([BotWebViewContainer.java, `onPermissionRequest`](https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/ui/web/BotWebViewContainer.java)).
  Системный запрос появляется один раз, а диалог Telegram, похоже, при каждом звонке: WebView не
  хранит решение, а код не запоминает его для домена **[вывод]**.
- `RTCPeerConnection` в WebView есть: это тот же Chromium **[вывод]**. Отдельной строки о WebRTC
  в документации WebView нет.
- Для приложений, которые `onPermissionRequest` не переопределили, звонок упадёт с
  `NotAllowedError` без всякого диалога **[проверено, документация Android]**. Call-ma должен
  распознать это и показать «Откройте в Chrome».

## 4. Режут ли мессенджеры hash и длинные ссылки Direct mode

**Hash.** Фрагмент URI обрабатывает только клиент и не уходит на сервер
([RFC 3986, §3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5)). Бот превью запросит
`https://…/call-ma/` без `#roomid`, и превью покажет общую страницу. Сам текст сообщения с
hash сервер мессенджера видит: в Telegram (обычные чаты), MAX и VK переписка не сквозная, так
что ID комнаты известен оператору мессенджера **[вывод]**.

**Символы.** Room ID — `[a-z0-9]{8}`, Direct-ссылка — `#offer=<base64url>`
(`src/shared/link.ts`, `src/shared/sdp.ts`). Автоссылки обычно отрезают с конца только
пунктуацию вроде `.`, `,`, `)`; символы base64url `-` и `_` остаются в ссылке **[вывод]**. Риск:
если base64url кончается на `-` или `_`, отдельный линкификатор может его отрезать. Проверить на
MAX и VK.

**Длина.** Direct-ссылка — SDP с ICE-кандидатами, сжатый `deflate-raw` и закодированный
base64url. Оценочно 1,5–4 тыс. символов; замера не делалось **[вывод]**. Лимиты сообщения:

- Telegram — 4096 символов: «Text of the message to be sent, 1-4096 characters after entities
  parsing» ([Bot API](https://core.telegram.org/bots/api#sendmessage)) **[проверено]**;
- MAX — 4000 символов: «до `4000` символов» ([API MAX](https://dev.max.ru/docs-api/methods/POST/messages)) **[проверено]**;
- VK, WhatsApp — первоисточник не нашёлся **[неизвестно]**;
- SMS — 153 символа на сегмент в склеенном сообщении; ссылка в 2 тыс. символов — около 14
  сегментов, телефон может отправить её как MMS **[вывод]**.

Длинную Direct-ссылку в Telegram и MAX можно отправить, но запас мал: у большого SDP лимит
кончится. Бабушке Direct mode не подходит и по другой причине: он требует, чтобы она отправила
ответную ссылку обратно.

## Что проверить на планшете

1. MAX: открывается ли ссылка во встроенном браузере, просит ли страница камеру, проходит ли
   звонок. Не обрезается ли Direct-ссылка в 3–4 тыс. символов.
2. VK: то же.
3. Telegram: сколько диалогов видит бабушка на втором звонке.
4. Замерить реальную длину `#offer=` и `#answer=` ссылок на планшете.
5. Можно ли из встроенного браузера уйти в Chrome ссылкой `intent://…;package=com.android.chrome;end`
   (в `Browser.java` Telegram обрабатывает схему `intent`) **[неизвестно]**.
