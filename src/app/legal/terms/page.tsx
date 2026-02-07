export default function TermsPage() {
  return (
    <div className="min-h-screen bg-light-gray px-4 md:px-5% py-10">
      <div className="container mx-auto max-w-3xl bg-white/90 rounded-2xl shadow-xl p-6 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold text-primary mb-4">Пользовательское соглашение</h1>
        <p className="text-gray-600 mb-6">
          Настоящее соглашение определяет условия использования сервиса «БГИТУ Афиша». Регистрируясь, вы
          подтверждаете согласие с условиями.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">1. Общие положения</h2>
        <p className="text-gray-600 mb-4">
          Сервис предназначен для публикации и управления мероприятиями университета. Пользователь обязуется
          предоставлять достоверные данные и соблюдать правила использования.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">2. Права и обязанности пользователя</h2>
        <p className="text-gray-600 mb-4">
          Пользователь обязуется не нарушать работу сервиса, не публиковать запрещённый контент и соблюдать
          нормы законодательства. Доступ к функциям зависит от роли (студент, преподаватель, администратор).
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">3. Контент и ответственность</h2>
        <p className="text-gray-600 mb-4">
          Ответственность за достоверность информации о мероприятиях несут их создатели и модераторы.
          Администрация вправе удалять или изменять материалы, нарушающие правила.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">4. Персональные данные</h2>
        <p className="text-gray-600 mb-4">
          Обработка персональных данных осуществляется в соответствии с Политикой конфиденциальности.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">5. Изменения условий</h2>
        <p className="text-gray-600 mb-4">
          Администрация может обновлять условия соглашения. Новая редакция публикуется в сервисе.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">6. Контакты</h2>
        <p className="text-gray-600">
          По вопросам использования сервиса обращайтесь к администрации БГИТУ.
        </p>
      </div>
    </div>
  )
}
