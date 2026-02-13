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
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Event } from '@/types'
import { getCategoryIcon } from '@/utils/eventCategoryIcons'

interface BannerProps {
  events: Event[]
}

const Banner = ({ events }: BannerProps) => {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (events.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % events.length)
      }, 5000)
      
      return () => clearInterval(timer)
    }
  }, [events.length])

  if (events.length === 0) return null

  return (
    <section className="banner relative h-64 sm:h-72 lg:h-96 overflow-hidden rounded-2xl mx-4 sm:mx-[5%] my-4 border border-white/60 shadow-2xl">
      {events.map((event, index) => {
        const hasImage = event.images && event.images.length > 0
        const imageUrl = hasImage ? event.images[0] : null

        return (
          <div 
            key={event.id}
            className={`banner-slide absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {imageUrl ? (
              <>
                <div
                  className="absolute inset-0 bg-center bg-cover scale-110 blur-sm"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                ></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={event.title}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center">
                <i className={`fas ${getCategoryIcon(event.category)} text-6xl sm:text-7xl lg:text-8xl text-white/80`}></i>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/35 to-black/70"></div>
            <div className="banner-content absolute bottom-0 left-0 right-0 p-5 sm:p-8 text-white">
              <h2 className="banner-title text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">{event.title}</h2>
              <p className="banner-text text-sm sm:text-lg mb-4 sm:mb-5">
                {new Date(event.date).toLocaleDateString('ru-RU')} • {event.location}
              </p>
              <button 
                className="banner-btn bg-white text-primary px-5 sm:px-7 py-2.5 sm:py-3 rounded-3xl text-sm sm:text-base font-semibold hover:bg-gray-100 transition-colors"
                onClick={() => router.push(`/events/${event.id}`)}
              >
                Подробнее
              </button>
            </div>
          </div>
        )
      })}
      
      {events.length > 1 && (
        <>
          <button 
            className="banner-arrow prev-arrow hidden sm:flex absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-white/80 rounded-full items-center justify-center text-primary opacity-80 hover:opacity-100 transition-opacity shadow-custom"
            onClick={() => setCurrentSlide((prev) => (prev - 1 + events.length) % events.length)}
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          
          <button 
            className="banner-arrow next-arrow hidden sm:flex absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-white/80 rounded-full items-center justify-center text-primary opacity-80 hover:opacity-100 transition-opacity shadow-custom"
            onClick={() => setCurrentSlide((prev) => (prev + 1) % events.length)}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
          
          <div className="banner-nav absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {events.map((_, index) => (
              <button
                key={index}
                className={`banner-dot w-3 h-3 rounded-full transition-all ${
                  index === currentSlide ? 'bg-white scale-125' : 'bg-white/50'
                }`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Перейти к слайду ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default Banner

