/**
 * File responsibility:
 * Image gallery modal for browsing event/report media.
 *
 * Main logic:
 * - Display selected image and navigation controls.
 * - Support fullscreen-like preview experience.
 *
 * Integrations:
 * - Event detail/report components
 * - Modal UI layer
 */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

interface ImageGalleryModalProps {
  isOpen: boolean
  images: string[]
  startIndex?: number
  title?: string
  onClose: () => void
}

export default function ImageGalleryModal({ isOpen, images, startIndex = 0, title, onClose }: ImageGalleryModalProps) {
  const normalizedImages = useMemo(() => images.filter((image) => Boolean(image)), [images])
  const totalImages = normalizedImages.length
  const hasImages = totalImages > 0

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!hasImages) return 0
    return Math.max(0, Math.min(startIndex, totalImages - 1))
  })

  const handlePrev = useCallback(() => {
    if (!hasImages) return
    setCurrentIndex((prev) => (prev - 1 + totalImages) % totalImages)
  }, [hasImages, totalImages])

  const handleNext = useCallback(() => {
    if (!hasImages) return
    setCurrentIndex((prev) => (prev + 1) % totalImages)
  }, [hasImages, totalImages])

  useEffect(() => {
    if (!isOpen) return
    if (!hasImages) {
      setCurrentIndex(0)
      return
    }

    const safeIndex = Math.max(0, Math.min(startIndex, totalImages - 1))
    setCurrentIndex(safeIndex)
  }, [isOpen, startIndex, hasImages, totalImages])

  useEffect(() => {
    if (!isOpen) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') handleNext()
      if (event.key === 'ArrowLeft') handlePrev()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)

    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose, handleNext, handlePrev])

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[980] flex items-center justify-center bg-slate-950/82 p-2 backdrop-blur-md sm:p-4" onClick={onClose}>
      <div
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#020712]/94 shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 bg-black/35 px-4 py-3 text-white sm:px-5 sm:py-4">
          <div>
            <p className="text-sm font-semibold">{title || 'Галерея'}</p>
            <p className="text-xs text-white/65">{hasImages ? `${currentIndex + 1} из ${totalImages}` : 'Нет изображений'}</p>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xl leading-none transition-colors hover:bg-white/20"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </header>

        <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-black/65">
          {hasImages ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizedImages[currentIndex]}
                alt={`Изображение ${currentIndex + 1}`}
                className="max-h-[72vh] w-full object-contain"
              />

              {totalImages > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition-colors hover:bg-black/80"
                    aria-label="Предыдущее изображение"
                  >
                    <i className="fas fa-chevron-left" />
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white transition-colors hover:bg-black/80"
                    aria-label="Следующее изображение"
                  >
                    <i className="fas fa-chevron-right" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-white/70">Нет изображений</div>
          )}
        </div>

        {hasImages && totalImages > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-black/45 px-4 py-3 sm:px-5">
            {normalizedImages.map((image, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-14 w-20 overflow-hidden rounded-lg border ${index === currentIndex ? 'border-accent shadow-[0_0_0_2px_rgba(15,143,140,0.35)]' : 'border-white/20'}`}
                aria-label={`Открыть изображение ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`Миниатюра ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
