/**
 * File responsibility:
 * News page that displays completed event reports as news content.
 *
 * Main logic:
 * - Filter/render news events.
 * - Provide detail navigation and presentation.
 *
 * Integrations:
 * - AppContext news collections
 * - Event card/detail components
 */
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
  label,
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
    return events.filter((event) => {
      const eventDate = toDate(event.date)
      const isReport = Boolean(event.report) && (event.isPast || (eventDate ? eventDate < now : false))
      return isNewsEvent(event) || isReport
    })
  }, [events])

  const totalCount = useMemo(() => baseItems.length, [baseItems])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = baseItems.filter((event) => {
      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false

      if (normalizedQuery) {
        const haystack = [event.title, event.description, event.location, event.report?.summary || ''].join(' ').toLowerCase()
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

  const openGallery = (images: string[], index: number, title?: string) => {
    if (!images || images.length === 0) return
    setGalleryImages(images)
    setGalleryIndex(index)
    setGalleryTitle(title || 'Просмотр фото')
    setGalleryOpen(true)
  }

  const featuredItem = filteredItems[0]
  const listItems = filteredItems.slice(1)

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <div className="status-spinner" />
          <p className="text-lg text-gray-600">Загрузка новостной ленты...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="status-screen">
        <div className="status-card space-y-4">
          <p className="text-lg text-gray-600">Вы не авторизованы</p>
        </div>
      </div>
    )
  }

  return (
    <div className="news-page page-shell px-4 py-8 md:px-[5%]">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="page-hero p-4 sm:p-5 md:p-6">
          <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/60">Media Desk</p>
              <h1 className="page-title mt-2 text-2xl font-bold sm:text-4xl">Новостная хроника кампуса</h1>
              <p className="mt-2 max-w-2xl text-sm text-primary/66 sm:text-base">
                Архив материалов по событиям: репортажи, фото и краткие итоги для быстрого просмотра.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="liquid-card px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">В архиве</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{totalCount}</p>
              </div>
              <div className="liquid-card px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">После фильтра</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{filteredItems.length}</p>
              </div>
              <div className="liquid-card px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/58">Последняя публикация</p>
                <p className="mt-1 text-sm font-semibold text-primary">{featuredItem ? formatDate(featuredItem.report?.reportDate || featuredItem.date) : '—'}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
            <section className="liquid-section p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Фильтры</h2>
              <div className="mt-3">
                <SearchInput placeholder="Поиск по новостям..." onSearch={setQuery} inputClassName="py-2.5 text-sm" />
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-primary/58">Категория</label>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)} className="liquid-input w-full px-3 py-2 text-sm">
                    <option value="all">Все категории</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-primary/58">Сортировка</label>
                  <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)} className="liquid-input w-full px-3 py-2 text-sm">
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="liquid-section p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/64">Как читать ленту</h3>
              <ul className="mt-3 space-y-2 text-sm text-primary/68">
                <li className="border-b border-primary/12 px-0 py-2 last:border-b-0">Открывайте карточку, чтобы увидеть полный отчет.</li>
                <li className="border-b border-primary/12 px-0 py-2 last:border-b-0">Кнопка «Фото» открывает галерею без перехода на другую страницу.</li>
                <li className="border-b border-primary/12 px-0 py-2 last:border-b-0">Для навигации по темам используйте фильтр категории.</li>
              </ul>
            </section>
          </aside>

          <section className="space-y-5">
            {filteredItems.length === 0 ? (
              <div className="page-empty">По выбранным фильтрам новостей не найдено.</div>
            ) : (
              <>
                {featuredItem && (
                  <article
                    className="liquid-card liquid-card-hover cursor-pointer overflow-hidden"
                    onClick={() => router.push(`/events/${featuredItem.id}`)}
                  >
                    <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="relative min-h-[180px] border-b border-primary/12 lg:border-b-0 lg:border-r">
                        {featuredItem.report?.images?.[0] || featuredItem.images?.[0] ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={featuredItem.report?.images?.[0] || featuredItem.images?.[0]}
                              alt={featuredItem.title}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-[#041126]/18 via-[#041126]/42 to-[#041126]/18" />
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0f2f68] via-[#1f5fe0] to-[#2f8df3]">
                            <i className={`fas ${getCategoryIcon(featuredItem.category as EventCategory)} text-5xl text-white/85`} />
                          </div>
                        )}

                        <span className="absolute left-3 top-3 rounded-full border border-white/45 bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                          Главный материал
                        </span>
                      </div>

                      <div className="p-5 sm:p-6">
                        <h2 className="text-2xl font-semibold text-primary">{featuredItem.title}</h2>
                        <p className="mt-2 text-sm text-primary/64">
                          {formatDate(featuredItem.report?.reportDate || featuredItem.date)} • {featuredItem.location}
                        </p>
                        <p className="mt-4 line-clamp-3 text-sm text-primary/75">
                          {featuredItem.report?.summary || featuredItem.description || 'Подробности мероприятия доступны в карточке.'}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="liquid-chip px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                            {CategoryDisplayMap[featuredItem.category as EventCategory] || featuredItem.category}
                          </span>

                          {(featuredItem.report?.images?.length || featuredItem.images?.length) ? (
                            <button
                              type="button"
                              className="liquid-chip px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary"
                              onClick={(event) => {
                                event.stopPropagation()
                                openGallery(featuredItem.report?.images || featuredItem.images || [], 0, featuredItem.title)
                              }}
                            >
                              Фото ({(featuredItem.report?.images || featuredItem.images || []).length})
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary/16 bg-[#fff8ea] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                          Читать подробный материал <i className="fas fa-arrow-right" />
                        </div>
                      </div>
                    </div>
                  </article>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {listItems.map((event) => {
                    const gallery = event.report?.images && event.report.images.length > 0 ? event.report.images : event.images || []
                    const imageUrl = event.report?.images?.[0] || event.images?.[0] || ''

                    return (
                      <article
                        key={event.id}
                        className="liquid-card liquid-card-hover cursor-pointer overflow-hidden"
                        onClick={() => router.push(`/events/${event.id}`)}
                      >
                        <div className="relative h-36 overflow-hidden border-b border-primary/12">
                          {imageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={imageUrl} alt={event.title} className="absolute inset-0 h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-b from-[#041126]/18 via-[#041126]/34 to-[#041126]/7" />
                            </>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0f2f68] via-[#1f5fe0] to-[#2f8df3]">
                              <i className={`fas ${getCategoryIcon(event.category as EventCategory)} text-4xl text-white/85`} />
                            </div>
                          )}

                          {gallery.length > 0 && (
                            <button
                              type="button"
                              className="absolute bottom-3 left-3 rounded-full border border-white/40 bg-white/18 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white hover:bg-white/26"
                              onClick={(evt) => {
                                evt.stopPropagation()
                                openGallery(gallery, 0, event.title)
                              }}
                            >
                              <i className="fas fa-images mr-1" />
                              Фото
                            </button>
                          )}
                        </div>

                        <div className="p-4">
                          <h3 className="line-clamp-2 text-lg font-semibold text-primary">{event.title}</h3>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            <span className="text-primary/62">
                              <i className="fas fa-calendar mr-1" />
                              {formatDate(event.date)}
                            </span>
                            {event.report?.reportDate && (
                              <span className="text-primary/62">
                                <i className="fas fa-file-lines mr-1" />
                                Отчет: {formatDate(event.report.reportDate)}
                              </span>
                            )}
                          </div>
                          <p className="mt-3 line-clamp-3 text-sm text-primary/74">
                            {event.report?.summary || event.description || 'Подробности мероприятия...'}
                          </p>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </div>
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
