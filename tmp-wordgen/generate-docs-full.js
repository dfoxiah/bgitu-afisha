const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  PageBreak,
  LineRuleType,
} = require('docx');

const desktop = path.join(process.env.USERPROFILE || 'C:\\Users\\user', 'Desktop');
const coursePath = path.join(desktop, 'Kursovaya_po_web_ФИНАЛ_Ларавел.docx');
const posterPath = path.join(desktop, 'Афиша_мероприятия_Ларавел.docx');
const coursePath2 = path.join(desktop, 'kursovaya_laravel_wordsave.docx');
const posterPath2 = path.join(desktop, 'afisha_laravel_wordsave.docx');

function para(text, opts = {}) {
  const {
    bold = false,
    size = 28,
    align = AlignmentType.LEFT,
    heading,
    spacingAfter = 140,
    spacingBefore = 0,
    line = 360,
    firstLine = 0,
    font = 'Times New Roman',
  } = opts;

  return new Paragraph({
    heading,
    alignment: align,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line,
      lineRule: LineRuleType.AUTO,
    },
    indent: firstLine ? { firstLine } : undefined,
    children: [new TextRun({ text, bold, size, font })],
  });
}

function h1(text) {
  return para(text, {
    heading: HeadingLevel.HEADING_1,
    bold: true,
    size: 30,
    spacingBefore: 220,
    spacingAfter: 120,
  });
}

function h2(text) {
  return para(text, {
    heading: HeadingLevel.HEADING_2,
    bold: true,
    size: 28,
    spacingBefore: 140,
    spacingAfter: 100,
  });
}

function codeLine(text) {
  return para(text, {
    size: 24,
    spacingAfter: 40,
    line: 300,
    font: 'Consolas',
  });
}

function pageBreak() {
  return new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] });
}

async function buildCourse() {
  const children = [];

  // Title page
  children.push(para('МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РФ', { align: AlignmentType.CENTER, spacingAfter: 60 }));
  children.push(para('ФГБОУ ВО «Брянский государственный инженерно-технологический университет»', { align: AlignmentType.CENTER, spacingAfter: 60 }));
  children.push(para('Кафедра «Информационные технологии»', { align: AlignmentType.CENTER, spacingAfter: 500 }));

  children.push(para('КУРСОВАЯ РАБОТА', { align: AlignmentType.CENTER, bold: true, size: 34, spacingAfter: 120 }));
  children.push(para('по дисциплине «Web-программирование»', { align: AlignmentType.CENTER, size: 28, spacingAfter: 120 }));
  children.push(para('на тему: «Разработка системы управления мероприятиями на Laravel»', {
    align: AlignmentType.CENTER,
    bold: true,
    size: 30,
    spacingAfter: 600,
  }));

  children.push(para('Выполнил: студент группы ИВТ-301 ______________________', { spacingAfter: 40 }));
  children.push(para('Проверил: ______________________', { spacingAfter: 400 }));
  children.push(para('Брянск 2026', { align: AlignmentType.CENTER, spacingAfter: 120 }));

  children.push(pageBreak());

  // Contents
  children.push(para('СОДЕРЖАНИЕ', { align: AlignmentType.CENTER, bold: true, size: 34, spacingAfter: 220 }));
  children.push(para('ВВЕДЕНИЕ ........................................................................................................ 3'));
  children.push(para('1 АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ ............................................................ 5'));
  children.push(para('1.1 Постановка задачи ...................................................................................... 5'));
  children.push(para('1.2 Функциональные требования ...................................................................... 6'));
  children.push(para('1.3 Нефункциональные требования .................................................................. 7'));
  children.push(para('2 ПРОЕКТИРОВАНИЕ СИСТЕМЫ ..................................................................... 9'));
  children.push(para('2.1 Выбор технологического стека .................................................................... 9'));
  children.push(para('2.2 Проектирование базы данных .................................................................... 10'));
  children.push(para('2.3 Архитектура Laravel-приложения ............................................................. 12'));
  children.push(para('3 РЕАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ...................................................................... 14'));
  children.push(para('3.1 Миграции, модели и связи ........................................................................ 14'));
  children.push(para('3.2 Контроллеры, маршруты и middleware .................................................... 16'));
  children.push(para('3.3 Представления, формы и валидация ...................................................... 18'));
  children.push(para('3.4 Календарь, регистрация и рассылки ........................................................ 20'));
  children.push(para('4 ТЕСТИРОВАНИЕ И ОТЛАДКА ...................................................................... 22'));
  children.push(para('5 ИНСТРУКЦИЯ ПО ЗАПУСКУ ........................................................................ 24'));
  children.push(para('ЗАКЛЮЧЕНИЕ ..................................................................................................... 25'));
  children.push(para('СПИСОК ИСТОЧНИКОВ ..................................................................................... 26'));
  children.push(para('ПРИЛОЖЕНИЕ А (фрагменты кода) ................................................................. 27'));

  children.push(pageBreak());

  // Introduction
  children.push(para('ВВЕДЕНИЕ', { heading: HeadingLevel.HEADING_1, align: AlignmentType.CENTER, bold: true, size: 34, spacingAfter: 180 }));
  children.push(para('Актуальность темы обусловлена необходимостью автоматизации процессов подготовки и проведения мероприятий. В учебных, культурных и деловых организациях часто используются разрозненные инструменты (таблицы, мессенджеры, отдельные формы регистрации), что снижает прозрачность и управляемость процесса.', { firstLine: 720 }));
  children.push(para('Цель курсовой работы — разработать веб-приложение «Система управления мероприятиями» с использованием фреймворка Laravel, охватывающее основные возможности платформы: работу с базой данных через Eloquent ORM, маршрутизацию, контроллеры, шаблоны Blade, валидацию, аутентификацию и авторизацию.', { firstLine: 720 }));
  children.push(para('Объект исследования — процесс организации и сопровождения мероприятий. Предмет исследования — методы и средства разработки веб-приложений для управления событиями и регистрациями пользователей.', { firstLine: 720 }));
  children.push(para('Практическая значимость работы заключается в создании готового приложения, пригодного для демонстрации, учебной защиты и дальнейшего расширения (например, интеграции платежей, уведомлений и внешних календарей).', { firstLine: 720 }));

  // Chapter 1
  children.push(h1('1 АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ'));
  children.push(h2('1.1 Постановка задачи'));
  children.push(para('Необходимо реализовать информационную систему, в которой присутствуют четыре базовые сущности: мероприятия, участники, регистрации и организаторы. Система должна обеспечивать полный цикл CRUD-операций, поиск, фильтрацию, разграничение прав доступа и ведение календаря событий.', { firstLine: 720 }));
  children.push(para('Результатом работы должна стать веб-система с удобным интерфейсом и предсказуемой бизнес-логикой. Пользователь должен иметь возможность зарегистрироваться в системе, выполнить вход, просматривать события и выполнять действия в зависимости от роли.', { firstLine: 720 }));

  children.push(h2('1.2 Функциональные требования'));
  const fReq = [
    'управление мероприятиями (создание, просмотр, редактирование, удаление);',
    'управление участниками и организаторами;',
    'регистрация участника на мероприятие и отмена регистрации;',
    'ведение статусов регистрации (pending, confirmed, cancelled);',
    'поиск и сортировка мероприятий;',
    'пагинация списков;',
    'загрузка афиши мероприятия;',
    'календарное представление событий;',
    'рассылка участникам конкретного мероприятия.',
  ];
  fReq.forEach((x) => children.push(para(`• ${x}`)));

  children.push(h2('1.3 Нефункциональные требования'));
  const nfReq = [
    'использование Laravel 12.x и PHP 8.1+;',
    'работа с SQLite/MySQL/PostgreSQL (в проекте — SQLite);',
    'адаптивный веб-интерфейс на Blade + Tailwind;',
    'серверная валидация пользовательских данных;',
    'защищённый доступ к данным по ролям;',
    'подготовка проекта к автоматизированному тестированию.',
  ];
  nfReq.forEach((x) => children.push(para(`• ${x}`)));

  // Chapter 2
  children.push(h1('2 ПРОЕКТИРОВАНИЕ СИСТЕМЫ'));
  children.push(h2('2.1 Выбор технологического стека'));
  children.push(para('В качестве backend-фреймворка выбран Laravel 12, так как он предоставляет встроенные механизмы маршрутизации, ORM, middleware, шаблонизатор Blade и инструменты для тестирования. Это позволяет реализовать весь цикл разработки в рамках единой платформы.', { firstLine: 720 }));
  children.push(para('Для интерфейса выбран Tailwind CSS в составе Laravel Breeze. Это решение ускоряет разработку форм и страниц CRUD, сохраняя возможность детальной настройки внешнего вида.', { firstLine: 720 }));

  children.push(h2('2.2 Проектирование базы данных'));
  children.push(para('Структура базы данных включает таблицы users, organizers, participants, events, registrations. Основные связи:', { firstLine: 720 }));
  children.push(para('• organizer 1:N events;'));
  children.push(para('• event 1:N registrations;'));
  children.push(para('• participant 1:N registrations;'));
  children.push(para('• event N:M participants через registrations.'));
  children.push(para('Такой подход обеспечивает целостность данных и удобную агрегацию статистики (например, число активных регистраций и ожидаемая выручка).', { firstLine: 720 }));

  children.push(h2('2.3 Архитектура Laravel-приложения'));
  children.push(para('Архитектура построена по MVC-подходу. Модели отвечают за доступ к данным и связи. Контроллеры реализуют бизнес-логику и подготавливают данные для представлений. Blade-шаблоны отвечают за отображение.', { firstLine: 720 }));
  children.push(para('Для доступа по ролям используется middleware role. Это позволяет централизованно ограничивать маршруты: административные разделы доступны только роли admin, блок управления регистрациями — admin и organizer.', { firstLine: 720 }));

  // Chapter 3
  children.push(h1('3 РЕАЛИЗАЦИЯ ПРИЛОЖЕНИЯ'));
  children.push(h2('3.1 Миграции, модели и связи'));
  children.push(para('В миграциях созданы внешние ключи, индексы и ограничения уникальности. Для сущности registrations установлено уникальное сочетание (event_id, participant_id), что исключает дублирование регистраций одного участника на одно и то же событие.', { firstLine: 720 }));
  children.push(para('В моделях Eloquent настроены отношения hasOne/hasMany/belongsTo/belongsToMany. Для модели Event реализован метод hasAvailableSlots(), который проверяет наличие свободных мест с учетом подтверждённых и ожидающих заявок.', { firstLine: 720 }));

  children.push(h2('3.2 Контроллеры, маршруты и middleware'));
  children.push(para('Реализованы resource-контроллеры EventController, OrganizerController, ParticipantController, RegistrationController. Дополнительно созданы DashboardController (сводная статистика), CalendarController (месячный календарь), EventAnnouncementController (email-рассылки).', { firstLine: 720 }));
  children.push(para('Маршруты разделены по уровням доступа. Публично доступны список мероприятий и календарь. Действия регистрации требуют авторизации. Управление сущностями ограничено ролями.', { firstLine: 720 }));

  children.push(h2('3.3 Представления, формы и валидация'));
  children.push(para('Интерфейс реализован на Blade с общим layout и компонентами (flash-сообщения, бейджи статуса). Для каждой сущности реализованы страницы index/create/edit/show. Формы снабжены выводом ошибок валидации.', { firstLine: 720 }));
  children.push(para('Серверная валидация реализована через FormRequest-классы: Store/Update для событий, участников, организаторов и регистраций, а также отдельная валидация для рассылки.', { firstLine: 720 }));

  children.push(h2('3.4 Календарь, регистрация и рассылки'));
  children.push(para('Календарь строится помесячно: отображаются дни недели, события группируются по датам, доступна навигация между месяцами. На странице мероприятия реализованы регистрация и отмена регистрации.', { firstLine: 720 }));
  children.push(para('Для рассылок используется отправка писем участникам выбранного мероприятия через почтовый транспорт Laravel. Отправка доступна организатору события и администратору.', { firstLine: 720 }));

  // Chapter 4
  children.push(h1('4 ТЕСТИРОВАНИЕ И ОТЛАДКА'));
  children.push(para('Для проверки корректности работы использованы feature-тесты Laravel. Проверены сценарии аутентификации, регистрации участников на события, а также доступ к маршрутам в зависимости от роли пользователя.', { firstLine: 720 }));
  children.push(para('Тестирование подтвердило корректность бизнес-логики: дублирующие регистрации блокируются, статусы обновляются корректно, доступ к административным разделам для неавторизованных или неподходящих ролей запрещён.', { firstLine: 720 }));
  children.push(para('В процессе отладки устранены проблемы с локальной сессией (ошибка 419), приведены в порядок настройки APP_URL/SESSION и обновлена версия Node.js для стабильной сборки Vite.', { firstLine: 720 }));

  // Chapter 5
  children.push(h1('5 ИНСТРУКЦИЯ ПО ЗАПУСКУ'));
  children.push(para('Последовательность запуска проекта:', { firstLine: 720 }));
  children.push(codeLine('php artisan optimize:clear'));
  children.push(codeLine('php artisan migrate:fresh --seed'));
  children.push(codeLine('php artisan storage:link'));
  children.push(codeLine('npm install'));
  children.push(codeLine('npm run build'));
  children.push(codeLine('php artisan serve'));
  children.push(para('Адрес приложения: http://127.0.0.1:8000', { firstLine: 720 }));
  children.push(para('Демо-доступ: admin@events.local, organizer@events.local, participant@events.local; пароль: password.', { firstLine: 720 }));

  // Conclusion
  children.push(h1('ЗАКЛЮЧЕНИЕ'));
  children.push(para('В ходе выполнения курсовой работы разработано веб-приложение для управления мероприятиями на Laravel. Полученное решение соответствует техническим требованиям и демонстрирует применение ключевых инструментов фреймворка в реальном проекте.', { firstLine: 720 }));
  children.push(para('Реализованы модели и миграции, контроллеры, маршруты, шаблоны, валидация, аутентификация, авторизация, поиск, пагинация, загрузка файлов, календарь и рассылки. Проект может использоваться как учебный стенд и как база для дальнейшего развития.', { firstLine: 720 }));

  // Sources
  children.push(h1('СПИСОК ИСТОЧНИКОВ'));
  const sources = [
    'Laravel Documentation. URL: https://laravel.com/docs (дата обращения: 01.03.2026).',
    'PHP Documentation. URL: https://www.php.net/docs.php (дата обращения: 01.03.2026).',
    'Tailwind CSS Documentation. URL: https://tailwindcss.com/docs (дата обращения: 01.03.2026).',
    'SQLite Documentation. URL: https://www.sqlite.org/docs.html (дата обращения: 01.03.2026).',
    'Vite Documentation. URL: https://vite.dev/guide/ (дата обращения: 01.03.2026).',
    'RFC 9110 HTTP Semantics. URL: https://www.rfc-editor.org/rfc/rfc9110 (дата обращения: 01.03.2026).',
  ];
  sources.forEach((s, i) => children.push(para(`${i + 1}. ${s}`)));

  // Appendix
  children.push(h1('ПРИЛОЖЕНИЕ А (ФРАГМЕНТЫ КОДА)'));
  children.push(para('Пример команд и сценариев для демонстрации на защите:'));
  children.push(codeLine('php artisan route:list --except-vendor'));
  children.push(codeLine('php artisan test'));
  children.push(codeLine('npm run build'));
  children.push(para('Пример структуры сущности event: title, description, starts_at, venue, price, capacity, poster_path, organizer_id.'));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 567, bottom: 1134, left: 1361 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(coursePath, buffer);
  fs.writeFileSync(coursePath2, buffer);
}

async function buildPoster() {
  const hr = new Paragraph({
    border: {
      bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 14 },
    },
    spacing: { after: 260 },
  });

  const children = [
    para('АФИША', { align: AlignmentType.CENTER, bold: true, size: 64, spacingAfter: 80 }),
    para('КОНФЕРЕНЦИЯ ПО ВЕБ-РАЗРАБОТКЕ', { align: AlignmentType.CENTER, bold: true, size: 42, spacingAfter: 80 }),
    para('Laravel • Архитектура • Тестирование • Практика', { align: AlignmentType.CENTER, size: 30, spacingAfter: 180 }),
    hr,
    para('Дата: 15 апреля 2026 года', { bold: true, size: 34 }),
    para('Время: 11:00', { bold: true, size: 34 }),
    para('Место: Москва, Технопарк «Сириус»', { bold: true, size: 34 }),
    para('Организатор: Агентство городских событий', { bold: true, size: 34 }),
    para('Стоимость участия: 3500 RUB', { bold: true, size: 34, spacingAfter: 220 }),
    para('В ПРОГРАММЕ', { align: AlignmentType.CENTER, bold: true, size: 40, spacingAfter: 120 }),
    para('• Практика разработки приложений на Laravel 12', { size: 30 }),
    para('• Проектирование БД и Eloquent-связи', { size: 30 }),
    para('• Регистрация пользователей и разграничение прав доступа', { size: 30 }),
    para('• Интерактивный календарь мероприятий и email-рассылки', { size: 30, spacingAfter: 220 }),
    para('РЕГИСТРАЦИЯ ОТКРЫТА', { align: AlignmentType.CENTER, bold: true, size: 46, spacingAfter: 80 }),
    para('Сайт: http://127.0.0.1:8000/events', { align: AlignmentType.CENTER, size: 30, spacingAfter: 60 }),
    para('Контакты: organizer@events.local', { align: AlignmentType.CENTER, size: 30 }),
  ];

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(posterPath, buffer);
  fs.writeFileSync(posterPath2, buffer);
}

(async () => {
  await buildCourse();
  await buildPoster();
  console.log('CREATED:', coursePath);
  console.log('CREATED:', posterPath);
})();
