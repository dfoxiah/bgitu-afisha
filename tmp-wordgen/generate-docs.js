const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle } = require('docx');

const desktop = path.join(process.env.USERPROFILE || 'C:\\Users\\user', 'Desktop');
const coursePath = path.join(desktop, 'Kursovaya_po_web_ФИНАЛ_Ларавел.docx');
const posterPath = path.join(desktop, 'Афиша_мероприятия_Ларавел.docx');

function p(text, opts = {}) {
  const {
    bold = false,
    size = 28,
    align = AlignmentType.LEFT,
    heading = undefined,
    spacingAfter = 140,
    spacingBefore = 0,
  } = opts;

  return new Paragraph({
    heading,
    alignment: align,
    spacing: { before: spacingBefore, after: spacingAfter },
    children: [new TextRun({ text, bold, size, font: 'Times New Roman' })],
  });
}

async function createCourseDoc() {
  const children = [
    p('КУРСОВАЯ РАБОТА', { bold: true, size: 34, align: AlignmentType.CENTER, spacingAfter: 120 }),
    p('по дисциплине «Web-программирование»', { align: AlignmentType.CENTER, spacingAfter: 80 }),
    p('Тема: «Разработка системы управления мероприятиями на Laravel»', { bold: true, align: AlignmentType.CENTER, spacingAfter: 320 }),

    p('ВВЕДЕНИЕ', { heading: HeadingLevel.HEADING_1, bold: true, align: AlignmentType.CENTER, spacingBefore: 120 }),
    p('Цель работы — разработать веб-приложение на Laravel для управления мероприятиями, участниками, регистрациями и организаторами. В проекте использованы ключевые возможности Laravel: миграции, Eloquent, resource-контроллеры, Blade, FormRequest, middleware, аутентификация и авторизация.'),

    p('1. АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ', { heading: HeadingLevel.HEADING_1, bold: true, spacingBefore: 120 }),
    p('Система предназначена для публикации мероприятий, онлайн-регистрации участников и управления событиями. Предусмотрены роли: admin, organizer и participant. Участники просматривают афишу и регистрируются, организаторы управляют событиями и рассылками, администратор управляет всеми сущностями.'),

    p('2. ПРОЕКТИРОВАНИЕ БАЗЫ ДАННЫХ', { heading: HeadingLevel.HEADING_1, bold: true, spacingBefore: 120 }),
    p('Таблицы и поля:'),
    p('• organizers: name, contacts, website, description'),
    p('• events: title, description, starts_at, venue, price, capacity, poster_path, organizer_id'),
    p('• participants: full_name, email, phone, notes, user_id'),
    p('• registrations: event_id, participant_id, registered_at, status'),
    p('Реализованы связи hasOne, hasMany, belongsTo, belongsToMany.'),

    p('3. РЕАЛИЗАЦИЯ НА LARAVEL 12', { heading: HeadingLevel.HEADING_1, bold: true, spacingBefore: 120 }),
    p('Технологии: Laravel 12, PHP 8.4, SQLite, Blade, Tailwind, Vite.'),
    p('Реализовано в проекте:'),
    p('• Resource-контроллеры для событий, участников, организаторов и регистраций.'),
    p('• Дополнительные контроллеры: календарь, дашборд, рассылка участникам.'),
    p('• Формы CRUD с серверной валидацией и отображением ошибок.'),
    p('• Поиск, сортировка, пагинация, загрузка афиши (изображения).'),
    p('• Аутентификация и разграничение прав доступа по ролям.'),

    p('4. ТЕСТИРОВАНИЕ И ОТЛАДКА', { heading: HeadingLevel.HEADING_1, bold: true, spacingBefore: 120 }),
    p('Выполнены feature-тесты Laravel для аутентификации, регистрации на мероприятия и проверки прав доступа. Проект стабилизирован для локальной среды, устранены ошибки сессий (в т.ч. 419).'),

    p('5. ИНСТРУКЦИЯ ПО ЗАПУСКУ', { heading: HeadingLevel.HEADING_1, bold: true, spacingBefore: 120 }),
    p('Команды запуска:'),
    p('php artisan optimize:clear'),
    p('php artisan migrate:fresh --seed'),
    p('php artisan storage:link'),
    p('npm install && npm run build'),
    p('php artisan serve'),
    p('Демо-аккаунты: admin@events.local / organizer@events.local / participant@events.local. Пароль: password.'),

    p('ЗАКЛЮЧЕНИЕ', { heading: HeadingLevel.HEADING_1, bold: true, align: AlignmentType.CENTER, spacingBefore: 120 }),
    p('В результате разработано полноценное веб-приложение «Система управления мероприятиями» на Laravel. Реализованы основные требования курсового проекта: связанные модели, контроллеры, представления, валидация, авторизация, поиск, пагинация, загрузка файлов, календарь и рассылки.'),

    p('СПИСОК ИСТОЧНИКОВ', { heading: HeadingLevel.HEADING_1, bold: true, align: AlignmentType.CENTER, spacingBefore: 120 }),
    p('1. Laravel Documentation: https://laravel.com/docs'),
    p('2. PHP Documentation: https://www.php.net/docs.php'),
    p('3. Tailwind CSS Documentation: https://tailwindcss.com/docs'),
    p('4. SQLite Documentation: https://www.sqlite.org/docs.html'),
    p('5. Vite Guide: https://vite.dev/guide/'),
  ];

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(coursePath, buffer);
}

async function createPosterDoc() {
  const hr = new Paragraph({
    border: {
      bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 8 },
    },
    spacing: { after: 220 },
  });

  const children = [
    p('АФИША', { bold: true, size: 54, align: AlignmentType.CENTER, spacingAfter: 80 }),
    p('Конференция по веб-разработке', { bold: true, size: 40, align: AlignmentType.CENTER, spacingAfter: 80 }),
    p('Laravel • Архитектура • Тестирование • Практика', { size: 28, align: AlignmentType.CENTER, spacingAfter: 160 }),
    hr,
    p('Дата: 15 апреля 2026', { bold: true, size: 32 }),
    p('Время: 11:00', { bold: true, size: 32 }),
    p('Место: Москва, Технопарк «Сириус»', { bold: true, size: 32 }),
    p('Организатор: Агентство городских событий', { bold: true, size: 32 }),
    p('Стоимость: 3500 RUB', { bold: true, size: 32, spacingAfter: 200 }),
    p('Регистрация открыта!', { bold: true, size: 42, align: AlignmentType.CENTER, spacingAfter: 80 }),
    p('Сайт: http://127.0.0.1:8000/events', { size: 28, align: AlignmentType.CENTER }),
    p('Контакты: organizer@events.local', { size: 28, align: AlignmentType.CENTER }),
  ];

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(posterPath, buffer);
}

(async () => {
  await createCourseDoc();
  await createPosterDoc();
  console.log('CREATED:', coursePath);
  console.log('CREATED:', posterPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
