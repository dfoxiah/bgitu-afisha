<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">Календарь мероприятий</h2>
            <div class="flex items-center gap-2">
                <a href="{{ route('calendar.index', ['month' => $prevMonth]) }}" class="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><</a>
                <span class="font-medium">{{ $currentMonth->translatedFormat('F Y') }}</span>
                <a href="{{ route('calendar.index', ['month' => $nextMonth]) }}" class="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">></a>
            </div>
        </div>
    </x-slot>

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="grid grid-cols-7 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    @foreach (['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as $weekday)
                        <div class="p-3 text-center">{{ $weekday }}</div>
                    @endforeach
                </div>

                <div class="grid grid-cols-7">
                    @foreach ($days as $day)
                        @php
                            $dateKey = $day->toDateString();
                            $items = $eventsByDate->get($dateKey, collect());
                            $isCurrentMonth = $day->month === $currentMonth->month;
                            $isToday = $day->isToday();
                        @endphp

                        <div class="min-h-36 border p-2 {{ $isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400' }}">
                            <div class="text-xs mb-2 {{ $isToday ? 'font-semibold text-indigo-600' : '' }}">{{ $day->day }}</div>

                            <div class="space-y-1">
                                @foreach ($items->take(3) as $event)
                                    <a href="{{ route('events.show', $event) }}" class="block rounded bg-indigo-50 text-indigo-900 px-2 py-1 text-xs hover:bg-indigo-100">
                                        {{ $event->starts_at->format('H:i') }} · {{ \Illuminate\Support\Str::limit($event->title, 22) }}
                                    </a>
                                @endforeach

                                @if ($items->count() > 3)
                                    <div class="text-xs text-gray-500">+{{ $items->count() - 3 }} еще</div>
                                @endif
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>
</x-app-layout>

