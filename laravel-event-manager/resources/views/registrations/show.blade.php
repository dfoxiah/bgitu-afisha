<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Регистрация #{{ $registration->id }}</h2>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white rounded-lg shadow p-6 grid gap-3 text-sm">
                <p><span class="font-medium">Мероприятие:</span> <a href="{{ route('events.show', $registration->event) }}" class="underline">{{ $registration->event->title }}</a></p>
                <p><span class="font-medium">Участник:</span> {{ $registration->participant->full_name }} ({{ $registration->participant->email }})</p>
                <p><span class="font-medium">Организатор:</span> {{ $registration->event->organizer->name }}</p>
                <p><span class="font-medium">Дата:</span> {{ $registration->registered_at->format('d.m.Y H:i') }}</p>
                <p><span class="font-medium">Статус:</span> <x-status-badge :status="$registration->status" /></p>
            </div>

            <div class="bg-white rounded-lg shadow p-6 flex gap-3">
                <a href="{{ route('registrations.edit', $registration) }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Редактировать</a>

                <form method="POST" action="{{ route('registrations.destroy', $registration) }}" onsubmit="return confirm('Удалить регистрацию?')">
                    @csrf
                    @method('DELETE')
                    <x-danger-button>Удалить</x-danger-button>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>

