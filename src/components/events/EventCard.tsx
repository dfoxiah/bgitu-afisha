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
import { startTransition, useOptimistic, useState } from "react"
import { EventCategory } from "@prisma/client"
import { useAppContext } from "@/contexts/AppContext"
import { showToast } from "@/lib/toast"
import { CategoryDisplayMap, type Event, type User } from "@/types"
import { isAdminRole, isContentManagerRole } from "@/lib/roles"

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
  const isTeacher = isContentManagerRole(session?.user?.role)
  const moderatorIds = event.moderators?.map((moderator) => moderator.id) || []
  const canModerate =
    isTeacher &&
    (isAdminRole(session?.user?.role) ||
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
    startTransition(() => {
      applyOptimisticPending({ type: "remove", userId })
    })

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

  const placeholderImage = `https://placehold.co/1200x800/1f5fe0/ffffff?text=${encodeURIComponent(
    event.title.substring(0, 22)
  )}`

  const getCategoryColor = (category: EventCategory) => {
    const colors: Record<EventCategory, string> = {
      [EventCategory.CONCERT]: "bg-blue-100 text-blue-700 border-blue-200",
      [EventCategory.INTERNAL_ACTIVITY]: "bg-indigo-100 text-indigo-700 border-indigo-200",
      [EventCategory.PUBLIC_EVENT]: "bg-cyan-100 text-cyan-700 border-cyan-200",
      [EventCategory.COMPETITION]: "bg-violet-100 text-violet-700 border-violet-200",
      [EventCategory.LECTURE]: "bg-sky-100 text-sky-700 border-sky-200",
      [EventCategory.MASTERCLASS]: "bg-amber-100 text-amber-700 border-amber-200",
      [EventCategory.VOLUNTEER]: "bg-emerald-100 text-emerald-700 border-emerald-200",
      [EventCategory.NEWS]: "bg-slate-100 text-slate-700 border-slate-200",
    }

    return colors[category] || "bg-accent/20 text-primary border-accent/35"
  }

  return (
    <article
      className="event-card liquid-card liquid-card-hover flex h-full cursor-pointer flex-col overflow-hidden"
      onClick={() => (onClick ? onClick(event) : router.push(`/events/${event.id}`))}
    >
      <div className="relative h-36 overflow-hidden border-b border-primary/10 sm:h-44">
        <Image
          src={imageError || !event.images || event.images.length === 0 ? placeholderImage : event.images[0]}
          alt={event.title}
          fill
          sizes="(max-width: 640px) 100vw, 420px"
          className="object-cover"
          onError={() => setImageError(true)}
          unoptimized
        />

        <div className="absolute inset-0 bg-gradient-to-b from-[#041126]/12 via-[#041126]/16 to-[#041126]/62" />

        <div className="absolute left-3 top-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getCategoryColor(event.category as EventCategory)}`}>
            {categoryDisplayName}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 text-xs font-medium text-white/92">
          <i className="fas fa-calendar-days mr-2" />
          {eventDate.toLocaleDateString("ru-RU")}
        </div>
      </div>

      <div className="flex flex-grow flex-col p-4 sm:p-5">
        <h3 className="mb-3 line-clamp-2 text-lg font-semibold text-primary">{event.title}</h3>

        <div className="mb-4 flex-grow space-y-2 text-xs text-primary/72 sm:text-sm">
          <div className="flex items-center gap-2">
            <i className="fas fa-clock w-4 text-accent" />
            <span>{event.time}</span>
          </div>

          <div className="flex items-center gap-2">
            <i className="fas fa-location-dot w-4 text-accent" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        {canModerate && !isPast && optimisticPending.length > 0 && (
          <div
            className="mb-4 rounded-2xl border border-primary/16 bg-white/[0.9] p-3 shadow-[0_10px_22px_rgba(16,37,77,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary/70">
              Ожидают подтверждения: {optimisticPending.length}
            </div>

            <div className="space-y-2">
              {optimisticPending.slice(0, 3).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm text-primary/75">{user.name || user.email}</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-200 disabled:opacity-60"
                      onClick={() => handleParticipantAction(user.id, "confirm")}
                      disabled={Boolean(updatingParticipantId)}
                    >
                      {updatingParticipantId === user.id && updatingAction === "confirm" ? "..." : "Принять"}
                    </button>
                    <button
                      className="rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs text-rose-700 transition-colors hover:bg-rose-200 disabled:opacity-60"
                      onClick={() => handleParticipantAction(user.id, "reject")}
                      disabled={Boolean(updatingParticipantId)}
                    >
                      {updatingParticipantId === user.id && updatingAction === "reject" ? "..." : "Отклонить"}
                    </button>
                  </div>
                </div>
              ))}

              {optimisticPending.length > 3 && <div className="text-xs text-primary/55">и ещё {optimisticPending.length - 3}</div>}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-primary/12 pt-4">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] sm:px-3 sm:text-xs ${
              isPast ? "border border-primary/16 bg-primary/8 text-primary/70" : "border border-secondary/45 bg-secondary/20 text-primary"
            }`}
          >
            {isPast ? "Завершено" : `Участников: ${event.currentParticipants}${event.maxParticipants > 0 ? `/${event.maxParticipants}` : ""}`}
          </span>

          {canModerate && !isPast && (
            <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
              <button
                className="edit-btn rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] text-primary transition-colors hover:bg-primary/20 sm:px-3 sm:text-xs"
                onClick={() => onEdit?.(event)}
              >
                <i className="fas fa-pen mr-1" />
                Редактировать
              </button>
              <button
                className="complete-btn rounded-full border border-accent/45 bg-accent/20 px-2.5 py-1 text-[10px] text-primary transition-colors hover:bg-accent/35 sm:px-3 sm:text-xs"
                onClick={() => onComplete?.(event)}
              >
                <i className="fas fa-check mr-1" />
                Завершить
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
