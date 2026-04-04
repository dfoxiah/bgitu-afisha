# Сравнение UI/стеков для проекта BGITU Afisha (Next.js + React)

Дата: 3 апреля 2026

## Что сравнивал

1. Tailwind CSS
2. shadcn/ui (на базе Tailwind + Radix)
3. Material UI (MUI)
4. Ant Design
5. Mantine

## Критерии

- Скорость внедрения в текущий код
- Гибкость дизайна (кастомный вид без «типового шаблона»)
- Готовность компонентов для админки и форм
- Риски миграции для текущего проекта
- Удобство поддержки в долгую

## Короткая матрица

| Стек | Плюсы | Минусы | Оценка для текущего проекта |
|---|---|---|---|
| Tailwind CSS | Максимальная гибкость, уже используется в проекте | Нужна дисциплина дизайн-системы | 9/10 |
| shadcn/ui | Красивые базовые паттерны, удобно для модалок/табов/форм | Нужно донастроить набор компонентов под стиль | 9/10 |
| MUI | Огромный набор компонентов и зрелая документация | Легко получить «типовой MUI-вид», выше вес | 7/10 |
| Ant Design | Сильный набор для enterprise-админок | Визуальный стиль сложнее подогнать под кастом | 6/10 |
| Mantine | Много компонентов + hooks, хорошая DX | Миграция потребует частичной переделки UI-слоя | 8/10 |

## Вывод для проекта

Оптимальная связка для этого репозитория:

- **Оставить Tailwind CSS как основу**
- **Точечно добавлять паттерны shadcn/ui** для сложных частей (диалоги, выпадающие меню, табы, command-поиск, data entry)

Такой путь даёт максимум результата без дорогой миграции и сохраняет уже сделанный редизайн.

## Официальные источники

- Tailwind CSS: https://tailwindcss.com/docs/responsive-design
- shadcn/ui: https://ui.shadcn.com/docs
- MUI: https://mui.com/material-ui/getting-started/
- Ant Design: https://ant.design/docs/react/introduce
- Mantine: https://mantine.dev/
- Next.js Metadata: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
- Next.js Error Handling: https://nextjs.org/docs/app/getting-started/error-handling
- Next.js Robots/Sitemap: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- W3C Skip Link Technique: https://www.w3.org/WAI/WCAG21/Techniques/general/G1
