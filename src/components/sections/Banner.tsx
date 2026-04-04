/**
 * File responsibility:
 * Dashboard banner section with highlighted upcoming events.
 *
 * Main logic:
 * - Render hero-like highlighted event cards.
 * - Provide quick CTA/navigation to details.
 *
 * Integrations:
 * - Dashboard page
 * - Event card data from AppContext
 */
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Event } from "@/types"
import { getCategoryIcon } from "@/utils/eventCategoryIcons"

interface BannerProps {
  events: Event[]
}

const Banner = ({ events }: BannerProps) => {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (events.length <= 1) return

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % events.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [events.length])

  if (events.length === 0) return null

  const activeEvent = events[currentSlide]

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-primary/18 bg-[#0f2348] shadow-[0_20px_36px_rgba(13,29,58,0.24)]">
      {events.map((event, index) => {
        const hasImage = event.images && event.images.length > 0
        const imageUrl = hasImage ? event.images[0] : null

        return (
          <div
            key={event.id}
            className={`absolute inset-0 transition-opacity duration-500 ${index === currentSlide ? "opacity-100" : "opacity-0"}`}
          >
            {imageUrl ? (
              <>
                <div className="absolute inset-0 scale-105 bg-cover bg-center blur-sm" style={{ backgroundImage: `url(${imageUrl})` }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#102d60] via-[#1f5fe0] to-[#2f8df3]">
                <i className={`fas ${getCategoryIcon(event.category)} text-8xl text-white/70`} />
              </div>
            )}
          </div>
        )
      })}

      <div className="absolute inset-0 bg-gradient-to-r from-[#071429]/92 via-[#071429]/76 to-[#071429]/44" />

      <div className="relative z-10 grid min-h-[14rem] gap-3 p-3 sm:p-4 lg:grid-cols-[1.25fr_320px] lg:p-5">
        <div className="flex flex-col justify-between">
          <div>
            <span className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/92">
              Главное событие
            </span>
            <h2 className="mt-3 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-4xl">{activeEvent.title}</h2>
            <p className="mt-3 text-sm text-white/88 sm:text-base">
              {new Date(activeEvent.date).toLocaleDateString("ru-RU")} • {activeEvent.time} • {activeEvent.location}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/45 bg-white px-4 py-2 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5"
              onClick={() => router.push(`/events/${activeEvent.id}`)}
            >
              Открыть карточку
            </button>

            {events.length > 1 && (
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/40 bg-white/15 text-white transition-colors hover:bg-white/25"
                  onClick={() => setCurrentSlide((prev) => (prev - 1 + events.length) % events.length)}
                  aria-label="Предыдущий слайд"
                >
                  <i className="fas fa-chevron-left text-[11px]" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/40 bg-white/15 text-white transition-colors hover:bg-white/25"
                  onClick={() => setCurrentSlide((prev) => (prev + 1) % events.length)}
                  aria-label="Следующий слайд"
                >
                  <i className="fas fa-chevron-right text-[11px]" />
                </button>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/20 bg-white/12 p-3 backdrop-blur-md sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/78">Афиша недели</p>
          <div className="mt-3 space-y-2">
            {events.slice(0, 4).map((event, index) => (
              <button
                key={event.id}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                  index === currentSlide
                    ? "border-white/55 bg-white/22 text-white"
                    : "border-white/18 bg-white/10 text-white/82 hover:border-white/38"
                }`}
                onClick={() => setCurrentSlide(index)}
              >
                <p className="line-clamp-1 text-sm font-semibold">{event.title}</p>
                <p className="mt-1 text-[11px] text-white/74">{new Date(event.date).toLocaleDateString("ru-RU")}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

export default Banner

