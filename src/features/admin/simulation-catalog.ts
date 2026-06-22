import type { AdminSimulationScenario } from "@/features/admin/types"

export const ADMIN_SIMULATION_SCENARIOS: AdminSimulationScenario[] = [
  {
    id: "public-feed",
    label: "Публичная афиша",
    description: "Проверяет, что на публичной витрине есть доступные ближайшие события.",
  },
  {
    id: "registration-flow",
    label: "Регистрация",
    description: "Проверяет, можно ли пройти сценарий записи на ближайшее публичное событие.",
  },
  {
    id: "telegram-auth",
    label: "Telegram-вход",
    description: "Проверяет готовность бота, deep-link и наличие уже привязанных пользователей.",
  },
  {
    id: "notification-delivery",
    label: "Доставка уведомлений",
    description: "Сверяет включенные каналы уведомлений с реальной готовностью доставки.",
  },
]
