'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useAppContext } from '@/contexts/AppContext'
import EventForm from '@/components/events/EventForm'
import { showToast } from '@/lib/toast'

export default function CreateEventPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { createEvent } = useAppContext()

  const isTeacher = session?.user?.role === 'TEACHER' || session?.user?.role === 'ADMIN'

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
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-accent mx-auto"></div>
          <p className="text-gray-600 text-lg">Загрузка...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (formData: any) => {
    try {
      await createEvent(formData)
      router.replace('/events')
    } catch (error) {
      console.error('Ошибка создания мероприятия:', error)
      showToast('Произошла ошибка при создании мероприятия', 'error')
    }
  }

  return (
    <EventForm
      event={null}
      onClose={() => router.push('/events')}
      onSubmit={handleSubmit}
    />
  )
}


