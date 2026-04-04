const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  LineRuleType,
  TableOfContents,
  BorderStyle,
  TabStopType,
  TabStopPosition,
} = require('docx');

const desktop = path.join(process.env.USERPROFILE || 'C:\\Users\\user', 'Desktop');
const outCourseRu = path.join(desktop, 'Kursovaya_po_web_ФИНАЛ_Ларавел.docx');
const outPosterRu = path.join(desktop, 'Афиша_мероприятия_Ларавел.docx');
const outCourseEn = path.join(desktop, 'kursovaya_laravel_wordsave.docx');
const outPosterEn = path.join(desktop, 'afisha_laravel_wordsave.docx');

function p(text, opts = {}) {
  const {
    size = 28,
    bold = false,
    align = AlignmentType.LEFT,
    spacingAfter = 120,
    spacingBefore = 0,
    firstLine = 0,
    line = 360,
    heading,
    tabs,
    font = 'Times New Roman',
  } = opts;

  return new Paragraph({
    heading,
    alignment: align,
    tabStops: tabs,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line,
      lineRule: LineRuleType.AUTO,
    },
    indent: firstLine ? { firstLine } : undefined,
    children: [
      new TextRun({
        text,
        bold,
        size,
        font,
      }),
    ],
  });
}

function code(text) {
  return p(text, {
    size: 22,
    font: 'Consolas',
    spacingAfter: 40,
    line: 300,
  });
}

function h1(text) {
  return p(text, {
    heading: HeadingLevel.HEADING_1,
    bold: true,
    size: 32,
    spacingBefore: 220,
    spacingAfter: 130,
  });
}

function h2(text) {
  return p(text, {
    heading: HeadingLevel.HEADING_2,
    bold: true,
    size: 30,
    spacingBefore: 180,
    spacingAfter: 110,
  });
}

function pageBreakParagraph() {
  return new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] });
}

function addList(children, items, indent = 0) {
  items.forEach((item) => {
    children.push(p(`• ${item}`, { firstLine: indent, spacingAfter: 70 }));
  });
}

async function buildCourse() {
  const c = [];

  // Титульный лист
  c.push(p('МИНИСТЕРСТВО НАУКИ И ВЫСШЕГО ОБРАЗОВАНИЯ РОССИЙСКОЙ ФЕДЕРАЦИИ', { align: AlignmentType.CENTER, spacingAfter: 50 }));
  c.push(p('ФЕДЕРАЛЬНОЕ ГОСУДАРСТВЕННОЕ БЮДЖЕТНОЕ ОБРАЗОВАТЕЛЬНОЕ УЧРЕЖДЕНИЕ', { align: AlignmentType.CENTER, spacingAfter: 50 }));
  c.push(p('ВЫСШЕГО ОБРАЗОВАНИЯ', { align: AlignmentType.CENTER, spacingAfter: 50 }));
  c.push(p('«Брянский государственный инженерно-технологический университет»', { align: AlignmentType.CENTER, spacingAfter: 120 }));
  c.push(p('Кафедра «Информационные технологии»', { align: AlignmentType.CENTER, spacingAfter: 420 }));

  c.push(p('КУРСОВАЯ РАБОТА', { align: AlignmentType.CENTER, bold: true, size: 36, spacingAfter: 90 }));
  c.push(p('по дисциплине «Web-программирование»', { align: AlignmentType.CENTER, size: 30, spacingAfter: 90 }));
  c.push(p('на тему:', { align: AlignmentType.CENTER, size: 30, spacingAfter: 50 }));
  c.push(p('«Разработка системы управления мероприятиями на Laravel»', { align: AlignmentType.CENTER, bold: true, size: 32, spacingAfter: 420 }));

  c.push(p('Автор работы: _____________________________', { spacingAfter: 30 }));
  c.push(p('Группа: ИВТ-401', { spacingAfter: 30 }));
  c.push(p('Руководитель: _____________________________', { spacingAfter: 30 }));
  c.push(p('Нормоконтроль: ____________________________', { spacingAfter: 220 }));
  c.push(p('Брянск 2026', { align: AlignmentType.CENTER, spacingAfter: 120 }));

  // Содержание
  c.push(pageBreakParagraph());
  c.push(p('СОДЕРЖАНИЕ', { align: AlignmentType.CENTER, bold: true, size: 36, spacingAfter: 140 }));
  c.push(new TableOfContents(' ', {
    headingStyleRange: '1-2',
    hyperlink: true,
    rightTabStop: 9000,
  }));

  // Введение
  c.push(pageBreakParagraph());
  c.push(p('ВВЕДЕНИЕ', { heading: HeadingLevel.HEADING_1, align: AlignmentType.CENTER, bold: true, size: 34, spacingAfter: 160 }));
  c.push(p('Актуальность темы связана с необходимостью цифровизации процессов организации мероприятий. В традиционном подходе данные о событиях, участниках и регистрациях часто хранятся в разрозненных таблицах и переписках, что увеличивает риск ошибок, дублирования и потери информации. Использование централизованного веб-приложения решает эти проблемы и позволяет автоматизировать ключевые операции.', { firstLine: 720 }));
  c.push(p('Цель курсовой работы — разработать веб-приложение «Система управления мероприятиями» с использованием Laravel 12, охватывающее базовые и прикладные возможности фреймворка: миграции, модели и связи, ресурсные контроллеры, Blade-шаблоны, серверную валидацию, авторизацию по ролям, поиск, пагинацию, работу с файлами, календарь и email-рассылки.', { firstLine: 720 }));
  c.push(p('Для достижения цели были поставлены следующие задачи:', { firstLine: 720 }));
  addList(c, [
    'выполнить анализ предметной области и выделить сущности и бизнес-процессы;',
    'спроектировать базу данных и связи между сущностями;',
    'реализовать backend-логику приложения на Laravel;',
    'создать интерфейсы CRUD-операций и формы ввода данных;',
    'реализовать аутентификацию и разграничение прав доступа;',
    'добавить календарь событий, регистрацию участников и рассылки;',
    'провести тестирование и отладку системы.',
  ]);
  c.push(p('Объект исследования — процесс управления мероприятиями в образовательной и организационной среде. Предмет исследования — методы и инструменты построения веб-информационных систем на базе Laravel.', { firstLine: 720 }));

  // Глава 1
  c.push(h1('1 АНАЛИЗ ПРЕДМЕТНОЙ ОБЛАСТИ И ПОСТАНОВКА ЗАДАЧИ'));
  c.push(h2('1.1 Анализ предметной области'));
  c.push(p('Система управления мероприятиями должна охватывать жизненный цикл события: публикация, регистрация участников, контроль статусов заявок, коммуникация с зарегистрированными пользователями и анализ текущей загрузки мероприятия. Основными заинтересованными сторонами являются администратор системы, организатор мероприятия и участник.', { firstLine: 720 }));
  c.push(p('Администратор отвечает за целостность данных, управление справочниками организаторов и участников, контроль прав доступа и общую модерацию. Организатор отвечает за контент события, сроки, описание, место проведения, лимит мест и рассылку уведомлений. Участник регистрируется на события, отслеживает свои заявки и получает информационные письма.', { firstLine: 720 }));
  c.push(p('Таким образом, предметная область характеризуется следующими бизнес-процессами:')), addList(c, [
    'создание и актуализация карточек мероприятий;',
    'ведение справочника организаторов и участников;',
    'учет заявок с контролем статусов;',
    'ограничение количества мест и проверка доступности;',
    'групповая рассылка уведомлений зарегистрированным участникам;',
    'календарное отображение плана событий.',
  ]);

  c.push(h2('1.2 Функциональные и нефункциональные требования'));
  c.push(p('К функциональным требованиям относятся:')); addList(c, [
    'добавление, редактирование, просмотр и удаление мероприятий;',
    'добавление, редактирование и удаление организаторов;',
    'добавление, редактирование и удаление участников;',
    'создание, изменение и удаление регистраций;',
    'регистрация пользователя на мероприятие и отмена заявки;',
    'фильтрация и поиск по ключевым данным;',
    'постраничный вывод длинных списков;',
    'загрузка изображений афиш;',
    'отображение событий в формате календаря;',
    'отправка email-рассылок участникам конкретного события.',
  ]);
  c.push(p('К нефункциональным требованиям относятся:')); addList(c, [
    'Laravel версии 12.x и выше;',
    'PHP версии 8.1 и выше;',
    'СУБД SQLite / MySQL / PostgreSQL (в проекте используется SQLite);',
    'адаптивность интерфейса для настольных и мобильных устройств;',
    'защита данных и доступов на уровне middleware и проверок ролей;',
    'возможность автоматизированного тестирования ключевых сценариев.',
  ]);

  c.push(h2('1.3 Обоснование выбора технологического стека'));
  c.push(p('Выбор Laravel обусловлен высокой зрелостью фреймворка, единообразием архитектурных подходов и наличием встроенных механизмов, необходимых для курсового проекта. Laravel предоставляет: Eloquent ORM для работы с БД, миграции для версионирования схемы, Blade для серверного рендеринга, FormRequest для валидации, а также удобный стек тестирования.', { firstLine: 720 }));
  c.push(p('Для фронтенда использован Tailwind CSS, интегрированный через Vite и Laravel Breeze. Такой набор обеспечивает быстрый старт, структурированный UI и контроль над стилями без избыточной сложности.', { firstLine: 720 }));

  // Глава 2
  c.push(h1('2 ПРОЕКТИРОВАНИЕ И АРХИТЕКТУРА СИСТЕМЫ'));
  c.push(h2('2.1 Проектирование базы данных'));
  c.push(p('Логическая модель данных включает пять ключевых таблиц: users, organizers, participants, events, registrations. Таблица users хранит учетные записи и роль пользователя. Таблица organizers связана с users по user_id (опциональная связь один к одному для роли organizer). Таблица participants аналогично связывается с users для роли participant.', { firstLine: 720 }));
  c.push(p('Таблица events содержит основную информацию о мероприятии: title, description, starts_at, venue, price, capacity, poster_path и внешний ключ organizer_id. Таблица registrations реализует ассоциативную связь между events и participants и хранит атрибуты отношения: registered_at и status.', { firstLine: 720 }));
  c.push(p('Для исключения дублей введено уникальное ограничение (event_id, participant_id). Для ускорения запросов предусмотрены индексы по starts_at и status. Такая структура поддерживает как CRUD-операции, так и аналитические выборки.', { firstLine: 720 }));

  c.push(h2('2.2 Архитектурные слои Laravel-приложения'));
  c.push(p('Архитектура проекта построена по шаблону MVC: модели инкапсулируют работу с данными, контроллеры обрабатывают HTTP-запросы, представления формируют HTML-ответ. Дополнительно используются FormRequest-классы для декларативной валидации и middleware для авторизационных проверок.', { firstLine: 720 }));
  c.push(p('Ключевые контроллеры проекта:'), { firstLine: 720 });
  addList(c, [
    'EventController — управление мероприятиями, регистрацией и отменой регистрации;',
    'OrganizerController — администрирование организаторов;',
    'ParticipantController — администрирование участников;',
    'RegistrationController — управление статусами и связями event-participant;',
    'CalendarController — формирование календарного представления;',
    'DashboardController — агрегированная статистика;',
    'EventAnnouncementController — отправка рассылок по участникам события.',
  ]);

  c.push(h2('2.3 Ролевая модель и безопасность'));
  c.push(p('Ролевая модель включает три типа пользователей: admin, organizer, participant. Для разграничения доступа реализовано middleware role, которое ограничивает набор доступных маршрутов. Например, разделы organizers и participants доступны только admin, а раздел registrations — admin и organizer.', { firstLine: 720 }));
  c.push(p('Безопасность форм обеспечивается CSRF-защитой, встроенной в Laravel. Дополнительно используется серверная валидация всех входных данных, что предотвращает запись некорректных значений в базу данных.', { firstLine: 720 }));

  // Глава 3
  c.push(h1('3 РЕАЛИЗАЦИЯ ФУНКЦИОНАЛА ПРИЛОЖЕНИЯ'));
  c.push(h2('3.1 Модели и миграции'));
  c.push(p('На этапе реализации созданы миграции для всех сущностей предметной области. В миграциях определены типы полей, внешние ключи, индексы и ограничения. Пример: в таблице events поле price имеет тип decimal(10,2), а поле starts_at — datetime.', { firstLine: 720 }));
  c.push(p('В моделях настроены связи Eloquent:'), { firstLine: 720 });
  addList(c, [
    'Organizer hasMany Event;',
    'Event belongsTo Organizer;',
    'Participant hasMany Registration;',
    'Registration belongsTo Event и belongsTo Participant;',
    'Event belongsToMany Participant через registrations;',
    'Participant belongsToMany Event через registrations.',
  ]);
  c.push(p('Для модели Event реализована проверка вместимости hasAvailableSlots(), которая учитывает количество активных заявок и лимит мест.', { firstLine: 720 }));

  c.push(h2('3.2 Контроллеры и маршруты'));
  c.push(p('Маршрутизация построена с использованием resource-маршрутов для основных сущностей. Публичные разделы (список событий и календарь) доступны без авторизации. Операции регистрации и управления данными требуют входа в систему и соответствующей роли.', { firstLine: 720 }));
  c.push(p('Поиск и сортировка реализованы на уровне запросов Eloquent с применением условий where/whereHas/orderBy. Пагинация организована методом paginate() с сохранением параметров через withQueryString().', { firstLine: 720 }));

  c.push(h2('3.3 Представления Blade, формы и валидация'));
  c.push(p('Интерфейс приложения реализован через Blade-шаблоны и общий layout. Для повторно используемых элементов созданы Blade-компоненты (flash-message, status-badge и др.). Страницы CRUD представлены для всех базовых сущностей.', { firstLine: 720 }));
  c.push(p('Валидация ввода вынесена в специализированные FormRequest-классы. Для мероприятий контролируются дата, цена, вместимость и формат загружаемой афиши. Для регистраций валидируется статус и существование связанных сущностей.', { firstLine: 720 }));

  c.push(h2('3.4 Календарь, регистрация и рассылки'));
  c.push(p('Календарь реализован помесячным представлением с разбивкой по неделям. Пользователь может переключаться между месяцами, просматривать события по дням и переходить к карточке выбранного мероприятия.', { firstLine: 720 }));
  c.push(p('На странице мероприятия участник может зарегистрироваться или отменить регистрацию. Для предотвращения дублей используется проверка существующей активной регистрации и уникальный ключ на уровне БД.', { firstLine: 720 }));
  c.push(p('Рассылка участникам реализована через EventAnnouncementController. Система выбирает email-адреса зарегистрированных участников с активными статусами и выполняет отправку сообщения с заданной темой.', { firstLine: 720 }));

  c.push(h2('3.5 Поиск, пагинация и загрузка файлов'));
  c.push(p('Поиск выполнен по полям title/description/venue и связанному организатору. Сортировка предусмотрена по дате и цене. Для больших выборок используется пагинация с выводом навигации.', { firstLine: 720 }));
  c.push(p('Загрузка афиши выполняется в публичное хранилище Laravel storage/app/public с доступом через symbolic link public/storage. При обновлении карточки мероприятия старая афиша удаляется, чтобы исключить накопление неактуальных файлов.', { firstLine: 720 }));

  // Глава 4
  c.push(h1('4 ТЕСТИРОВАНИЕ И ОТЛАДКА'));
  c.push(h2('4.1 Методика тестирования'));
  c.push(p('Тестирование проводилось в формате feature-тестов Laravel и ручной верификации пользовательских сценариев. Проверялись корректность маршрутов, переходов, валидации, а также соответствие прав доступа ролям пользователей.', { firstLine: 720 }));

  c.push(h2('4.2 Проверенные сценарии'));
  addList(c, [
    'рендеринг форм входа и регистрации;',
    'успешная и неуспешная авторизация;',
    'создание и отмена регистрации участника на событие;',
    'блокировка дублирующей регистрации;',
    'доступ администратора к административным разделам;',
    'запрет доступа участника к административным маршрутам;',
    'доступ организатора к управлению регистрациями и запрет к разделам admin-only.',
  ]);

  c.push(h2('4.3 Результаты'));
  c.push(p('По итогам тестирования подтверждена стабильная работа основных модулей. Автотесты завершаются успешно (30 passed). Система корректно обрабатывает ограничения ролей, не допускает дублирования регистраций и предоставляет предсказуемый пользовательский опыт.', { firstLine: 720 }));
  c.push(p('На этапе отладки устранены проблемы локальной среды: ошибки сессий (419) и предупреждения сборщика Vite, связанные с версией Node.js. Окружение обновлено до Node.js 22.22.0.', { firstLine: 720 }));

  // Глава 5
  c.push(h1('5 ИНСТРУКЦИЯ ПО ЗАПУСКУ ПРОЕКТА'));
  c.push(p('Для локального запуска необходимо выполнить последовательность команд:', { firstLine: 720 }));
  code('cd D:\\JS\\bgitu-afisha\\laravel-event-manager');
  code('php artisan optimize:clear');
  code('php artisan migrate:fresh --seed');
  code('php artisan storage:link');
  code('npm install');
  code('npm run build');
  code('php artisan serve');
  c.push(p('После запуска приложение доступно по адресу http://127.0.0.1:8000.', { firstLine: 720 }));
  c.push(p('Демонстрационные учетные записи:'), { firstLine: 720 });
  addList(c, [
    'admin@events.local (роль admin);',
    'organizer@events.local (роль organizer);',
    'participant@events.local (роль participant);',
    'пароль для всех: password.',
  ]);

  // Заключение
  c.push(h1('ЗАКЛЮЧЕНИЕ'));
  c.push(p('Выполнена разработка и отладка веб-приложения «Система управления мероприятиями» на Laravel в соответствии с требованиями курсовой работы. Реализованы все обязательные компоненты: модели и миграции, контроллеры, представления, валидация, коллекции, аутентификация и авторизация, поиск, пагинация, загрузка файлов и дополнительные прикладные модули.', { firstLine: 720 }));
  c.push(p('Полученное решение демонстрирует практическое применение современных подходов веб-разработки и может быть использовано как база для дальнейшего расширения: интеграции push-уведомлений, экспортов отчетов, платежных модулей и внешних календарей.', { firstLine: 720 }));

  // Источники
  c.push(h1('СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ'));
  const sources = [
    'Laravel Documentation. URL: https://laravel.com/docs (дата обращения: 01.03.2026).',
    'Laravel Breeze Documentation. URL: https://laravel.com/docs/starter-kits (дата обращения: 01.03.2026).',
    'Laravel Eloquent ORM. URL: https://laravel.com/docs/eloquent (дата обращения: 01.03.2026).',
    'Laravel Validation. URL: https://laravel.com/docs/validation (дата обращения: 01.03.2026).',
    'Laravel Mail. URL: https://laravel.com/docs/mail (дата обращения: 01.03.2026).',
    'Laravel Testing. URL: https://laravel.com/docs/testing (дата обращения: 01.03.2026).',
    'PHP Documentation. URL: https://www.php.net/docs.php (дата обращения: 01.03.2026).',
    'SQLite Documentation. URL: https://www.sqlite.org/docs.html (дата обращения: 01.03.2026).',
    'Tailwind CSS Documentation. URL: https://tailwindcss.com/docs (дата обращения: 01.03.2026).',
    'Vite Documentation. URL: https://vite.dev/guide/ (дата обращения: 01.03.2026).',
    'RFC 9110 HTTP Semantics. URL: https://www.rfc-editor.org/rfc/rfc9110 (дата обращения: 01.03.2026).',
    'OWASP Cheat Sheet Series. URL: https://cheatsheetseries.owasp.org/ (дата обращения: 01.03.2026).',
    'Nielsen J. Usability Engineering. Morgan Kaufmann, 1994.',
    'Sommerville I. Software Engineering. 10th Edition. Pearson, 2015.',
    'Fowler M. Patterns of Enterprise Application Architecture. Addison-Wesley, 2002.',
  ];
  sources.forEach((s, i) => c.push(p(`${i + 1}. ${s}`)));

  // Приложение
  c.push(h1('ПРИЛОЖЕНИЕ А (ЛИСТИНГИ КЛЮЧЕВЫХ ФРАГМЕНТОВ)'));
  c.push(p('Листинг А.1 — команды развёртывания', { bold: true }));
  code('php artisan optimize:clear');
  code('php artisan migrate:fresh --seed');
  code('php artisan storage:link');
  code('npm run build');
  code('php artisan serve');

  c.push(p('Листинг А.2 — пример маршрутов web.php', { bold: true, spacingBefore: 140 }));
  code("Route::get('/events', [EventController::class, 'index'])->name('events.index');");
  code("Route::middleware(['auth','verified'])->group(function () {");
  code("  Route::resource('events', EventController::class)->except(['index','show']);");
  code("  Route::resource('registrations', RegistrationController::class);");
  code("});");

  c.push(p('Листинг А.3 — пример связи в моделях Eloquent', { bold: true, spacingBefore: 140 }));
  code('public function organizer(): BelongsTo {');
  code('    return $this->belongsTo(Organizer::class);');
  code('}');

  c.push(p('Листинг А.4 — пример проверки роли middleware', { bold: true, spacingBefore: 140 }));
  code('if (! $user || ! $user->hasRole(...$roles)) {');
  code('    abort(403);');
  code('}');

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 567, bottom: 1134, left: 1361 },
        },
      },
      children: c,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outCourseRu, buffer);
  fs.writeFileSync(outCourseEn, buffer);
}

async function buildPoster() {
  const line = new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, color: '000000', size: 12, space: 1 },
    },
    spacing: { after: 260 },
  });

  const c = [];
  c.push(p('АФИША', { align: AlignmentType.CENTER, bold: true, size: 66, spacingAfter: 90 }));
  c.push(p('КОНФЕРЕНЦИЯ ПО ВЕБ-РАЗРАБОТКЕ', { align: AlignmentType.CENTER, bold: true, size: 42, spacingAfter: 80 }));
  c.push(p('«СИСТЕМА УПРАВЛЕНИЯ МЕРОПРИЯТИЯМИ НА LARAVEL»', { align: AlignmentType.CENTER, bold: true, size: 34, spacingAfter: 180 }));
  c.push(line);

  c.push(p('Дата: 15 апреля 2026 года', { bold: true, size: 34, spacingAfter: 70 }));
  c.push(p('Время: 11:00 — 17:00', { bold: true, size: 34, spacingAfter: 70 }));
  c.push(p('Место: Москва, Технопарк «Сириус»', { bold: true, size: 34, spacingAfter: 70 }));
  c.push(p('Организатор: Агентство городских событий', { bold: true, size: 34, spacingAfter: 70 }));
  c.push(p('Стоимость участия: 3500 RUB', { bold: true, size: 34, spacingAfter: 220 }));

  c.push(p('В ПРОГРАММЕ:', { align: AlignmentType.CENTER, bold: true, size: 42, spacingAfter: 120 }));
  addList(c, [
    'Архитектура Laravel 12 и структура проекта;',
    'Миграции, модели и Eloquent-связи;',
    'Ресурсные контроллеры и маршрутизация;',
    'Blade, валидация форм и работа с файлами;',
    'Календарь событий, регистрация участников и рассылки;',
    'Тестирование и практические рекомендации по отладке.',
  ]);

  c.push(p('РЕГИСТРАЦИЯ ОТКРЫТА', { align: AlignmentType.CENTER, bold: true, size: 48, spacingBefore: 180, spacingAfter: 90 }));
  c.push(p('Сайт: http://127.0.0.1:8000/events', { align: AlignmentType.CENTER, size: 30, spacingAfter: 50 }));
  c.push(p('Контакты: organizer@events.local', { align: AlignmentType.CENTER, size: 30, spacingAfter: 50 }));
  c.push(p('Телефон: +7 (900) 123-45-67', { align: AlignmentType.CENTER, size: 30, spacingAfter: 50 }));

  const doc = new Document({ sections: [{ children: c }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPosterRu, buffer);
  fs.writeFileSync(outPosterEn, buffer);
}

(async () => {
  await buildCourse();
  await buildPoster();
  console.log('CREATED:', outCourseRu);
  console.log('CREATED:', outPosterRu);
})();
