'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAppContext } from '@/contexts/AppContext'
import SearchInput from '@/components/ui/SearchInput'
import ImageGalleryModal from '@/components/ui/ImageGalleryModal'
import { Event, CategoryDisplayMap } from '@/types'
import { EventCategory } from '@prisma/client'
import { getCategoryIcon } from '@/utils/eventCategoryIcons'

type SortOrder = 'newest' | 'oldest'
type CategoryFilter = 'all' | EventCategory

const categoryOptions = Object.entries(CategoryDisplayMap).map(([value, label]) => ({
  value: value as EventCategory,
  label
}))

const toDate = (value?: Date | string | null) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value?: Date | string | null) => {
  const date = toDate(value)
  return date ? date.toLocaleDateString('ru-RU') : 'Дата не указана'
}

const isNewsEvent = (event: Event) => event.isNews || event.category === EventCategory.NEWS

const getSortTime = (event: Event) => {
  const reportDate = toDate(event.report?.reportDate)
  const eventDate = toDate(event.date)
  const date = reportDate || eventDate
  return date ? date.getTime() : 0
}

export default function NewsPage() {
  const { data: session, status } = useSession()
  const { events, isLoading } = useAppContext()
  const router = useRouter()

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [query, setQuery] = useState('')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryTitle, setGalleryTitle] = useState('')

  const baseItems = useMemo(() => {
    const now = new Date()
    return events.filter(event => {
      const eventDate = toDate(event.date)
      const isReport = Boolean(event.report) && (event.isPast || (eventDate ? eventDate < now : false))
      return isNewsEvent(event) || isReport
    })
  }, [events])

  const totalCount = useMemo(() => baseItems.length, [baseItems])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = baseItems.filter(event => {
      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false

      if (normalizedQuery) {
        const haystack = [
          event.title,
          event.description,
          event.location,
          event.report?.summary || ''
        ].join(' ').toLowerCase()

        if (!haystack.includes(normalizedQuery)) return false
      }

      return true
    })

    result.sort((a, b) => {
      const diff = getSortTime(a) - getSortTime(b)
      return sortOrder === 'newest' ? -diff : diff
    })

    return result
  }, [baseItems, categoryFilter, query, sortOrder])

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

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-light-gray">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-accent mx-auto"></div>
          <p className="text-gray-600 text-lg">Загрузка новостной ленты...</p>
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
    <div className="news-page px-4 md:px-5% py-8">
      <div className="container mx-auto max-w-6xl space-y-6">
        <div className="liquid-section p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-[220px]">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-3">
                <i className="fas fa-newspaper text-accent"></i> Новостная лента
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Всего материалов: {totalCount}
              </p>
            </div>
            <div className="w-full sm:w-[360px] sm:ml-auto">
              <SearchInput
                placeholder="Поиск по новостям..."
                onSearch={setQuery}
                inputClassName="py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="liquid-input px-4 py-2 text-sm"
            >
              <option value="all">Все категории</option>
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="liquid-input px-4 py-2 text-sm"
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="liquid-section p-10 text-center text-gray-500">
            Нет материалов по выбранным фильтрам.
          </div>
        ) : (
          <div className="news-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredItems.map(event => {
              const badgeLabel = 'Новость'
              const badgeClass = 'bg-accent/90'
              const galleryImages = event.report?.images && event.report.images.length > 0
                ? event.report.images
                : (event.images || [])
              const imageUrl = event.report?.images && event.report.images.length > 0
                ? event.report.images[0]
                : (event.images && event.images.length > 0 ? event.images[0] : '')

              return (
                <div
                  key={event.id}
                  className="news-card liquid-card liquid-card-hover overflow-hidden cursor-pointer"
                  onClick={() => handleNewsClick(event)}
                >
                  <div className="news-image h-40 sm:h-48 bg-gray-900 relative overflow-hidden">
                    {imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={event.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60"></div>
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex items-center justify-center">
                        <i className={`fas ${getCategoryIcon(event.category as EventCategory)} text-4xl sm:text-5xl text-white/80`}></i>
                      </div>
                    )}

                    <div className={`absolute top-3 left-3 text-[11px] sm:text-xs px-3 py-1.5 rounded-full text-white ${badgeClass}`}>
                      {badgeLabel}
                    </div>

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
                      <span>
                        <i className="fas fa-calendar mr-1"></i>
                        {formatDate(event.date)}
                      </span>
                      {event.report?.reportDate && (
                        <span>
                          <i className="fas fa-file-alt mr-1"></i>
                          Отчет: {formatDate(event.report.reportDate)}
                        </span>
                      )}
                      {galleryImages.length > 0 && (
                        <span>
                          <i className="fas fa-camera mr-1"></i>
                          {galleryImages.length} фото
                        </span>
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
        )}
      </div>

      <ImageGalleryModal
        isOpen={galleryOpen}
        images={galleryImages}
        startIndex={galleryIndex}
        title={galleryTitle}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  )
}
