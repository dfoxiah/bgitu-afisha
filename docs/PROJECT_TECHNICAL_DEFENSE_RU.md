# Полная техническая защита проекта `bgitu-afisha` (формат плана)

> Статус ревизии: `lint` ✅, `type-check` ✅, `build` ✅, `smoke` ✅  
> Принцип: глубокий рефакторинг внутренней архитектуры без изменения публичных маршрутов.

## Быстрая навигация
1. Краткое резюме и рамки проекта.
2. Плюсы стека (таблица).
3. Целевая архитектура и статус выполнения плана.
4. Публичные интерфейсы, тесты и артефакты.
5. Подробная техническая часть (полная карта системы и модулей).

## Краткое резюме
Проект `bgitu-afisha` переведён на слоистую модель: route handlers стали тоньше, ключевая доменная логика вынесена в `src/server/**`, клиентские вызовы — в `src/features/**`, контракты — в `src/types/**`.  
Это повысило поддерживаемость, сократило дублирование и упростило безопасные изменения перед релизом.

## Зафиксированные рамки
1. Generated-артефакты (`.next`, `*.tsbuildinfo`) вручную не редактируются.
2. Исторические миграции Prisma не переписываются.
3. Внешние URL-маршруты и ключевые пользовательские сценарии сохранены.
4. Вложенный репозиторий `bgitu-afisha/bgitu-afisha` не входит в рабочий scope.
5. Все TS/TSX-файлы `src/**` получили системные file-header комментарии.

## Технологический стек и плюсы каждого элемента
| Стек | Где используется | Ключевые преимущества |
|---|---|---|
| `Next.js (App Router, Route Handlers, Middleware)` | Маршруты страниц и API | Единый fullstack-контур, SSR/CSR-гибрид, прозрачная маршрутизация и серверная логика рядом с приложением. |
| `React 19` | UI-компоненты и интерактивность | Переиспользуемость компонентов, hooks-модель, улучшенный UX через `useOptimistic`. |
| `TypeScript` | Весь код проекта | Строгие контракты между слоями, безопасный рефакторинг, раннее обнаружение ошибок. |
| `Prisma + PostgreSQL` | Доступ к данным и транзакции | Type-safe ORM, стабильная реляционная модель, ACID-гарантии и готовность к production-нагрузке. |
| `next-auth` | Аутентификация и сессии | Готовая auth-инфраструктура, role-based доступ, поддержка Credentials/OAuth. |
| `Tailwind CSS` | UI-стили | Быстрая вёрстка, единый дизайн-язык, удобная адаптивность без раздутого CSS. |
| `Zod` | Schema-first валидация API | Централизованные схемы, автоматический вывод типов, единые правила валидации. |
| `ESLint + Smoke tests` | Контур качества | Контроль стиля/ошибок и проверка критических потоков перед финализацией. |
| `next/image` + cache tags | Производительность | Оптимизация изображений и управляемое server caching (`unstable_cache`, `revalidateTag`). |

## Целевая архитектура (после ревизии)
1. `src/server/` — доменные серверные сервисы и shared-инфраструктура.
2. `src/app/api/**/route.ts` — thin controllers (`auth -> validation -> service -> response`).
3. `src/features/` — клиентские API-адаптеры и типы фич.
4. `src/contexts/` — orchestration-слой клиентского состояния.
5. `src/types/` — разделение на `domain`, `dto`, `api-contracts`.
6. `docs/PROJECT_TECHNICAL_DEFENSE_RU.md` — основной файл защиты.

## Пошаговый план реализации и статус
1. Базовая стабилизация (`lint`, `type-check`, `build`) — выполнено.
2. Нормализация кодировки/строк — выполнено.
3. Декомпозиция shared-хелперов API — выполнено.
4. Рефактор домена мероприятий в сервисы — выполнено.
5. Рефактор домена админки и импорта — выполнено.
6. Рефактор auth/profile pipeline — выполнено.
7. Рефактор клиентского слоя и API-адаптеров — выполнено.
8. Внедрение framework-фич (`cache tags`, `useOptimistic`, `next/image`) — выполнено.
9. Clean Code стандарты + file-header комментарии — выполнено.
10. Тестовый контур (`api smoke`, `e2e smoke`, `test:smoke:local`) — выполнено.
11. Финальный большой техдок для защиты — выполнено.

## Изменения публичных интерфейсов
1. URL API и страниц сохранены.
2. Формат ошибок унифицирован (`error`, `code`, `errorPayload`).
3. DTO/контракты вынесены в `src/types/dto/*` и `src/types/api-contracts/*`.
4. `useAppContext` сохранён как публичная точка входа.
5. Добавлен schema-first слой валидации для ключевых endpoint.

## Тест-контур и контроль качества
1. `npm run lint` — статический контроль.
2. `npm run type-check` — строгая типизация.
3. `npm run build` — проверка production-сборки.
4. `npm run test:smoke:local` — API/e2e smoke (включая strict-режим при тестовых учётках).

## Итоговые артефакты
1. Рефакторенный код `src/**` с архитектурной декомпозицией.
2. Полные file-header комментарии во всех TS/TSX исходниках.
3. Смоук-контур тестирования (`tests/smoke/*` + npm scripts).
4. Текущий файл как основной технический отчёт защиты.

## Явные допущения
1. Исторические миграции Prisma оставлены неизменными.
2. JSON/generated файлы не получают inline-комментарии.
3. Внешнее поведение продукта сохранено; изменения — внутренняя архитектура и качество.
---

# Детальная техническая часть
## Техническая защита проекта `bgitu-afisha` (подробный разбор)

## 1. Паспорт проекта

### 1.1 Назначение системы
`bgitu-afisha` — веб-платформа для публикации, модерации и прохождения университетских мероприятий.
Ключевые роли:
- `STUDENT` — просмотр/регистрация, управление профилем и предпочтениями уведомлений.
- `TEACHER` — создание/модерация мероприятий, подтверждение заявок, рассылка уведомлений.
- `ADMIN` — администрирование пользователей, мероприятий, логов, импорт данных.

### 1.2 Технологический стек
- Фреймворк: `Next.js` (App Router, route handlers).
- UI: `React` + Tailwind CSS.
- Аутентификация: `next-auth` (Credentials + OAuth-провайдер при наличии env).
- ORM/БД: `Prisma` + PostgreSQL.
- Сборка/типизация: `TypeScript`.

### 1.3 Принятые ограничения и scope
- В рамках ревизии не редактируются generated-файлы (`.next`, `*.tsbuildinfo`) вручную.
- Исторические SQL-migration файлы Prisma не переписываются.
- Вложенный репозиторий `bgitu-afisha/` (внутри проекта) не входит в текущий рабочий scope.

---

## 2. Архитектура после рефакторинга

## 2.1 Слои
- `src/app/api/**/route.ts`: тонкие контроллеры HTTP (авторизация, валидация, делегирование в сервисы).
- `src/server/**`: серверные доменные сервисы/хелперы и инфраструктурные функции.
- `src/features/**`: клиентские адаптеры API и специализированная UI-логика.
- `src/contexts/**`: агрегирующий state-слой для клиентской части (`useAppContext`).
- `src/types/**`: разнесенные доменные типы, DTO и API-контракты.

## 2.2 Основные каталоги `src/server`

### `src/server/shared`
- `audit-diff.ts` — нормализация значений и построение diffs для аудита.
- `date-time.ts` — парсинг и форматирование дат/времени.
- `participants.ts` — разделение участников на `CONFIRMED`/`PENDING`.
- `session.ts` — role/session guards (`isAdminSession`, `canModerateEventByRole` и др.).
- `http-response.ts` — унифицированные JSON-ответы ошибок/успеха.

### `src/server/events`
- `event-cache.ts` — кэш-тег `events` и revalidate helper.
- `event-validator.ts` — проверка категорий мероприятий.
- `event-serializer.ts` — сериализация отчётов, модераторов и участников.
- `event-query-service.ts` — выборки списков/деталей событий.
- `event-command-service.ts` — создание/обновление события с relation-операциями.
- `participant-service.ts` — разрешение email -> userId для участников/модераторов.

### `src/server/auth`
- `profile-service.ts` — нормализация профиля и pipeline валидации обновления профиля.

### `src/server/admin`
- `admin-session.ts` — централизованная проверка admin-сессии.
- `admin-event-service.ts` — CRUD и доменная логика админ-операций по мероприятиям/новостям.
- `import-parser.ts` — нормализация CSV/JSON и алиасы колонок импорта.
- `import-service.ts` — сценарии импорта пользователей/мероприятий/новостей.

---

## 3. Ключевые маршруты и поведение

## 3.1 Мероприятия

### `GET /api/events`
- Поддерживает фильтры: `category`, `search`, `upcoming`, `past`, `limit`.
- Использует `unstable_cache` + tag `events`.
- Для неавторизованных пользователей возвращает только актуальные будущие события.
- Сериализует даты, отчёт, модераторов и разделение участников.

### `POST /api/events`
- Доступ: `TEACHER`/`ADMIN`.
- Валидация обязательных полей и категории.
- Нормализация даты/времени через `parseLocalDateTime`.
- Разрешение участников/модераторов по email через `participant-service`.
- Создание события через `event-command-service`.
- Логирование в аудит + создание уведомлений заинтересованным пользователям.
- Инвалидация кэша: `revalidateEventsCache()`.

### `GET /api/events/[id]`
- Возвращает детальную карточку события с отчётом, участниками, модераторами и создателем.

### `PUT /api/events/[id]`
- Доступ: `TEACHER`/`ADMIN`, с проверкой модерационных прав (owner/moderator/admin).
- Обновляет базовые поля, участников и модераторов.
- Формирует уведомления о добавлениях/подтверждениях/изменениях.
- Строит подробный audit diff до/после.
- Инвалидация кэша `events`.

### `POST /api/events/[id]/register`
- Регистрация текущего пользователя в событие.
- Логика статуса:
  - `TEACHER`/`ADMIN` -> `CONFIRMED`.
  - `STUDENT` -> `PENDING`.
- Проверка лимитов и завершённости события.

### `POST /api/events/[id]/participants`
- Модерация pending-заявок (`confirm`/`reject`).
- Корректировка `currentParticipants` и уведомления участникам.
- Аудит изменений.

### `POST /api/events/[id]/complete`
- Завершение события: установка `isPast`, создание отчёта.
- Проверка модерационных прав.
- Аудит + инвалидация event-кэша.

## 3.2 Профиль

### `GET /api/auth/profile`
- Возвращает профиль текущего пользователя в нормализованном виде.

### `PUT /api/auth/profile`
- Обновляет профиль и настройки уведомлений.
- Защита для студентов: группа может быть изменена ограниченное число раз.
- Поддержка вложенных notification-настроек (`notifications.*`).
- Аудит обновления профиля.

## 3.3 Уведомления

### `GET /api/notifications`
- Список уведомлений текущего пользователя.

### `PATCH /api/notifications`
- Массовая отметка всех уведомлений как прочитанных.

### `DELETE /api/notifications`
- Полная очистка уведомлений текущего пользователя.

### `POST /api/notifications`
- Создание уведомлений по событию (для модераторов/админов).
- Проверка прав через модерационный guard.

### `PATCH /api/notifications/[id]`
- Отметка одного уведомления как прочитанного с ownership-проверкой.

## 3.4 Админка (пользователи/мероприятия/импорт/логи)

### `GET/POST /api/admin/users`
- Фильтрация/поиск списка пользователей.
- Создание пользователя с хэшированием пароля и аудитом.

### `GET/PUT/DELETE /api/admin/users/[id]`
- Получение карточки пользователя.
- Обновление роли/профиля/пароля.
- Удаление с защитой от self-delete.

### `GET /api/admin/logs`
- Выборка audit logs с фильтрами и `no-store` кэш-политикой.

### `GET/POST /api/admin/events`
- `GET`: список мероприятий/новостей с фильтрами (`search`, `category`, `upcoming`, `past`, `news`).
- `POST`: создание новости (событие категории `NEWS`) с опциональным автосозданием отчёта.

### `GET/PUT/DELETE /api/admin/events/[id]`
- `GET`: полные детали события для админ-редактора.
- `PUT`: обновление карточки, модераторов и отчёта с уведомлениями и audit-diff.
- `DELETE`: удаление события с фиксацией итогового состояния в аудите.

### `POST /api/admin/import`
- Массовый импорт `users/events/news` в режимах `upsert` или `create`.
- Поддержка `CSV` и `JSON` с единым пайплайном нормализации/валидации.
- Аудит результата импорта (`created/updated/skipped/errors/warnings`).

---

## 4. Модель данных (Prisma)

## 4.1 Основные сущности
- `User`: роль, профиль, prefs уведомлений, согласия, аудит.
- `Event`: карточка события, лимиты, статусы, связь с создателем.
- `EventParticipant`: M:N связь пользователя и события с `ParticipantStatus`.
- `EventModerator`: M:N связь модераторов событий.
- `EventReport`: отчёт по завершённому событию.
- `Notification`: пользовательские уведомления.
- `AuditLog`: журнал действий по сущностям.

## 4.2 Enum
- `Role`: `STUDENT`, `TEACHER`, `ADMIN`.
- `EventCategory`: типы мероприятий (`CONCERT`, `LECTURE`, `NEWS`, ...).
- `NotificationType`: `NEW`, `CHANGE`, `COMPLETE`, `EVENT`, `SYSTEM`.
- `ParticipantStatus`: `PENDING`, `CONFIRMED`.

---

## 5. Потоки данных (end-to-end)

## 5.1 Поток «Студент регистрируется на мероприятие»
1. UI `events/[id]` вызывает `registerForEvent` из `AppContext`.
2. `AppContext` делегирует в `features/events/client/events-api.ts`.
3. `POST /api/events/[id]/register` создаёт `EventParticipant`.
4. Для привилегированных ролей сразу инкрементируется `currentParticipants`.
5. Аудит `EVENT_REGISTER` фиксирует действие.

## 5.2 Поток «Преподаватель подтверждает участника»
1. UI карточки события (EventCard) показывает pending-пользователей.
2. При клике `confirm/reject` применяется optimistic-обновление списка.
3. API `/api/events/[id]/participants` обновляет статус/удаляет заявку.
4. Участник получает уведомление результата модерации.
5. Пишется audit-событие подтверждения/отклонения.

## 5.3 Поток «Обновление профиля»
1. `profile/page.tsx` отправляет payload через `useAppContext().updateProfile`.
2. `profile-api.ts` вызывает `/api/auth/profile`.
3. `profile-service.ts` валидирует и нормализует updates.
4. User-данные обновляются, затем обновляется клиентская session-модель.

## 5.4 Поток «Рассылка уведомлений по событию»
1. Модератор открывает `NotificationModal`.
2. `sendEventNotification` -> `/api/notifications`.
3. Сервер проверяет права модерации конкретного события.
4. Создаются массовые уведомления целевой аудитории.
5. В аудит пишется `EVENT_NOTIFY`.

---

## 6. Клиентский слой и управление состоянием

## 6.1 `AppContext` как orchestrator
После рефакторинга контекст стал orchestration-слоем:
- хранит state (`events`, `notifications`, фильтры),
- делегирует сетевые вызовы в `src/features/*/client/*-api.ts`,
- держит retry/throttle политику,
- предоставляет публичный контракт `useAppContext` для обратной совместимости.

## 6.2 Клиентские API-адаптеры
- `features/events/client/events-api.ts`:
  - fetch/create/update/complete/register/moderate,
  - нормализация дат API -> `Date`.
- `features/notifications/client/notifications-api.ts`:
  - fetch/mark/clear/send.
- `features/profile/client/profile-api.ts`:
  - update profile + типизированный response.

---

## 7. Внедрённые framework-фичи

## 7.1 Server cache tags вместо ручного map-кэша
- Ранее использовались ручные структуры request cache.
- Теперь для `/api/events` используется `unstable_cache` + tag `events`.
- После мутаций вызывается `revalidateEventsCache()` -> `revalidateTag("events", "max")`.

Плюсы:
- предсказуемая инвалидация,
- меньше ручной state-логики на сервере,
- лучше контролируемое поведение при частых чтениях.

## 7.2 `useOptimistic` в критичных действиях
- `src/app/notifications/page.tsx`:
  - optimistic mark-read,
  - optimistic clear-all.
- `src/components/events/EventCard.tsx`:
  - optimistic удаление pending-заявки из UI при модерации.

Плюсы:
- мгновенная обратная связь пользователю,
- меньшая perceived latency,
- отсутствие UI-блокировок при сетевом round-trip.

## 7.3 `next/image` для медиа-блоков
- Переведены ключевые блоки на `Image`:
  - карточки событий (`EventCard`),
  - галереи в `events/[id]`,
  - аватар профиля.
- Использован `unoptimized` для безопасной поддержки mixed image sources.

Плюсы:
- единообразный API для изображений,
- контролируемые `sizes` и layout,
- подготовка к дальнейшей оптимизации медиа.

---

## 8. Стандарты Clean Code, применённые в ревизии

1. Сокращение ответственности route handlers.
2. Вынос дублируемой логики в `server/shared` и доменные сервисы.
3. Явные DTO/контракты API в `src/types/dto`, `src/types/api-contracts`.
4. Уменьшение `any` в ключевых публичных интерфейсах.
5. Стабилизация формата ошибок (`error`, `code`, `errorPayload`).
6. Добавление file-header комментариев в изменённых файлах.

---

## 9. Тестовый контур

## 9.1 Добавленные smoke-скрипты
- `tests/smoke/api-smoke.ts`
- `tests/smoke/e2e-smoke.ts`

## 9.2 npm scripts
- `npm run test:smoke:api`
- `npm run test:smoke:e2e`
- `npm run test:smoke`
- `npm run test:smoke:local` (автозапуск `next start`, ожидание readiness и прогон smoke)

## 9.3 Требования к запуску
Для `npm run test:smoke:local` сервер поднимается автоматически.  
Для ручного прогона `test:smoke` нужен уже поднятый сервер.

Тестовые креды через env:
- `SMOKE_BASE_URL` (по умолчанию `http://localhost:3000`)
- `SMOKE_STUDENT_EMAIL`, `SMOKE_STUDENT_PASSWORD`
- `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`
- `SMOKE_STRICT=true` для fail-fast без skip.

## 9.4 Что проверяется
- Доступность базовых API (`events`, `profile`, `notifications`, `admin/users`, `admin/logs`).
- Логин по credentials и базовые защищённые сценарии.
- E2E HTTP-потоки по страницам: `dashboard`, `events`, `profile`, `notifications`, `admin`.

---

## 10. Карта ключевых файлов и функций

## 10.1 Сервер
- `src/app/api/events/route.ts`:
  - `GET`: список событий с серверным кэшем.
  - `POST`: создание событий, аудит и уведомления.
- `src/app/api/events/[id]/route.ts`:
  - `GET`: чтение деталей.
  - `PUT`: обновление, модерация, аудит-diff.
- `src/server/events/event-query-service.ts`:
  - `buildEventListWhere`, `findEventsForList`, `findEventByIdForRead`, `findEventByIdForEdit`.
- `src/server/events/event-command-service.ts`:
  - `createEventWithRelations`, `updateEventWithRelations`.
- `src/server/events/participant-service.ts`:
  - `resolveParticipantUsers`, `resolveModerators`.
- `src/server/auth/profile-service.ts`:
  - `toProfileResponse`, `buildProfileUpdates`.
- `src/server/admin/admin-event-service.ts`:
  - `listAdminEvents`, `createAdminNews`, `getAdminEventDetails`, `updateAdminEvent`, `deleteAdminEvent`.
- `src/server/admin/import-service.ts`:
  - `importUsersRows`, `importEventRows`.
- `src/server/admin/import-parser.ts`:
  - `mapCsvRows`, `mapJsonRows`, нормализация ролей/категорий/дат.

## 10.2 Клиент
- `src/contexts/AppContext.tsx`:
  - публичный контракт `useAppContext`,
  - фильтрация и derived collections,
  - orchestration API actions.
- `src/features/events/client/events-api.ts`:
  - нормализация и сетевые операции domain `events`.
- `src/features/notifications/client/notifications-api.ts`:
  - CRUD-паттерн уведомлений.
- `src/features/profile/client/profile-api.ts`:
  - update pipeline профиля.
- `src/features/admin/client/admin-api.ts`:
  - типизированные вызовы `admin/users/events/import/logs`.
- `src/app/admin/page.tsx`:
  - декларативный admin UI, использующий feature-адаптеры вместо прямых fetch-блоков.
- `src/components/events/EventCard.tsx`:
  - optimistic moderation + `next/image`.
- `src/app/notifications/page.tsx`:
  - фильтры/поиск и optimistic UX.

## 10.3 Типы
- `src/types/domain/*`: доменные модели.
- `src/types/dto/*`: payload для операций.
- `src/types/api-contracts/*`: типовые формы ответов/ошибок.
- `src/types/index.ts`: совместимый публичный вход для UI.

---

## 11. Что и почему улучшено (до/после)

## 11.1 Слой API
До:
- крупные route handlers с дублированной логикой парсинга/валидации,
- ручные фрагментарные checks и неединообразные ошибки.

После:
- thin handlers + доменные сервисы в `src/server/events/*` и `src/server/admin/*`,
- shared helpers (`session`, `audit-diff`, `date-time`, `http-response`),
- единый error-формат с `errorPayload`.

## 11.2 Клиентский state
До:
- `AppContext` совмещал сетевые детали и orchestration.

После:
- вынесены API adapters в `src/features/*/client/*-api.ts`,
- контекст сфокусирован на state orchestration.

## 11.3 UX и производительность
До:
- ручной кэш и неявная инвалидация,
- отсутствие оптимистичных взаимодействий,
- широкое использование `img`.

После:
- `unstable_cache` + tag revalidation,
- `useOptimistic` для критичных сценариев,
- ключевые медиа переведены на `next/image`,
- сериализация дат в events API сделана устойчивой к `Date | string` при server-cache.

## 11.4 Сопровождаемость
До:
- высокая связность между маршрутами и инфраструктурой,
- размытая ответственность модулей.

После:
- слоистая структура,
- file-header комментарии и карта назначения файлов,
- явные типы DTO/контрактов для дальнейшего масштабирования,
- удалены остаточные `any` в `src/**` и `tests/**`,
- исправлены mojibake-строки в ключевых UI/Auth/Debugger модулях, выровнена кодировка.

---

## 12. Quality gates и факт прогона

На момент финализации ревизии выполнены:
- `npm run lint` — успешно.
- `npm run type-check` — успешно.
- `npm run build` — успешно.
- `npm run test:smoke:local` — успешно.
- `npm run test:smoke:local` при `SMOKE_STRICT=true` и тестовых аккаунтах — успешно (включая auth-сценарии student/admin).

Примечание по generated-файлам:
- в рабочем дереве может меняться `next-env.d.ts` после сборки/типогенерации,
- generated-артефакты не редактировались вручную.

---

## 13. Ограничения и дальнейшие шаги

1. Для production-CI smoke/e2e нужен отдельный тестовый контур БД и фиксированные тестовые аккаунты.
2. Admin UI уже разукрупнён и очищен от сетевой логики; следующий шаг — выделить отдельные UI-компоненты секций (`users/events/import/logs`) для ещё более тонкой модульности.
3. Для усиления контроля контрактов можно добавить schema-first валидацию на уровне всех admin payload (единый слой schemas для route handlers и сервисов).

---

## 14. Приложение: список новых/обновлённых архитектурных модулей

Новые/существенно обновлённые файлы:
- `src/server/shared/http-response.ts`
- `src/server/shared/service-error.ts`
- `src/server/events/event-query-service.ts`
- `src/server/events/event-command-service.ts`
- `src/server/events/participant-service.ts`
- `src/server/auth/profile-service.ts`
- `src/server/admin/admin-session.ts`
- `src/server/admin/admin-event-service.ts`
- `src/server/admin/import-parser.ts`
- `src/server/admin/import-service.ts`
- `src/features/events/client/events-api.ts`
- `src/features/notifications/client/notifications-api.ts`
- `src/features/profile/client/profile-api.ts`
- `src/features/admin/client/admin-api.ts`
- `src/features/admin/types.ts`
- `src/app/api/events/route.ts`
- `src/app/api/events/[id]/route.ts`
- `src/app/api/events/[id]/participants/route.ts`
- `src/app/api/events/[id]/complete/route.ts`
- `src/app/api/events/[id]/register/route.ts`
- `src/app/api/auth/profile/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/events/route.ts`
- `src/app/api/admin/events/[id]/route.ts`
- `src/app/api/admin/import/route.ts`
- `src/app/api/admin/logs/route.ts`
- `src/app/api/users/route.ts`
- `src/app/admin/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/events/create/page.tsx`
- `src/app/profile/page.tsx`
- `src/contexts/AppContext.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/EventForm.tsx`
- `src/components/events/CompleteEventModal.tsx`
- `src/components/events/page.tsx`
- `src/components/events/[id]/page.tsx`
- `src/components/ui/NotificationBell.tsx`
- `src/components/ui/NotificationModal.tsx`
- `src/components/dev/DebuggerInitializer.tsx`
- `src/components/dev/DebuggerPanel.tsx`
- `src/app/notifications/page.tsx`
- `src/components/layout/Footer.tsx`
- `src/app/legal/privacy/page.tsx`
- `src/app/legal/terms/page.tsx`
- `src/lib/auth.ts`
- `src/lib/debugger.ts`
- `src/types/index.ts`
- `src/types/domain/*`
- `src/types/dto/*`
- `src/types/api-contracts/*`
- `tests/smoke/api-smoke.ts`
- `tests/smoke/e2e-smoke.ts`
- `tests/smoke/run-local.ts`

Документ подготовлен как материал для защиты и может использоваться как техническая основа презентации архитектуры, потоков и обоснования рефакторинга.

---

## 15. Полная карта исходников `src` (для защиты)

Ниже приведён перечень всех исходных TypeScript/TSX модулей и их назначение. Этот раздел можно использовать как «карту проекта» на защите.

- `src/app/(auth)/login/page.tsx` - Login page for credentials/OAuth authentication flow.
- `src/app/(auth)/register/page.tsx` - Registration page for new local user accounts.
- `src/app/admin/page.tsx` - Admin dashboard page for users, events/news, imports and audit logs.
- `src/app/api/admin/events/[id]/route.ts` - Admin event details endpoint (get/update/delete).
- `src/app/api/admin/events/route.ts` - Admin events collection endpoint (list + news creation).
- `src/app/api/admin/import/route.ts` - Admin bulk import endpoint for users/events/news.
- `src/app/api/admin/logs/route.ts` - Admin audit logs list endpoint.
- `src/app/api/admin/users/[id]/route.ts` - Admin user details endpoint (get/update/delete).
- `src/app/api/admin/users/route.ts` - Admin users collection endpoint (list + create).
- `src/app/api/auth/[...nextauth]/route.ts` - HTTP route handler for this App Router API endpoint.
- `src/app/api/auth/profile/route.ts` - Profile API endpoint for current authenticated user.
- `src/app/api/auth/register/route.ts` - API endpoint for user self-registration.
- `src/app/api/auth/session-test/route.ts` - Debug endpoint to inspect current session payload.
- `src/app/api/auth/setup/route.ts` - Bootstrap endpoint for local auth seed/setup tasks.
- `src/app/api/events/[id]/complete/route.ts` - Event completion API endpoint.
- `src/app/api/events/[id]/participants/route.ts` - Participant moderation API for an event.
- `src/app/api/events/[id]/register/route.ts` - Event registration API endpoint.
- `src/app/api/events/[id]/route.ts` - Event details API endpoint (get + update).
- `src/app/api/events/empty/route.ts` - Fallback events endpoint for empty dataset response.
- `src/app/api/events/route.ts` - Events collection API endpoint (list + create).
- `src/app/api/notifications/[id]/route.ts` - Notification details endpoint for current user.
- `src/app/api/notifications/route.ts` - Notifications collection endpoint for current user.
- `src/app/api/test/route.ts` - Minimal API probe endpoint for connectivity checks.
- `src/app/api/users/route.ts` - Teacher/admin-only endpoint for listing users with role/search filters.
- `src/app/calendar/page.tsx` - Calendar route page for monthly/day event navigation.
- `src/app/dashboard/page.tsx` - Main dashboard page with global search and event sections.
- `src/app/events/[id]/page.tsx` - App Router page module for this route.
- `src/app/events/create/page.tsx` - Protected page to create a new event.
- `src/app/events/page.tsx` - Events route wrapper page.
- `src/app/layout.tsx` - Root app layout with global providers and baseline styles.
- `src/app/legal/privacy/page.tsx` - Public privacy policy page.
- `src/app/legal/terms/page.tsx` - Public terms of service page.
- `src/app/news/page.tsx` - News page that displays completed event reports as news content.
- `src/app/notifications/page.tsx` - Notifications center page with search/filter/sort controls.
- `src/app/page.tsx` - Public entry page of the application.
- `src/app/profile/page.tsx` - Profile page for viewing/updating personal data and notification preferences.
- `src/app/test/page.tsx` - Internal test page used for local diagnostics and manual checks.
- `src/app/users/[id]/page.tsx` - App Router page module for this route.
- `src/components/dev/DebuggerInitializer.tsx` - Development-only bootstrap for debugger instrumentation and global controls.
- `src/components/dev/DebuggerPanel.tsx` - Floating development panel to inspect and configure runtime debugger logs.
- `src/components/events/[id]/page.tsx` - Event details page for participants and moderators.
- `src/components/events/Calendar.tsx` - Calendar component for visual event distribution by dates.
- `src/components/events/CategoryFilter.tsx` - Category filter control for event collections.
- `src/components/events/CompleteEventModal.tsx` - Modal for completing an event with a structured report payload.
- `src/components/events/DayEventsModal.tsx` - Modal with events for a specific selected day.
- `src/components/events/EventCard.tsx` - Event list card component.
- `src/components/events/EventForm.tsx` - Create/edit event form with participant/moderator and image management.
- `src/components/events/MonthEventsModal.tsx` - Modal with aggregated events for selected month.
- `src/components/events/page.tsx` - Events workspace page for teachers/admins to create, edit and complete events.
- `src/components/layout/Footer.tsx` - Global footer with project/legal/social links.
- `src/components/layout/Header.tsx` - Top navigation header with user actions and route links.
- `src/components/layout/LayoutShell.tsx` - Common page shell combining header/footer and main content slot.
- `src/components/providers/SessionProvider.tsx` - Client session provider wrapper for NextAuth in App Router.
- `src/components/sections/Banner.tsx` - Dashboard banner section with highlighted upcoming events.
- `src/components/sections/CalendarSection.tsx` - Dashboard section embedding the event calendar module.
- `src/components/sections/NewsSection.tsx` - Dashboard section for latest news/report cards.
- `src/components/sections/UpcomingEvents.tsx` - Dashboard section listing near-future events.
- `src/components/ui/Button.tsx` - Reusable styled button component with variants and icon support.
- `src/components/ui/ImageGalleryModal.tsx` - Image gallery modal for browsing event/report media.
- `src/components/ui/Modal.tsx` - Reusable modal dialog container component.
- `src/components/ui/NotificationBell.tsx` - Header notification bell with quick actions and preview modal.
- `src/components/ui/NotificationModal.tsx` - Modal to send event notifications to selected participant groups.
- `src/components/ui/SearchInput.tsx` - Shared search input control for list filtering.
- `src/components/ui/ToastProvider.tsx` - Global toast renderer subscribing to toast helper events.
- `src/contexts/AppContext.tsx` - Central application context that orchestrates events, notifications and profile actions.
- `src/features/admin/client/admin-api.ts` - Client API adapter for admin panel workflows.
- `src/features/admin/types.ts` - Shared admin panel client-side types.
- `src/features/events/client/events-api.ts` - Client-side event API adapter functions.
- `src/features/notifications/client/notifications-api.ts` - Client-side notification API adapters.
- `src/features/profile/client/profile-api.ts` - Client-side profile API adapter.
- `src/lib/audit.ts` - Audit logging helpers shared by API and domain services.
- `src/lib/auth.ts` - NextAuth configuration and callbacks for credentials/OAuth authentication.
- `src/lib/debugger.ts` - Shared developer debugger utility for structured client-side diagnostics.
- `src/lib/permissions.ts` - Role/permission helper functions for UI and API checks.
- `src/lib/prisma.ts` - Prisma client singleton bootstrap for server-side database access.
- `src/lib/toast.ts` - Client-side toast event helper for lightweight notifications.
- `src/proxy.ts` - Middleware entry for route protection and session-aware redirects.
- `src/server/admin/admin-event-service.ts` - Admin event/news domain service for CRUD, moderation links and audit metadata.
- `src/server/admin/admin-session.ts` - Shared admin auth guards and helpers for admin API routes.
- `src/server/admin/import-parser.ts` - Parsing and normalization helpers for admin CSV/JSON import endpoints.
- `src/server/admin/import-service.ts` - Domain-level admin import workflows for users/events/news.
- `src/server/auth/profile-service.ts` - Profile domain service for auth/profile route handlers.
- `src/server/events/event-cache.ts` - Shared cache tag constants and revalidation helpers for event data.
- `src/server/events/event-command-service.ts` - Event mutation operations used by API controllers.
- `src/server/events/event-mutation-service.ts` - Orchestration services for event create/update API workflows.
- `src/server/events/event-query-service.ts` - Event query operations used by API controllers.
- `src/server/events/event-serializer.ts` - Reusable event serialization utilities for API responses.
- `src/server/events/event-validator.ts` - Validation helpers for event domain input.
- `src/server/events/participant-service.ts` - Participant/moderator resolution helpers for event commands.
- `src/server/shared/audit-diff.ts` - Shared helpers for building compact audit metadata diffs.
- `src/server/shared/date-time.ts` - Centralized date/time parsing helpers used by API route handlers and services.
- `src/server/shared/http-response.ts` - Unified API response helpers for success/error payloads.
- `src/server/shared/participants.ts` - Shared participant helpers for event-related APIs and services.
- `src/server/shared/schemas/admin-api-schema.ts` - Schema-first validation contracts for admin API query/payload parsing.
- `src/server/shared/schemas/event-api-schema.ts` - Schema-first validation contracts for events API route handlers.
- `src/server/shared/service-error.ts` - Typed domain/service error helper for route handlers.
- `src/server/shared/session.ts` - Session/user role guards shared by API route handlers.
- `src/types/api-contracts/common.ts` - Shared API response contracts.
- `src/types/api-contracts/events.ts` - Event API response contracts.
- `src/types/api-contracts/index.ts` - API contract barrel.
- `src/types/api-contracts/notifications.ts` - Notification API response contracts.
- `src/types/domain/event.ts` - Domain-level event and event report models.
- `src/types/domain/index.ts` - Domain type barrel.
- `src/types/domain/notification.ts` - Domain-level notification model shared by UI and state.
- `src/types/domain/user.ts` - Domain-level user model used across UI and client-side state.
- `src/types/dto/event-dto.ts` - Event DTO contracts for network boundaries.
- `src/types/dto/index.ts` - DTO type barrel.
- `src/types/dto/notification-dto.ts` - Notification DTO contracts for API interactions.
- `src/types/index.ts` - Public typed entrypoint for client/domain/api contracts.
- `src/utils/eventCategoryIcons.ts` - Static mapping between event categories and icon classes.

## 16. Карта тестов и артефактов качества

- `tests/smoke/api-smoke.ts` - API smoke для auth/events/notifications/admin/profile.
- `tests/smoke/e2e-smoke.ts` - e2e smoke HTTP-потоков (login -> dashboard -> events/profile/notifications/admin).
- `tests/smoke/run-local.ts` - оркестратор локального smoke-прогона (start + suites + teardown).
- `npm run lint` - статический контроль стиля и потенциальных ошибок.
- `npm run type-check` - строгая проверка TypeScript-контрактов.
- `npm run build` - production-сборка и проверка целостности маршрутов App Router.
- `npm run test:smoke:local` - локальный quality-gate перед релизом.

## 17. Результат ревизии по критериям задания

- Проведён полный проход по исходникам `src/**`: все файлы имеют системный file-header.
- Введён schema-first слой валидации (`src/server/shared/schemas/*`) и подключён в ключевые route handlers.
- Маршруты `events` переведены на более тонкие контроллеры с выносом orchestration в `src/server/events/event-mutation-service.ts`.
- Добавлены и документированы framework-фичи Next/React: `unstable_cache`+tag revalidation, `useOptimistic`, `next/image`.
- Сформирован подробный технический файл для защиты с архитектурой, потоками, тестами и картой модулей.


