/**
 * File responsibility:
 * Dashboard section for latest news/report cards.
 *
 * Main logic:
 * - Display news subset and sorting.
 * - Provide links to full news/event details.
 *
 * Integrations:
 * - Dashboard/news routes
 * - Event news collections
 */
"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { EventCategory } from "@prisma/client"
import ImageGalleryModal from "@/components/ui/ImageGalleryModal"
import { Event } from "@/types"
import { getCategoryIcon } from "@/utils/eventCategoryIcons"

interface NewsSectionProps {
  events: Event[]
  plain?: boolean
}

const NewsSection = ({ events = [], plain = false }: NewsSectionProps) => {
  const router = useRouter()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryTitle, setGalleryTitle] = useState("")

  const newsEvents = useMemo(
    () =>
      events
        .filter((event) => event.isNews || (event.report && event.isPast))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [events]
  )

  const getGallery = (event: Event) => {
    if (event.report?.images && event.report.images.length > 0) return event.report.images
    return event.images || []
  }

  const getCover = (event: Event) => {
    const gallery = getGallery(event)
    return gallery.length > 0 ? gallery[0] : ""
  }

  const openGallery = (images: string[], index: number, title?: string) => {
    if (!images || images.length === 0) return
    setGalleryImages(images)
    setGalleryIndex(index)
    setGalleryTitle(title || "Просмотр фото")
    setGalleryOpen(true)
  }

  return (
    <section className={plain ? "" : "liquid-section p-4 sm:p-5"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Новостная лента</h2>
          <p className="mt-1 text-sm text-primary/62">Отчёты, фото и итоги прошедших мероприятий.</p>
        </div>

        <span className="liquid-chip px-3 py-1 text-xs font-semibold uppercase tracking-[0.09em] text-primary/62">
          {newsEvents.length} материалов
        </span>
      </div>

      {newsEvents.length === 0 ? (
        <div className="liquid-card py-8 text-center text-primary/62">
          <i className="fas fa-newspaper mb-3 text-4xl" />
          <p>Пока нет новостей.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-primary/12 bg-white/82">
          {newsEvents.map((event, index) => {
            const gallery = getGallery(event)
            const cover = getCover(event)

            return (
              <article
                key={event.id}
                className={`grid cursor-pointer gap-3 p-3 transition-colors hover:bg-primary/5 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-start ${
                  index !== newsEvents.length - 1 ? "border-b border-primary/12" : ""
                }`}
                onClick={() => router.push(`/events/${event.id}`)}
              >
                <div className="relative h-24 overflow-hidden border border-primary/12 bg-gradient-to-br from-[#12326c] via-[#1f5fe0] to-[#2386da] sm:h-20">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={event.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/80">
                      <i className={`fas ${getCategoryIcon(event.category as EventCategory)} text-xl`} />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/55">
                    {new Date(event.date).toLocaleDateString("ru-RU")}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-primary sm:text-base">{event.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-primary/65 sm:text-sm">
                    {event.report?.summary || event.description || "Подробности мероприятия..."}
                  </p>
                </div>

                <div className="flex items-start gap-2 sm:flex-col sm:items-end">
                  {gallery.length > 0 && (
                    <button
                      type="button"
                      className="rounded-full border border-primary/14 bg-white/86 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary"
                      onClick={(e) => {
                        e.stopPropagation()
                        openGallery(gallery, 0, event.title)
                      }}
                    >
                      Фото ({gallery.length})
                    </button>
                  )}
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/14 bg-white/86 text-primary/55">
                    <i className="fas fa-arrow-up-right-from-square text-[10px]" />
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <ImageGalleryModal
        isOpen={galleryOpen}
        images={galleryImages}
        startIndex={galleryIndex}
        title={galleryTitle}
        onClose={() => setGalleryOpen(false)}
      />
    </section>
  )
}

export default NewsSection

