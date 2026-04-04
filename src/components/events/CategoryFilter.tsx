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
"use client"

import { useAppContext } from "@/contexts/AppContext"

export default function CategoryFilter() {
  const { categories, selectedCategory, setSelectedCategory } = useAppContext()

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-primary/65">Категории</h2>
        <p className="mt-1 text-xs text-primary/55">Быстрый фильтр по типу мероприятия.</p>
      </div>

      <div className="border border-primary/14 bg-white">
        {categories.map((category, index) => {
          const active = selectedCategory === category

          return (
            <button
              key={category}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.06em] transition-all ${
                active ? "bg-primary text-white" : "text-primary/76 hover:bg-primary/5"
              } ${index !== categories.length - 1 ? "border-b border-primary/12" : ""}`}
              onClick={() => setSelectedCategory(category)}
            >
              <span className="line-clamp-1">{category}</span>
              <i className={`fas ${active ? "fa-check" : "fa-chevron-right"} text-[10px]`} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
