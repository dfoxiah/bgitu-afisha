# БГИТУ Афиша

Веб‑платформа для публикации и управления мероприятиями БГИТУ (Next.js + TypeScript + Prisma).

## Требования
- Node.js >= 20.9

## Стек
- Next.js 16 (App Router)
- TypeScript
- NextAuth.js (Credentials + Yandex OAuth)
- Prisma + PostgreSQL
- Tailwind CSS

## Быстрый старт
1. Скопируйте и заполните окружение:
   - `cp .env.example .env.local`
2. Установите зависимости:
   - `npm install`
3. Инициализируйте базу данных (локально):
   - `npx prisma db push`
4. (Опционально) Заполните тестовые данные:
   - `npm run db:seed`
5. Запустите dev‑сервер:
   - `npm run dev`

## Скрипты
- `npm run dev` — локальная разработка.
- `npm run build` — production сборка.
- `npm run start` — запуск production сборки.
- `npm run lint` — линтинг.
- `npm run type-check` — проверка типов.
- `npm run db:seed` — сидинг тестовых данных.

## Переменные окружения
Обязательные:
- `DATABASE_URL` — строка подключения PostgreSQL.
- `NEXTAUTH_URL` — публичный URL приложения (локально `http://localhost:3000`).
- `NEXTAUTH_SECRET` — секрет для NextAuth.

Опциональные OAuth:
- `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_SCOPE`

Опциональные флаги:
- `NEXTAUTH_DEBUG` — вывод отладочных логов NextAuth.
- `DEBUG_MIDDLEWARE` — логирование middleware.
- `DEBUG_AUTH` — логирование auth‑процесса.
- `DEBUG_EVENTS` — логирование API мероприятий.
- `NEXT_PUBLIC_ENABLE_DEMO` — отображение демо‑входа на странице логина.
- `ADMIN_SEED_PASSWORD` — пароль для создания админ‑аккаунтов при сидинге (dev/optional).

## Админ‑панель
Доступна по пути `/admin` только для роли `ADMIN`.
Функции: управление пользователями, мероприятиями, просмотр аудит‑логов.
По умолчанию при сидинге создаются 3 админа (если задан `ADMIN_SEED_PASSWORD`):
- `admin1@bgitu.ru`
- `admin2@bgitu.ru`
- `admin3@bgitu.ru`

## Ограничения и аудит
- Преподаватели могут редактировать и модерировать только свои мероприятия либо те, где назначены модераторами.
- Студенты могут изменить поле «Группа» только один раз.
- Все ключевые действия логируются в аудит‑лог (создание/редактирование событий, профиль, регистрация, модерация, админ‑операции).

## Юридические документы
Добавлены страницы:
- `/legal/terms` — пользовательское соглашение
- `/legal/privacy` — политика конфиденциальности

## Деплой на Vercel
1. Создайте проект и подключите репозиторий.
2. Задайте переменные окружения в Vercel (Project Settings → Environment Variables).
3. Убедитесь, что `NEXTAUTH_URL` указывает на домен Vercel.
4. Для продакшена предпочтительно использовать миграции:
   - Локально: `npx prisma migrate dev` (создать миграции).
   - На Vercel: `npx prisma migrate deploy` (выполнить миграции).
5. Build команда по умолчанию: `npm run build`.

## Финальный чек‑лист Vercel
1. База данных Postgres создана и доступна из Vercel.
2. `DATABASE_URL` указывает на production базу.
3. Переменные окружения настроены:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `ADMIN_SEED_PASSWORD` (если нужен сидинг админов)
4. Миграции подготовлены:
- Локально: `npx prisma migrate dev`
- В Vercel: `npx prisma migrate deploy`
5. `npm run build` проходит локально с реальными env.
6. (Опционально) `npm run db:seed` выполнен в нужной среде.
7. После деплоя проверены ключевые маршруты: `/login`, `/register`, `/events`, `/admin`.

## Демо и тестовые маршруты
Тестовые/демо маршруты доступны только в development и автоматически отключены в production.
Для демо‑доступа используйте `npm run db:seed` и включите `NEXT_PUBLIC_ENABLE_DEMO=true`.
