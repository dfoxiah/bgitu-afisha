'use client'

import { useAppContext } from '@/contexts/AppContext'

export default function CategoryFilter() {
  const { categories, selectedCategory, setSelectedCategory } = useAppContext()

  return (
    <section className="categories liquid-section px-5% py-5 animate-fadeIn">
      <h2 className="section-title text-2xl font-semibold text-primary mb-4 flex items-center gap-3">
        <i className="fas fa-tags text-accent"></i> Категории мероприятий
      </h2>
      <div className="categories-list flex gap-3 overflow-x-auto py-2">
        {categories.map(category => (
          <div
            key={category}
            className={`category px-5 py-2 rounded-full font-medium text-sm cursor-pointer transition-all duration-300 border whitespace-nowrap ${
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

