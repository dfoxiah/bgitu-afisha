<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">{{ $participant->full_name }}</h2>
            <a href="{{ route('participants.edit', $participant) }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Редактировать</a>
        </div>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white rounded-lg shadow p-6 grid gap-3 text-sm">
                <p><span class="font-medium">Email:</span> {{ $participant->email }}</p>
                <p><span class="font-medium">Телефон:</span> {{ $participant->phone }}</p>
                <p><span class="font-medium">Аккаунт:</span> {{ $participant->user?->email ?? 'не привязан' }}</p>
                <p><span class="font-medium">Заметки:</span> {{ $participant->notes ?: 'нет' }}</p>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="font-semibold mb-3">Регистрации</h3>
                <ul class="space-y-2 text-sm">
                    @forelse ($participant->registrations as $registration)
                        <li>
                            <a href="{{ route('events.show', $registration->event) }}" class="underline">{{ $registration->event->title }}</a>
                            · {{ $registration->registered_at->format('d.m.Y H:i') }}
                            · <x-status-badge :status="$registration->status" />
                        </li>
                    @empty
                        <li class="text-gray-500">Пока нет регистраций.</li>
                    @endforelse
                </ul>
            </div>

            <div class="bg-white rounded-lg shadow p-6">
                <form method="POST" action="{{ route('participants.destroy', $participant) }}" onsubmit="return confirm('Удалить участника?')">
                    @csrf
                    @method('DELETE')
                    <x-danger-button>Удалить</x-danger-button>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>

