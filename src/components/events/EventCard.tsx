/**
 * File responsibility:
 * Event list card component.
 *
 * Main logic:
 * - Render compact event information and moderation controls
 * - Apply optimistic participant moderation for pending requests
 *
 * Integrations:
 * - src/components/events/page.tsx
 * - src/contexts/AppContext.tsx
 */

"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useOptimistic, useState } from "react"
import { EventCategory } from "@prisma/client"
import { useAppContext } from "@/contexts/AppContext"
import { showToast } from "@/lib/toast"
import { CategoryDisplayMap, type Event, type User } from "@/types"

interface EventCardProps {
  event: Event
  onClick?: (event: Event) => void
  onEdit?: (event: Event) => void
  onComplete?: (event: Event) => void
}

type PendingAction = {
  type: "remove"
  userId: string
}

const applyPendingOptimisticAction = (state: User[], action: PendingAction): User[] => {
  if (action.type === "remove") {
    return state.filter((user) => user.id !== action.userId)
  }

  return state
}

export default function EventCard({ event, onClick, onEdit, onComplete }: EventCardProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { updateParticipantStatus } = useAppContext()

  const [imageError, setImageError] = useState(false)
  const [updatingParticipantId, setUpdatingParticipantId] = useState<string | null>(null)
  const [updatingAction, setUpdatingAction] = useState<"confirm" | "reject" | null>(null)

  const eventDate = event.date instanceof Date ? event.date : new Date(event.date)
  const isPast = event.isPast || eventDate < new Date()
  const isTeacher = session?.user?.role === "TEACHER" || session?.user?.role === "ADMIN"
  const moderatorIds = event.moderators?.map((moderator) => moderator.id) || []
  const canModerate =
    isTeacher &&
    (session?.user?.role === "ADMIN" ||
      event.creatorId === session?.user?.id ||
      moderatorIds.includes(session?.user?.id || ""))

  const categoryDisplayName = CategoryDisplayMap[event.category as EventCategory] || event.category
  const pendingParticipants = event.pendingParticipants || []

  const [optimisticPending, applyOptimisticPending] = useOptimistic(
    pendingParticipants,
    applyPendingOptimisticAction
  )

  const handleParticipantAction = async (userId: string, action: "confirm" | "reject") => {
    if (updatingParticipantId) return

    setUpdatingParticipantId(userId)
    setUpdatingAction(action)
    applyOptimisticPending({ type: "remove", userId })

    try {
      await updateParticipantStatus(event.id, userId, action)
    } catch (error) {
      console.error("Participant update error", error)
      showToast("Не удалось обновить статус участника", "error")
    } finally {
      setUpdatingParticipantId(null)
      setUpdatingAction(null)
    }
  }

  const placeholderImage = `https://placehold.co/600x400/6fa3f4/ffffff?text=${encodeURIComponent(
    event.title.substring(0, 20)
  )}`

  const getCategoryColor = (category: EventCategory) => {
    const colors: Record<EventCategory, string> = {
      [EventCategory.CONCERT]: "bg-sky-100 text-sky-700 border-sky-200",
      [EventCategory.INTERNAL_ACTIVITY]: "bg-blue-100 text-blue-700 border-blue-200",
      [EventCategory.PUBLIC_EVENT]: "bg-cyan-100 text-cyan-700 border-cyan-200",
      [EventCategory.COMPETITION]: "bg-indigo-100 text-indigo-700 border-indigo-200",
      [EventCategory.LECTURE]: "bg-violet-100 text-violet-700 border-violet-200",
      [EventCategory.MASTERCLASS]: "bg-teal-100 text-teal-700 border-teal-200",
      [EventCategory.VOLUNTEER]: "bg-slate-100 text-slate-700 border-slate-200",
      [EventCategory.NEWS]: "bg-sky-50 text-sky-700 border-sky-100",
    }

    return colors[category] || "bg-accent text-white border-accent"
  }

  return (
    <div
      className="event-card liquid-card liquid-card-hover flex h-full cursor-pointer flex-col overflow-hidden"
      onClick={() => (onClick ? onClick(event) : router.push(`/events/${event.id}`))}
    >
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gray-50 sm:h-48">
        <Image
          src={imageError || !event.images || event.images.length === 0 ? placeholderImage : event.images[0]}
          alt={event.title}
          fill
          sizes="(max-width: 640px) 100vw, 420px"
          className="object-contain"
          onError={() => setImageError(true)}
          unoptimized
        />

        <div className="absolute right-3 top-3">
          <span
            className={`rounded-full px-3 py-1 text-xs ${getCategoryColor(event.category as EventCategory)}`}
          >
            {categoryDisplayName}
          </span>
        </div>
      </div>

      <div className="flex flex-grow flex-col p-4 sm:p-5">
        <h3 className="event-card-title mb-2 line-clamp-2 text-base font-semibold text-gray-900 sm:mb-3 sm:text-lg">
          {event.title}
        </h3>

        <div className="event-card-meta mb-4 flex-grow space-y-2 text-xs text-gray-600 sm:text-sm">
          <div className="flex items-center gap-2">
            <i className="fas fa-calendar w-4 text-accent"></i>
            <span>{eventDate.toLocaleDateString("ru-RU")}</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="fas fa-clock w-4 text-accent"></i>
            <span>{event.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <i className="fas fa-map-marker-alt w-4 text-accent"></i>
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        {canModerate && !isPast && optimisticPending.length > 0 && (
          <div
            className="mb-4 rounded-2xl border border-white/70 bg-white/70 p-3 shadow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 text-xs uppercase text-sky-600">
              Ожидают подтверждения: {optimisticPending.length}
            </div>

            <div className="space-y-2">
              {optimisticPending.slice(0, 3).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm text-gray-700">{user.name || user.email}</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-700 transition-colors hover:bg-blue-200 disabled:opacity-60"
                      onClick={() => handleParticipantAction(user.id, "confirm")}
                      disabled={Boolean(updatingParticipantId)}
                    >
                      {updatingParticipantId === user.id && updatingAction === "confirm"
                        ? "..."
                        : "Принять"}
                    </button>
                    <button
                      className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700 transition-colors hover:bg-red-200 disabled:opacity-60"
                      onClick={() => handleParticipantAction(user.id, "reject")}
                      disabled={Boolean(updatingParticipantId)}
                    >
                      {updatingParticipantId === user.id && updatingAction === "reject"
                        ? "..."
                        : "Отклонить"}
                    </button>
                  </div>
                </div>
              ))}

              {optimisticPending.length > 3 && (
                <div className="text-xs text-gray-500">и ещё {optimisticPending.length - 3}</div>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
          <span
            className={`event-card-status rounded-full px-2.5 py-1 text-[10px] sm:px-3 sm:text-xs ${
              isPast ? "bg-gray-100 text-gray-600" : "bg-sky-50 text-sky-700"
            }`}
          >
            {isPast
              ? "Завершено"
              : `Участников: ${event.currentParticipants}${
                  event.maxParticipants > 0 ? `/${event.maxParticipants}` : ""
                }`}
          </span>

          {canModerate && !isPast && (
            <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
              <button
                className="edit-btn rounded-full bg-sky-100 px-2.5 py-1 text-[10px] text-sky-700 transition-colors hover:bg-sky-200 sm:px-3 sm:text-xs"
                onClick={() => onEdit?.(event)}
              >
                <i className="fas fa-edit mr-1"></i>
                Редактировать
              </button>
              <button
                className="complete-btn rounded-full bg-blue-100 px-2.5 py-1 text-[10px] text-blue-700 transition-colors hover:bg-blue-200 sm:px-3 sm:text-xs"
                onClick={() => onComplete?.(event)}
              >
                <i className="fas fa-check mr-1"></i>
                Завершить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
