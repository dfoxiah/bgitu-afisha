<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">Участники</h2>
            <a href="{{ route('participants.create') }}" class="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">Добавить</a>
        </div>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
            <form method="GET" class="bg-white p-4 rounded-lg shadow flex gap-2">
                <x-text-input name="q" type="text" class="block w-full" :value="$search" placeholder="ФИО, email, телефон" />
                <x-primary-button>Найти</x-primary-button>
            </form>

            <div class="bg-white rounded-lg shadow overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left">ФИО</th>
                            <th class="px-4 py-3 text-left">Email</th>
                            <th class="px-4 py-3 text-left">Телефон</th>
                            <th class="px-4 py-3 text-left">Регистраций</th>
                            <th class="px-4 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        @forelse ($participants as $participant)
                            <tr>
                                <td class="px-4 py-3">{{ $participant->full_name }}</td>
                                <td class="px-4 py-3">{{ $participant->email }}</td>
                                <td class="px-4 py-3">{{ $participant->phone }}</td>
                                <td class="px-4 py-3">{{ $participant->registrations_count }}</td>
                                <td class="px-4 py-3 text-right space-x-2">
                                    <a href="{{ route('participants.show', $participant) }}" class="text-gray-700 hover:underline">Открыть</a>
                                    <a href="{{ route('participants.edit', $participant) }}" class="text-gray-700 hover:underline">Изменить</a>
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

            {{ $participants->links() }}
        </div>
    </div>
</x-app-layout>

