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

export default function ImageGalleryModal({
  isOpen,
  images,
  startIndex = 0,
  title,
  onClose
}: ImageGalleryModalProps) {
  const normalizedImages = useMemo(
    () => images.filter((image) => Boolean(image)),
    [images]
  )
  const totalImages = normalizedImages.length
  const hasImages = totalImages > 0
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!hasImages) return 0
    const safeIndex = Math.max(0, Math.min(startIndex, totalImages - 1))
    return safeIndex
  })

  const handlePrev = useCallback(() => {
    if (!hasImages) return
    setCurrentIndex(prev => (prev - 1 + totalImages) % totalImages)
  }, [hasImages, totalImages])

  const handleNext = useCallback(() => {
    if (!hasImages) return
    setCurrentIndex(prev => (prev + 1) % totalImages)
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

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
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
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-black/90 sm:w-[92%]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white sm:px-5 sm:py-4">
          <div className="font-semibold">
            {title || 'Просмотр фото'}
          </div>
          <button
            className="text-2xl leading-none hover:text-white/70"
            onClick={onClose}
            aria-label="Закрыть"
          >
            &times;
          </button>
        </div>

        <div className="relative bg-black">
          {hasImages ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizedImages[currentIndex]}
                alt={`Фото ${currentIndex + 1}`}
                className="w-full max-h-[70vh] object-contain mx-auto"
              />
            </>
          ) : (
            <div className="text-center text-white/70 py-20">
              Нет изображений
            </div>
          )}

          {hasImages && totalImages > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80 sm:left-3 sm:h-12 sm:w-12"
                aria-label="Предыдущее фото"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80 sm:right-3 sm:h-12 sm:w-12"
                aria-label="Следующее фото"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </>
          )}

          {hasImages && (
            <div className="absolute bottom-3 right-4 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
              {currentIndex + 1} / {totalImages}
            </div>
          )}
        </div>

        {hasImages && totalImages > 1 && (
          <div className="flex gap-3 overflow-x-auto border-t border-white/10 bg-black/70 px-4 py-3 sm:px-5 sm:py-4">
            {normalizedImages.map((image, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-12 w-16 overflow-hidden rounded-lg border sm:h-14 sm:w-20 ${
                  index === currentIndex ? 'border-accent' : 'border-white/20'
                }`}
                aria-label={`Открыть фото ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={`Миниатюра ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

