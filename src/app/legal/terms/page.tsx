/**
 * File responsibility:
 * Public terms of service page.
 *
 * Main logic:
 * - Describe usage rules and responsibilities for the platform
 *
 * Integrations:
 * - src/components/layout/Footer.tsx legal links
 */

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-light-gray px-4 py-10 md:px-[5%]">
      <div className="container mx-auto max-w-3xl rounded-2xl bg-white/90 p-6 shadow-xl md:p-10">
        <h1 className="mb-4 text-2xl font-bold text-primary md:text-3xl">
          Пользовательское соглашение
        </h1>
        <p className="mb-6 text-gray-600">
          Настоящее соглашение определяет условия использования сервиса «БГИТУ Афиша».
          Регистрируясь, вы подтверждаете согласие с условиями.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">1. Общие положения</h2>
        <p className="mb-4 text-gray-600">
          Сервис предназначен для публикации и управления мероприятиями университета.
          Пользователь обязуется предоставлять достоверные данные и соблюдать правила
          использования.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">
          2. Права и обязанности пользователя
        </h2>
        <p className="mb-4 text-gray-600">
          Пользователь обязуется не нарушать работу сервиса, не публиковать запрещенный контент и
          соблюдать нормы законодательства. Доступ к функциям зависит от роли (студент,
          преподаватель, администратор).
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">3. Контент и ответственность</h2>
        <p className="mb-4 text-gray-600">
          Ответственность за достоверность информации о мероприятиях несут их создатели и
          модераторы. Администрация вправе удалять или изменять материалы, нарушающие правила.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">4. Персональные данные</h2>
        <p className="mb-4 text-gray-600">
          Обработка персональных данных осуществляется в соответствии с Политикой
          конфиденциальности.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">5. Изменения условий</h2>
        <p className="mb-4 text-gray-600">
          Администрация может обновлять условия соглашения. Новая редакция публикуется в сервисе.
        </p>

        <h2 className="mb-2 text-xl font-semibold text-gray-800">6. Контакты</h2>
        <p className="text-gray-600">
          По вопросам использования сервиса обращайтесь к администрации БГИТУ.
        </p>
      </div>
    </div>
  )
}