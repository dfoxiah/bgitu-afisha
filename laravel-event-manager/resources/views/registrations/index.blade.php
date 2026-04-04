<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">Регистрации</h2>
            <a href="{{ route('registrations.create') }}" class="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">Добавить</a>
        </div>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
            <form method="GET" class="bg-white p-4 rounded-lg shadow grid gap-4 md:grid-cols-4">
                <div class="md:col-span-2">
                    <x-input-label for="q" value="Поиск" />
                    <x-text-input id="q" name="q" type="text" class="mt-1 block w-full" :value="$search" placeholder="Мероприятие или участник" />
                </div>
                <div>
                    <x-input-label for="status" value="Статус" />
                    <select id="status" name="status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="">Все</option>
                        <option value="pending" @selected($status === 'pending')>Ожидает</option>
                        <option value="confirmed" @selected($status === 'confirmed')>Подтверждено</option>
                        <option value="cancelled" @selected($status === 'cancelled')>Отменено</option>
                    </select>
                </div>
                <div class="flex items-end gap-2">
                    <x-primary-button>Применить</x-primary-button>
                    <a href="{{ route('registrations.index') }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Сброс</a>
                </div>
            </form>

            <div class="bg-white rounded-lg shadow overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left">Мероприятие</th>
                            <th class="px-4 py-3 text-left">Участник</th>
                            <th class="px-4 py-3 text-left">Дата</th>
                            <th class="px-4 py-3 text-left">Статус</th>
                            <th class="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        @forelse ($registrations as $registration)
                            <tr>
                                <td class="px-4 py-3">{{ $registration->event->title }}</td>
                                <td class="px-4 py-3">{{ $registration->participant->full_name }}</td>
                                <td class="px-4 py-3">{{ $registration->registered_at->format('d.m.Y H:i') }}</td>
                                <td class="px-4 py-3"><x-status-badge :status="$registration->status" /></td>
                                <td class="px-4 py-3 text-right space-x-2">
                                    <a href="{{ route('registrations.show', $registration) }}" class="text-gray-700 hover:underline">Открыть</a>
                                    <a href="{{ route('registrations.edit', $registration) }}" class="text-gray-700 hover:underline">Изменить</a>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="px-4 py-4 text-gray-500">Записей нет.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            {{ $registrations->links() }}
        </div>
    </div>
</x-app-layout>

