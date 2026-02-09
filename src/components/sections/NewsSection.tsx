'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Event } from '@/types'
import ImageGalleryModal from '@/components/ui/ImageGalleryModal'

interface NewsSectionProps {
  events: Event[]
}

const NewsSection = ({ events = [] }: NewsSectionProps) => {
  const router = useRouter()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryTitle, setGalleryTitle] = useState('')

  const newsEvents = useMemo(() => 
    events
      .filter(event => event.isNews || (event.report && event.isPast))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    [events]
  )

  if (newsEvents.length === 0) {
    return (
      <section className="news-section liquid-section p-5 sm:p-6 lg:p-8 mx-4 sm:mx-5% my-4">
        <h2 className="section-title text-lg sm:text-2xl text-primary mb-5 sm:mb-6 flex items-center gap-3">
          <i className="fas fa-newspaper"></i> Новостная лента
        </h2>
        <div className="text-center py-8 sm:py-12 text-gray-500">
          <i className="fas fa-newspaper text-4xl sm:text-5xl mb-3 sm:mb-4"></i>
          <p className="text-base sm:text-xl">Пока нет новостей</p>
        </div>
      </section>
    )
  }

  const handleNewsClick = (event: Event) => {
    router.push(`/events/${event.id}`)
  }

  const openGallery = (images: string[], index: number, title?: string) => {
    if (!images || images.length === 0) return
    setGalleryImages(images)
    setGalleryIndex(index)
    setGalleryTitle(title || 'Просмотр фото')
    setGalleryOpen(true)
  }

  return (
    <section className="news-section liquid-section p-5 sm:p-6 lg:p-8 mx-4 sm:mx-5% my-4">
      <h2 className="section-title text-lg sm:text-2xl text-primary mb-5 sm:mb-6 flex items-center gap-3">
        <i className="fas fa-newspaper"></i> Новостная лента
      </h2>
      
      <div className="news-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {newsEvents.map(event => {
          const galleryImages = event.report?.images && event.report.images.length > 0
            ? event.report.images
            : (event.images || [])
          const imageUrl = event.images && event.images.length > 0 
            ? event.images[0] 
            : event.report?.images && event.report.images.length > 0
            ? event.report.images[0]
            : `https://placehold.co/600x400/4b86b4/ffffff?text=${encodeURIComponent(event.title.substring(0, 20))}`
          
          return (
            <div 
              key={event.id} 
              className="news-card liquid-card liquid-card-hover overflow-hidden cursor-pointer"
              onClick={() => handleNewsClick(event)}
            >
              <div 
                className="news-image h-40 sm:h-48 bg-cover bg-center relative"
                style={{ 
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${imageUrl})`
                }}
              >
                {galleryImages.length > 0 && (
                  <button
                    type="button"
                    className="absolute left-3 bottom-3 bg-black/60 text-white text-[11px] sm:text-xs px-3 py-1.5 sm:py-2 rounded-full hover:bg-black/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      openGallery(galleryImages, 0, event.title)
                    }}
                  >
                    <i className="fas fa-images mr-2"></i>
                    Просмотр фото
                  </button>
                )}
              </div>
              <div className="news-content p-4 sm:p-5">
                <h3 className="news-title text-lg sm:text-xl font-semibold text-primary mb-2 sm:mb-3 line-clamp-2">
                  {event.title}
                </h3>
                <div className="news-meta flex gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 flex-wrap">
                  <span><i className="fas fa-calendar mr-1"></i> {new Date(event.date).toLocaleDateString('ru-RU')}</span>
                  {event.report?.reportDate && (
                    <span><i className="fas fa-file-alt mr-1"></i> Отчет: {new Date(event.report.reportDate).toLocaleDateString('ru-RU')}</span>
                  )}
                  {event.report?.images && event.report.images.length > 0 && (
                    <span><i className="fas fa-camera mr-1"></i> {event.report.images.length} фото</span>
                  )}
                </div>
                <p className="news-excerpt text-gray-600 mb-4 sm:mb-5 text-sm sm:text-base line-clamp-3">
                  {event.report?.summary || event.description || 'Подробности мероприятия...'}
                </p>
                <div className="news-link text-accent font-medium flex items-center gap-2 hover:text-primary transition-colors">
                  Читать подробнее <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            </div>
          )
        })}
      </div>
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
