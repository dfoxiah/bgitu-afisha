# Система управления мероприятиями (Laravel 12)

Новый подпроект `laravel-event-manager`, полностью пересобранный под требования курсовой.

## Что реализовано

- Сущности:
  - `Мероприятия` (`title`, `description`, `starts_at`, `venue`, `price`)
  - `Участники` (`full_name`, `email`, `phone`)
  - `Регистрации` (`event_id`, `participant_id`, `registered_at`, `status`)
  - `Организаторы` (`name`, `contacts`)
- Дополнительно:
  - календарь событий
  - регистрация/отмена регистрации
  - рассылка участникам мероприятия
- Обязательные компоненты:
  - модели + миграции + связи `hasOne/hasMany/belongsTo/belongsToMany`
  - resource-контроллеры + доп. контроллеры
  - Blade layout + CRUD-шаблоны + компоненты
  - формы и серверная валидация (`FormRequest`)
  - коллекции (группировка/счётчики/агрегации)
  - аутентификация (Breeze) и авторизация по ролям
  - поиск, сортировка, пагинация, загрузка файлов

## Стек

- Laravel 12.x
- PHP 8.1+
- SQLite (по умолчанию)
- Tailwind CSS (Breeze)

## Быстрый запуск

```bash
php artisan optimize:clear
php artisan migrate:fresh --seed
php artisan storage:link
npm install
npm run build
php artisan serve
```

Открыть: `http://127.0.0.1:8000`

## Демо-аккаунты

Пароль для всех: `password`

- `admin@events.local` (роль `admin`)
- `organizer@events.local` (роль `organizer`)
- `participant@events.local` (роль `participant`)

## Проверка качества

```bash
php artisan test
```

Текущее состояние: `30 passed`.
