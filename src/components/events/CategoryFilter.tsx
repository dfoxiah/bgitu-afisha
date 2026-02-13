/**
 * File responsibility:
 * Category filter control for event collections.
 *
 * Main logic:
 * - Render category chips/selectors.
 * - Update selected category in shared context state.
 *
 * Integrations:
 * - AppContext setSelectedCategory()
 * - Dashboard/events pages
 */
'use client'

import { useAppContext } from '@/contexts/AppContext'

export default function CategoryFilter() {
  const { categories, selectedCategory, setSelectedCategory } = useAppContext()

  return (
    <section className="categories liquid-section px-4 sm:px-6 lg:px-[5%] py-4 sm:py-5 animate-fadeIn">
      <h2 className="section-title text-lg sm:text-2xl font-semibold text-primary mb-4 flex items-center gap-3">
        <i className="fas fa-tags text-accent"></i> Категории мероприятий
      </h2>
      <div className="categories-list flex gap-2 sm:gap-3 overflow-x-auto py-1.5 sm:py-2 no-scrollbar -mx-1 px-1">
        {categories.map(category => (
          <div
            key={category}
            className={`category px-3 sm:px-5 py-1.5 sm:py-2 rounded-full font-medium text-xs sm:text-sm cursor-pointer transition-all duration-300 border whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-gradient-to-r from-secondary to-accent text-white border-transparent transform -translate-y-0.5 shadow-custom'
                : 'bg-white/70 border-white/70 hover:bg-white'
            }`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </div>
        ))}
      </div>
    </section>
  )
}


