<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">Мероприятия</h2>

            @auth
                @if (auth()->user()->hasRole('admin', 'organizer'))
                    <a href="{{ route('events.create') }}" class="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
                        Создать мероприятие
                    </a>
                @endif
            @endauth
        </div>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <form method="GET" class="bg-white p-4 rounded-lg shadow grid gap-4 md:grid-cols-4">
                <div class="md:col-span-2">
                    <x-input-label for="q" value="Поиск" />
                    <x-text-input id="q" name="q" type="text" class="mt-1 block w-full" :value="$search" placeholder="Название, место, организатор" />
                </div>

                <div>
                    <x-input-label for="sort" value="Сортировка" />
                    <select id="sort" name="sort" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="starts_at_asc" @selected($sort === 'starts_at_asc')>По дате (сначала ближайшие)</option>
                        <option value="starts_at_desc" @selected($sort === 'starts_at_desc')>По дате (сначала поздние)</option>
                        <option value="price_asc" @selected($sort === 'price_asc')>По цене (дешевле)</option>
                        <option value="price_desc" @selected($sort === 'price_desc')>По цене (дороже)</option>
                    </select>
                </div>

                <div class="flex items-end gap-2">
                    <x-primary-button>Применить</x-primary-button>
                    <a href="{{ route('events.index') }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Сброс</a>
                </div>
            </form>

            @if ($monthlyStats->isNotEmpty())
                <div class="bg-white p-4 rounded-lg shadow">
                    <h3 class="font-semibold text-gray-900 mb-3">План ближайших месяцев</h3>
                    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                        @foreach ($monthlyStats as $month => $count)
                            <div class="rounded border px-3 py-2">
                                <p class="text-sm text-gray-500">{{ \Carbon\Carbon::createFromFormat('Y-m', $month)->translatedFormat('F Y') }}</p>
                                <p class="text-lg font-semibold">{{ $count }}</p>
                            </div>
                        @endforeach
                    </div>
                </div>
            @endif

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                @forelse ($events as $event)
                    <article class="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                        @if ($event->poster_path)
                            <img src="{{ asset('storage/'.$event->poster_path) }}" alt="{{ $event->title }}" class="h-44 w-full object-cover" />
                        @endif

                        <div class="p-4 space-y-3 flex-1 flex flex-col">
                            <div>
                                <p class="text-xs text-gray-500">{{ $event->starts_at->translatedFormat('d F Y, H:i') }}</p>
                                <h3 class="text-lg font-semibold text-gray-900">{{ $event->title }}</h3>
                            </div>

                            <p class="text-sm text-gray-600 line-clamp-3">{{ $event->description }}</p>

                            <div class="text-sm text-gray-600 space-y-1">
                                <p><span class="font-medium">Место:</span> {{ $event->venue }}</p>
                                <p><span class="font-medium">Организатор:</span> {{ $event->organizer->name }}</p>
                                <p><span class="font-medium">Цена:</span> {{ number_format((float) $event->price, 2, ',', ' ') }} RUB</p>
                                <p><span class="font-medium">Активных заявок:</span> {{ $event->active_registrations_count }}</p>
                            </div>

                            <div class="mt-auto flex items-center gap-2 pt-2">
                                <a href="{{ route('events.show', $event) }}" class="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Подробнее</a>

                                @auth
                                    @if (auth()->user()->hasRole('admin', 'organizer'))
                                        <a href="{{ route('events.edit', $event) }}" class="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700">Редактировать</a>
                                    @endif
                                @endauth
                            </div>
                        </div>
                    </article>
                @empty
                    <div class="col-span-full bg-white rounded-lg shadow p-6 text-sm text-gray-500">
                        По вашему запросу ничего не найдено.
                    </div>
                @endforelse
            </div>

            {{ $events->links() }}
        </div>
    </div>
</x-app-layout>

