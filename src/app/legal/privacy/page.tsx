export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-light-gray px-4 md:px-5% py-10">
      <div className="container mx-auto max-w-3xl bg-white/90 rounded-2xl shadow-xl p-6 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold text-primary mb-4">Политика конфиденциальности</h1>
        <p className="text-gray-600 mb-6">
          Этот документ описывает, какие персональные данные мы собираем, как их используем и как обеспечиваем
          безопасность. Политика применяется к сервису «БГИТУ Афиша».
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">1. Какие данные мы собираем</h2>
        <p className="text-gray-600 mb-4">
          Мы можем обрабатывать: имя, email, роль, кафедру/факультет, группу, аватар, а также технические данные
          о действиях в системе (аудит‑лог).
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">2. Цели обработки</h2>
        <p className="text-gray-600 mb-4">
          Данные используются для авторизации, управления мероприятиями, коммуникации с пользователями,
          обеспечения безопасности и выполнения требований внутренней отчётности.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">3. Правовые основания</h2>
        <p className="text-gray-600 mb-4">
          Обработка осуществляется с согласия пользователя и в рамках исполнения функций образовательной организации.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">4. Хранение и безопасность</h2>
        <p className="text-gray-600 mb-4">
          Мы применяем технические и организационные меры защиты: разграничение доступа, журналирование действий,
          ограничение прав доступа, контроль изменений.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">5. Передача третьим лицам</h2>
        <p className="text-gray-600 mb-4">
          Данные не передаются третьим лицам, за исключением случаев, предусмотренных законом и регламентами организации.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">6. Сроки хранения</h2>
        <p className="text-gray-600 mb-4">
          Данные хранятся только столько, сколько необходимо для целей обработки и соблюдения требований законодательства.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">7. Права пользователя</h2>
        <p className="text-gray-600 mb-4">
          Пользователь может запросить доступ к данным, их исправление и удаление в пределах применимого законодательства.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">8. Контакты</h2>
        <p className="text-gray-600">
          Для вопросов по персональным данным обратитесь к администрации БГИТУ.
        </p>
      </div>
    </div>
  )
}
