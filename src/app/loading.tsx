/**
 * File responsibility:
 * Global loading state for App Router.
 */

import PageState from "@/components/ui/PageState"

export default function Loading() {
  return (
    <PageState
      title="Загрузка раздела..."
      subtitle="Подготавливаем данные и интерфейс."
      spinning
    />
  )
}
