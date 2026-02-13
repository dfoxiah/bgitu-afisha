/**
 * File responsibility:
 * Public privacy policy page.
 *
 * Main logic:
 * - Describe personal data processing principles in product context
 *
 * Integrations:
 * - src/components/layout/Footer.tsx legal links
 */

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-light-gray px-4 py-10 md:px-[5%]">
      <div className="container mx-auto max-w-3xl rounded-2xl bg-white/90 p-6 shadow-xl md:p-10">
        <h1 className="mb-4 text-2xl font-bold text-primary md:text-3xl">
          Политика конфиденциальности
        </h1>
        <p className="mb-6 text-gray-600">
          Этот документ описывает, какие персональные данные мы собираем, как их используем и как
          обеспечиваем безопасность. Политика применяется к сервису «БГИТУ Афиша».
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">1. Какие данные мы собираем</h2>
        <p className="mb-4 text-gray-600">
          Мы можем обрабатывать: имя, email, роль, кафедру/факультет, группу, аватар, а также
          технические данные о действиях в системе (аудит-лог).
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">2. Цели обработки</h2>
        <p className="mb-4 text-gray-600">
          Данные используются для авторизации, управления мероприятиями, коммуникации с
          пользователями, обеспечения безопасности и выполнения требований внутренней отчетности.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">3. Правовые основания</h2>
        <p className="mb-4 text-gray-600">
          Обработка осуществляется с согласия пользователя и в рамках исполнения функций
          образовательной организации.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">4. Хранение и безопасность</h2>
        <p className="mb-4 text-gray-600">
          Мы применяем технические и организационные меры защиты: разграничение доступа,
          журналирование действий, ограничение прав доступа, контроль изменений.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">5. Передача третьим лицам</h2>
        <p className="mb-4 text-gray-600">
          Данные не передаются третьим лицам, за исключением случаев, предусмотренных законом и
          регламентами организации.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">6. Сроки хранения</h2>
        <p className="mb-4 text-gray-600">
          Данные хранятся только столько, сколько необходимо для целей обработки и соблюдения
          требований законодательства.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">7. Права пользователя</h2>
        <p className="mb-4 text-gray-600">
          Пользователь может запросить доступ к данным, их исправление и удаление в пределах
          применимого законодательства.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">8. Контакты</h2>
        <p className="text-gray-600">
          Для вопросов по персональным данным обратитесь к администрации БГИТУ.
        </p>
      </div>
    </div>
  )
}