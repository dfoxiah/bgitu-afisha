/**
 * File responsibility:
 * Protected page to create a new event.
 *
 * Main logic:
 * - Guard access by role (TEACHER/ADMIN)
 * - Render shared EventForm component
 * - Submit create request via AppContext and redirect to events list
 *
 * Integrations:
 * - src/components/events/EventForm.tsx
 * - src/contexts/AppContext.tsx
 */
'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/contexts/AppContext'
import EventForm from '@/components/events/EventForm'
import { showToast } from '@/lib/toast'
import type { CreateEventDto } from '@/types/dto'
import { isContentManagerRole } from '@/lib/roles'

export default function CreateEventPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { createEvent } = useAppContext()

  const isTeacher = isContentManagerRole(session?.user?.role)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.replace('/login')
      return
    }

    if (!isTeacher) {
      router.replace('/events')
    }
  }, [status, session, isTeacher, router])

  if (status === 'loading' || !session || !isTeacher) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-gray-600 text-lg">Загрузка...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (formData: CreateEventDto) => {
    try {
      await createEvent(formData)
      showToast('Мероприятие создано', 'success')
      router.replace('/events')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Произошла ошибка при создании мероприятия', 'error')
    }
  }

  return (
    <div className="create-event-page page-shell min-h-screen px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="page-hero p-4 sm:p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/58">Events Builder</p>
            <h1 className="page-title mt-2 text-2xl font-semibold sm:text-4xl">Создание мероприятия</h1>
            <p className="mt-3 text-sm text-primary/66 sm:text-base">
              Заполните карточку события, назначьте руководителя, участников, группы и медиа. После сохранения мероприятие появится в общем списке.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button type="button" className="btn btn-secondary px-4 py-2.5 text-sm" onClick={() => router.push('/events')}>
                К списку событий
              </button>
            </div>
          </article>

          <aside className="liquid-section p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Чеклист публикации</h2>
            <ul className="mt-3 space-y-2 text-sm text-primary/68">
              <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">1. Укажите точные дату, время и место.</li>
              <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">2. Добавьте описание и категорию события.</li>
              <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">3. При необходимости назначьте модераторов.</li>
              <li className="rounded-lg border border-primary/12 bg-white/78 px-3 py-2">4. Прикрепите изображения для карточки.</li>
            </ul>
          </aside>
        </section>

        <EventForm
          variant="page"
          event={null}
          onClose={() => router.push('/events')}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
