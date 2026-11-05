# Звонок одним тапом на Android-планшете

Вопрос: [#45](https://github.com/heaviss/call-ma/issues/45), карта
[#38](https://github.com/heaviss/call-ma/issues/38). Дата исследования — 2026-11-05.
На реальном планшете автор ничего не проверял: выводы опираются на документацию Chrome,
MDN, исходники Chromium и Jitsi, обсуждения W3C и один сетевой замер из-за пределов РФ.

Метки: **[проверено]** — первоисточник или замер; **[вывод]** — следствие из источников, прямой
проверки нет; **[неизвестно]** — данных не нашлось.

## Коротко

| Возможность                                | Что даёт платформа                                                                   | Ограничение для бабушки                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Иконка на рабочем столе                    | Chrome собирает WebAPK, ссылки из мессенджера открывают приложение                   | Только Chrome с Google Play-сервисами; Яндекс Браузер и прочие кладут простой ярлык     |
| Постоянное разрешение на камеру и микрофон | «Allow while visiting the site» сохраняется между визитами                           | Safety Check снимает разрешения сайта, который не открывали ~60 дней                    |
| Автозапуск звонка                          | `getUserMedia` не требует жеста пользователя, автозвук разрешён установленному сайту | Работает, только если разрешение уже выдано                                             |
| Полный экран                               | `"display": "fullscreen"` в манифесте                                                | `requestFullscreen()` из кода требует тапа                                              |
| Экран не гаснет                            | Screen Wake Lock, Baseline 2025                                                      | Только пока страница видима; снимается при экономии батареи                             |
| Входящий звонок через Web Push             | Push-сервис держит производитель браузера, на Android это FCM                        | Нужен свой отправитель: FCM не пускает запросы из браузера (CORS). FCM в РФ под угрозой |

Главное:

1. Один тап реален только как «иконка → сразу звонок» для **постоянной комнаты пары**. Один
   раз помощник ставит PWA через Chrome и выдаёт разрешение на камеру и микрофон. Дальше
   приложение при запуске само вызывает `getUserMedia` и входит в комнату без диалогов.
2. Web Push без своего сервера на Chrome/Android не работает: страница не может отправить
   запрос в FCM. Своя инфраструктура запрещена, значит push отпадает целиком.
3. Без push бабушка узнаёт о звонке двумя путями: договорённость о времени (звонок в
   мессенджере или по телефону «открой иконку») или режим «всегда на связи». Во втором
   планшет стоит на зарядке, PWA открыто на весь экран, держит wake lock и слушает комнату.
   Так работают Konnekt Videophone, GrandPad и Echo Show Drop In: устройство отвечает само.
4. Разрешения протухают. Если бабушка не открывает приложение два месяца, Chrome отзывает
   камеру и микрофон, и первый тап упрётся в диалог. Режим «всегда на связи» этот риск
   снимает, потому что сайт открыт постоянно.

## 1. Установка PWA и иконка на рабочем столе

- На Android Chrome собирает из PWA настоящий APK — WebAPK. Сервер Google подписывает пакет,
  Chrome ставит его без sideload. Так делают Chrome на устройствах с Google Mobile Services и
  Samsung Internet только на устройствах Samsung. Firefox, Edge, Opera, Brave создают
  обычный ярлык. **[проверено]** [web.dev: Installation](https://web.dev/learn/pwa/installation)
- Chrome тоже откатывается на ярлык, если сервер сборки недоступен или PWA не проходит
  критерии установки. **[проверено]** там же. В РФ сервер сборки WebAPK стоит на
  инфраструктуре Google; его доступность из РФ не проверена. **[неизвестно]**
- WebAPK регистрирует intent-фильтры на URL внутри `scope`: ссылка из мессенджера откроет
  приложение, а не вкладку. **[проверено]** [web.dev: WebAPKs](https://web.dev/articles/webapks)
  Простой ярлык так не умеет. **[вывод]**
- На российских планшетах браузером по умолчанию часто стоит Яндекс Браузер. Он в списке
  выше не назван; по общему правилу он даст ярлык, а не WebAPK. **[вывод]** Ставить PWA
  нужно из Chrome.
- `shortcuts` в манифесте дают пункты по долгому нажатию на иконку. Поддержка ограничена.
  Бабушке долгое нажатие не подходит. **[проверено]**
  [MDN: shortcuts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts)

Как зашить комнату в иконку. Манифест на GitHub Pages статичен, поэтому `start_url` не может
нести ID комнаты конкретной пары. Выход: бабушка один раз открывает ссылку с комнатой,
приложение сохраняет ID в `localStorage`, а установленное PWA при старте читает его оттуда.
WebAPK работает внутри Chrome, поэтому хранилище у вкладки и у приложения общее. **[вывод]**

## 2. Постоянное разрешение на камеру и микрофон

- В Chrome на Android диалог предлагает «Allow while visiting the site» (текущий и будущие
  визиты) и «Allow this time» (только этот визит). **[проверено]**
  [Chrome Help: site settings, Android](https://support.google.com/chrome/answer/114662?hl=en&co=GENIE.Platform%3DAndroid)
  Помощник при настройке должен выбрать первый вариант.
- MDN: браузер обязан спросить хотя бы в первый раз, постоянное разрешение пользователь даёт
  явно. **[проверено]**
  [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- Safety Check в Chrome на Android работает в фоне и отзывает разрешения у сайтов, которые
  давно не посещали; Google прямо называет микрофон и геолокацию. **[проверено]**
  [Google, декабрь 2023](https://blog.google/products-and-platforms/products/chrome/google-chrome-december-2023-update/),
  [Google, сентябрь 2024](https://blog.google/products-and-platforms/products/chrome/google-chrome-safety-update-september-2024/)
- Порог — 60 дней с последнего визита. Если пользователь нажал «Allow again», сервис больше
  не отзывает разрешения этого сайта. **[проверено]**
  [Chromium: `unused_site_permissions_manager.h`](https://chromium.googlesource.com/chromium/src.git/+/lkgr-android-internal/chrome/browser/ui/safety_hub/unused_site_permissions_manager.h)
- Исключение для установленных PWA Google обещает только для автоотзыва уведомлений.
  **[проверено]** [Chromium Blog, октябрь 2025](https://blog.chromium.org/2025/10/automatic-notification-permission.html)
  Для камеры и микрофона такого исключения в источниках нет. **[неизвестно]**

## 3. Автозапуск звонка при открытии

- `getUserMedia` требует разрешения, но не жеста пользователя: MDN перечисляет условия
  (защищённый контекст, верхний документ, Permissions Policy, разрешение), жеста среди них
  нет. **[проверено]** [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
  Значит, при выданном разрешении приложение может сразу взять камеру и войти в комнату.
  **[вывод]**
- Chrome разрешает автовоспроизведение со звуком, если пользователь тапал по сайту или на
  мобильном добавил сайт на домашний экран. Установленное PWA проходит второе условие, и
  голос собеседника зазвучит без тапа. **[проверено]**
  [Chrome: Autoplay policy](https://developer.chrome.com/blog/autoplay)
- Аналоги. Jitsi показывает экран перед входом (`prejoinConfig.enabled`), его выключают в
  конфиге или в URL-хеше `#config.…`; на мобильном Jitsi уводит в нативное приложение, это
  выключает `deeplinking.disabled`. **[проверено]**
  [Jitsi `config.js`](https://raw.githubusercontent.com/jitsi/jitsi-meet/master/config.js),
  [Jitsi handbook](https://jitsi.github.io/handbook/docs/user-guide/user-guide-advanced/)
  Whereby параметром `skipMediaPermissionPrompt` пропускает свой экран и сразу вызывает
  системный диалог. **[проверено]**
  [Whereby: URL params](https://docs.whereby.com/whereby-101/customizing-rooms/using-url-parameters)
  Google Meet ставит PWA только на десктопе, на Android ведёт в нативное приложение.
  **[проверено]** [Meet Help](https://support.google.com/meet/answer/10708569?hl=en-GB)
  Все три сервиса требуют хотя бы одного нажатия «Войти». Бабушке нужен вход без него.

## 4. Полный экран

- `requestFullscreen()` требует временной активации пользователя, то есть тапа. **[проверено]**
  [MDN: requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
- Установленное PWA с `"display": "fullscreen"` в манифесте открывается без панелей браузера,
  кода для этого не нужно. **[вывод]** из спецификации манифеста; на реальном планшете не
  проверено.

## 5. Экран не гаснет

- Screen Wake Lock — Baseline 2025, только HTTPS. Блокировку получает только видимый
  документ. Система снимает её при скрытии страницы, низком заряде или режиме экономии.
  После возврата блокировку надо запросить заново на `visibilitychange`. **[проверено]**
  [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- Скрытую страницу браузер может заморозить или выгрузить без событий. **[проверено]**
  [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
  Поэтому «слушать комнату в фоне» нельзя: PWA должно оставаться на экране. **[вывод]**

## 6. Web Push для входящего звонка

- Push-сервис держит производитель браузера; сайт не выбирает его. Нужен свой сервер: он
  хранит подписки и отправляет запросы протокола Web Push, подписанные ключами VAPID.
  **[проверено]** [web.dev: Push notifications overview](https://web.dev/articles/push-notifications-overview),
  [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- Без сервера отправителем мог бы стать браузер звонящего: подписку бабушки он получает по
  P2P, ключ VAPID генерирует сам. Мешает CORS. Mozilla отключила CORS на autopush в 2022 году
  намеренно; issue в W3C открыт с 2018 года и не решён. **[проверено]**
  [w3c/push-api#303](https://github.com/w3c/push-api/issues/303),
  [Pushpad, 2022](https://pushpad.xyz/blog/p2p-notifications-cors-is-removed-from-all-major-push-services)
- Замер 2026-11-05: preflight `OPTIONS` с чужим `Origin` на `fcm.googleapis.com/fcm/send/…` и
  `fcm.googleapis.com/wp/…` возвращает 400 без `Access-Control-Allow-Origin`. Значит, Chrome на
  Android (его подписки живут на FCM) push из браузера не примет. Autopush Mozilla сейчас
  отвечает на preflight 200 с `Access-Control-Allow-Origin`, но бабушка сидит в Chrome, а
  Firefox на Android сам доставляет push через FCM. **[проверено]** для preflight,
  **[неизвестно]** для полной отправки.
- Periodic Background Sync не заменяет push: время синхронизации выбирает браузер, пример в
  документации — раз в сутки. **[проверено]**
  [Chrome: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)

### Доступность FCM из РФ

- На Android почти все приложения, включая MAX, получают push через FCM; RuStore его не
  заменяет. В марте 2026 push MAX не доходили в Белгороде при включённых белых списках.
  Депутат Горелкин: планов блокировать Google нет. **[проверено]** по СМИ
  [Новая газета Европа, 2026-03-28](https://novayagazeta.eu/articles/2026/03/28/push-ne-proidet)
- В июне 2026 года Telegram без VPN перестал доставлять push россиянам; СМИ связывают это с
  блокировкой подсетей Google. Официального подтверждения нет. **[вывод]**
  [Anti-Malware, 2026-06-19](https://www.anti-malware.ru/news/2026-06-19-111332/50420)
- Итог: FCM в РФ пока в целом работает, но в белых списках и при точечных блокировках
  ломается. Даже со своим сервером push на него не опереть. **[вывод]**

## 7. Как это решают устройства для пожилых

- Konnekt Videophone автоматически отвечает доверенным контактам, примерно через 50 секунд.
- GrandPad в режиме автоответа принимает звонок от одобренных контактов без нажатия.
- Echo Show Drop In: звонок от одобренного контакта начинается сам.

Все трое держат устройство постоянно включённым и снимают с пожилого человека даже тап
«Ответить». **[проверено]** по сайтам производителей
[Konnekt](https://www.konnekt.com.au/?p=1739),
[NHS Highland: simple video calling devices](https://www.nhshighland.scot.nhs.uk/your-services/all-services-a-z/technology-enabled-care-tec/guide-to-simple-video-calling-devices/)

## Что это значит для #38

- Первичную настройку делает помощник один раз: Chrome → ссылка с комнатой → установить PWA →
  «Allow while visiting the site» для камеры и микрофона.
- Сценарий «бабушка звонит»: тап по иконке, приложение само берёт камеру и входит в
  постоянную комнату. Ни одного диалога, пока разрешение не отозвано.
- Сценарий «звонят бабушке» без своего сервера: режим «всегда на связи» по образцу Konnekt —
  планшет на зарядке, PWA на весь экран, wake lock, автоответ доверенному собеседнику.
  Альтернатива — договориться голосом и попросить нажать иконку.
- Открытые вопросы для прототипа: держит ли Chrome на реальном планшете WebRTC и wake lock
  часами, отзывает ли Safety Check разрешения у установленного WebAPK, доступен ли сервер
  сборки WebAPK из РФ.
