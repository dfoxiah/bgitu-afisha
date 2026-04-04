<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Дашборд</h2>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="grid gap-4 md:grid-cols-4">
                <div class="bg-white p-5 rounded-lg shadow">
                    <p class="text-sm text-gray-500">Мероприятий</p>
                    <p class="text-2xl font-semibold">{{ $eventsCount }}</p>
                </div>
                <div class="bg-white p-5 rounded-lg shadow">
                    <p class="text-sm text-gray-500">Регистраций</p>
                    <p class="text-2xl font-semibold">{{ $registrationsCount }}</p>
                </div>
                <div class="bg-white p-5 rounded-lg shadow">
                    <p class="text-sm text-gray-500">Участников</p>
                    <p class="text-2xl font-semibold">{{ $participantsCount }}</p>
                </div>
                <div class="bg-white p-5 rounded-lg shadow">
                    <p class="text-sm text-gray-500">Выручка (оценка)</p>
                    <p class="text-2xl font-semibold">{{ number_format($estimatedRevenue, 2, ',', ' ') }} RUB</p>
                </div>
            </div>

            <div class="grid gap-6 lg:grid-cols-2">
                <div class="bg-white p-5 rounded-lg shadow">
                    <h3 class="font-semibold mb-4">Статусы регистраций (30 дней)</h3>
                    <div class="space-y-2">
                        @foreach (['pending' => 'Ожидает', 'confirmed' => 'Подтверждено', 'cancelled' => 'Отменено'] as $key => $label)
                            <div class="flex items-center justify-between border rounded px-3 py-2">
                                <span>{{ $label }}</span>
                                <span class="font-semibold">{{ $statusStats->get($key, 0) }}</span>
                            </div>
                        @endforeach
                    </div>
                </div>

                <div class="bg-white p-5 rounded-lg shadow">
                    <h3 class="font-semibold mb-4">Ближайшие мероприятия</h3>
                    <div class="space-y-3">
                        @forelse ($upcomingEvents as $event)
                            <a href="{{ route('events.show', $event) }}" class="block border rounded px-3 py-2 hover:bg-gray-50">
                                <p class="font-medium">{{ $event->title }}</p>
                                <p class="text-sm text-gray-500">{{ $event->starts_at->translatedFormat('d F Y, H:i') }} · {{ $event->venue }}</p>
                            </a>
                        @empty
                            <p class="text-sm text-gray-500">Ближайших мероприятий пока нет.</p>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>

