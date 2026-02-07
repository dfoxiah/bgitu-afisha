'use client'

import { useSession } from 'next-auth/react'
import { useAppContext } from '@/contexts/AppContext'
import CalendarSection from '@/components/sections/CalendarSection'

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const { events } = useAppContext()

  if (status === 'loading') {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-accent mx-auto"></div>
          <p className="text-gray-600 text-lg">Загрузка календаря...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
          <p className="text-gray-600 text-lg">Вы не авторизованы</p>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-page px-4 md:px-5% py-8">
      <div className="container mx-auto">
        <CalendarSection events={events} />
      </div>
    </div>
  )
}
