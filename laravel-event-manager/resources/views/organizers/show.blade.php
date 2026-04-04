<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">{{ $organizer->name }}</h2>
            <a href="{{ route('organizers.edit', $organizer) }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Редактировать</a>
        </div>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white rounded-lg shadow p-6 grid gap-3 text-sm">
                <p><span class="font-medium">Контакты:</span> {{ $organizer->contacts }}</p>
                <p><span class="font-medium">Сайт:</span> {{ $organizer->website ?? 'не указан' }}</p>
                <p><span class="font-medium">Аккаунт:</span> {{ $organizer->user?->email ?? 'не привязан' }}</p>
                <p><span class="font-medium">Описание:</span> {{ $organizer->description ?: 'нет' }}</p>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="font-semibold mb-3">Мероприятия организатора</h3>
                <ul class="space-y-2 text-sm">
                    @forelse ($organizer->events as $event)
                        <li><a href="{{ route('events.show', $event) }}" class="underline">{{ $event->title }}</a> · {{ $event->starts_at->format('d.m.Y H:i') }}</li>
                    @empty
                        <li class="text-gray-500">Мероприятий пока нет.</li>
                    @endforelse
                </ul>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <form method="POST" action="{{ route('organizers.destroy', $organizer) }}" onsubmit="return confirm('Удалить организатора?')">
                    @csrf
                    @method('DELETE')
                    <x-danger-button>Удалить</x-danger-button>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>

