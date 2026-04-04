$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
$coursePath = Join-Path $desktop 'Kursovaya_po_web_Ларавел_Система_управления_мероприятиями.docx'
$posterPath = Join-Path $desktop 'Афиша_мероприятия_Laravel.docx'

$word = New-Object -ComObject Word.Application
$word.Visible = $false

function Add-Paragraph {
    param(
        [Parameter(Mandatory=$true)][string]$Text,
        [int]$Size = 14,
        [bool]$Bold = $false,
        [int]$Align = 0,
        [int]$SpaceAfter = 8,
        [int]$SpaceBefore = 0
    )

    $selection = $script:word.Selection
    $selection.ParagraphFormat.Alignment = $Align
    $selection.ParagraphFormat.SpaceAfter = $SpaceAfter
    $selection.ParagraphFormat.SpaceBefore = $SpaceBefore
    $selection.Font.Name = 'Times New Roman'
    $selection.Font.Size = $Size
    $selection.Font.Bold = [int]$Bold
    $selection.TypeText($Text)
    $selection.TypeParagraph()
}

try {
    # 1) Course document
    $doc = $word.Documents.Add()

    Add-Paragraph -Text 'МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ' -Size 14 -Bold $false -Align 1 -SpaceAfter 3
    Add-Paragraph -Text 'ФГБОУ ВО «Брянский государственный инженерно-технологический университет»' -Size 14 -Bold $false -Align 1 -SpaceAfter 3
    Add-Paragraph -Text 'Кафедра «Информационные технологии»' -Size 14 -Bold $false -Align 1 -SpaceAfter 28

    Add-Paragraph -Text 'КУРСОВАЯ РАБОТА' -Size 18 -Bold $true -Align 1 -SpaceAfter 10
    Add-Paragraph -Text 'по дисциплине «Web-программирование»' -Size 14 -Bold $false -Align 1 -SpaceAfter 10
    Add-Paragraph -Text 'на тему: «Разработка системы управления мероприятиями на Laravel»' -Size 14 -Bold $true -Align 1 -SpaceAfter 40

    Add-Paragraph -Text 'Объект разработки: веб-приложение для управления мероприятиями.' -Size 14 -Align 0 -SpaceAfter 6
    Add-Paragraph -Text 'Предмет разработки: проектирование БД, backend на Laravel, интерфейсы на Blade/Tailwind, аутентификация и авторизация.' -Size 14 -Align 0 -SpaceAfter 16

    Add-Paragraph -Text 'Брянск 2026' -Size 14 -Align 1 -SpaceAfter 18

    $word.Selection.InsertBreak(7) # wdPageBreak

    Add-Paragraph -Text 'ВВЕДЕНИЕ' -Size 16 -Bold $true -Align 1 -SpaceAfter 10
    Add-Paragraph -Text 'Цель работы — разработать веб-приложение на Laravel для автоматизации учета и управления мероприятиями, участниками, регистрациями и организаторами. В проекте реализованы ключевые возможности фреймворка Laravel: миграции, Eloquent-модели и связи, resource-контроллеры, Blade-представления, FormRequest-валидация, middleware, аутентификация и разграничение прав доступа.' -Size 14 -Align 3 -SpaceAfter 10

    Add-Paragraph -Text '1. АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ' -Size 15 -Bold $true -Align 0 -SpaceBefore 8 -SpaceAfter 8
    Add-Paragraph -Text 'Система предназначена для публикации мероприятий, регистрации участников и администрирования данных организаторами. Пользователи делятся на роли: admin, organizer, participant. Участники могут просматривать события, регистрироваться и отменять регистрацию. Организаторы управляют своими мероприятиями и рассылками. Администратор управляет всеми сущностями.' -Size 14 -Align 3 -SpaceAfter 10

    Add-Paragraph -Text '2. ПРОЕКТИРОВАНИЕ БАЗЫ ДАННЫХ' -Size 15 -Bold $true -Align 0 -SpaceBefore 8 -SpaceAfter 8
    Add-Paragraph -Text 'Основные таблицы:' -Size 14 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text '• organizers (name, contacts, website, description)' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• events (title, description, starts_at, venue, price, capacity, poster_path, organizer_id)' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• participants (full_name, email, phone, notes, user_id)' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• registrations (event_id, participant_id, registered_at, status)' -Size 14 -Align 0 -SpaceAfter 6
    Add-Paragraph -Text 'Связи в Eloquent: hasOne, hasMany, belongsTo, belongsToMany.' -Size 14 -Align 0 -SpaceAfter 10

    Add-Paragraph -Text '3. РЕАЛИЗАЦИЯ ПРИЛОЖЕНИЯ НА LARAVEL' -Size 15 -Bold $true -Align 0 -SpaceBefore 8 -SpaceAfter 8
    Add-Paragraph -Text 'Технологический стек: Laravel 12, PHP 8.4, SQLite, Blade, Tailwind CSS, Vite.' -Size 14 -Align 0 -SpaceAfter 6
    Add-Paragraph -Text 'Реализованы обязательные компоненты:' -Size 14 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text '• Модели и миграции с внешними ключами и ограничениями уникальности.' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Resource-контроллеры: EventController, OrganizerController, ParticipantController, RegistrationController.' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Дополнительные контроллеры: CalendarController, DashboardController, EventAnnouncementController.' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Формы CRUD и серверная валидация через FormRequest.' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Поиск, сортировка, пагинация, загрузка файлов афиши.' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Регистрация и вход пользователей (Laravel Breeze), авторизация по ролям через middleware.' -Size 14 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Календарь событий и отправка рассылок участникам мероприятия.' -Size 14 -Align 0 -SpaceAfter 10

    Add-Paragraph -Text '4. ТЕСТИРОВАНИЕ И ОТЛАДКА' -Size 15 -Bold $true -Align 0 -SpaceBefore 8 -SpaceAfter 8
    Add-Paragraph -Text 'Приложение протестировано feature-тестами Laravel (аутентификация, доступ по ролям, регистрация на события). Выполнена проверка маршрутов, валидации и сценариев CRUD. Устранены ошибки сессий (419) для локальной среды разработки.' -Size 14 -Align 3 -SpaceAfter 10

    Add-Paragraph -Text '5. ИНСТРУКЦИЯ ПО ЗАПУСКУ' -Size 15 -Bold $true -Align 0 -SpaceBefore 8 -SpaceAfter 8
    Add-Paragraph -Text 'Команды запуска проекта:' -Size 14 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text 'php artisan optimize:clear' -Size 13 -Align 0 -SpaceAfter 1
    Add-Paragraph -Text 'php artisan migrate:fresh --seed' -Size 13 -Align 0 -SpaceAfter 1
    Add-Paragraph -Text 'php artisan storage:link' -Size 13 -Align 0 -SpaceAfter 1
    Add-Paragraph -Text 'npm install && npm run build' -Size 13 -Align 0 -SpaceAfter 1
    Add-Paragraph -Text 'php artisan serve' -Size 13 -Align 0 -SpaceAfter 6
    Add-Paragraph -Text 'Демо-аккаунты: admin@events.local / organizer@events.local / participant@events.local, пароль: password.' -Size 14 -Align 0 -SpaceAfter 10

    Add-Paragraph -Text 'ЗАКЛЮЧЕНИЕ' -Size 16 -Bold $true -Align 1 -SpaceBefore 10 -SpaceAfter 8
    Add-Paragraph -Text 'В ходе работы разработано полноценное веб-приложение «Система управления мероприятиями» на Laravel. Реализованы все основные требования: связанные модели, контроллеры, Blade-интерфейсы, валидация, роли доступа, поиск, пагинация, загрузка файлов, календарь и рассылки. Проект готов к демонстрации и дальнейшему расширению.' -Size 14 -Align 3 -SpaceAfter 10

    Add-Paragraph -Text 'СПИСОК ИСТОЧНИКОВ' -Size 16 -Bold $true -Align 1 -SpaceBefore 8 -SpaceAfter 8
    Add-Paragraph -Text '1. Официальная документация Laravel: https://laravel.com/docs' -Size 13 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '2. Официальная документация PHP: https://www.php.net/docs.php' -Size 13 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '3. Документация Tailwind CSS: https://tailwindcss.com/docs' -Size 13 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '4. Документация SQLite: https://www.sqlite.org/docs.html' -Size 13 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '5. Документация Vite: https://vite.dev/guide/' -Size 13 -Align 0 -SpaceAfter 2

    $doc.SaveAs2($coursePath)
    $doc.Close()

    # 2) Poster document
    $poster = $word.Documents.Add()

    Add-Paragraph -Text 'АФИША МЕРОПРИЯТИЯ' -Size 28 -Bold $true -Align 1 -SpaceAfter 14
    Add-Paragraph -Text 'Конференция по веб-разработке' -Size 24 -Bold $true -Align 1 -SpaceAfter 10
    Add-Paragraph -Text 'Laravel • Архитектура • Тестирование • Практика' -Size 16 -Bold $false -Align 1 -SpaceAfter 18

    Add-Paragraph -Text 'Дата: 15 апреля 2026 г.' -Size 18 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text 'Время: 11:00' -Size 18 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text 'Место: Москва, Технопарк «Сириус»' -Size 18 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text 'Организатор: Агентство городских событий' -Size 18 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text 'Стоимость: 3500 RUB' -Size 18 -Bold $true -Align 0 -SpaceAfter 12

    Add-Paragraph -Text 'В программе:' -Size 18 -Bold $true -Align 0 -SpaceAfter 4
    Add-Paragraph -Text '• Современные возможности Laravel 12' -Size 16 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Проектирование БД и Eloquent-связи' -Size 16 -Align 0 -SpaceAfter 2
    Add-Paragraph -Text '• Реальная практика и ответы на вопросы' -Size 16 -Align 0 -SpaceAfter 10

    Add-Paragraph -Text 'Регистрация открыта!' -Size 22 -Bold $true -Align 1 -SpaceAfter 6
    Add-Paragraph -Text 'Сайт проекта: http://127.0.0.1:8000/events' -Size 14 -Bold $false -Align 1 -SpaceAfter 4
    Add-Paragraph -Text 'Контакты: organizer@events.local' -Size 14 -Bold $false -Align 1 -SpaceAfter 4

    $poster.SaveAs2($posterPath)
    $poster.Close()
}
finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output "CREATED: $coursePath"
Write-Output "CREATED: $posterPath"

