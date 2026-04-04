<x-app-layout>
    <x-slot name="header">
        <div class="flex items-center justify-between gap-4">
            <h2 class="font-semibold text-xl text-gray-800 leading-tight">{{ $event->title }}</h2>

            @auth
                @if (auth()->user()->hasRole('admin', 'organizer'))
                    <div class="flex gap-2">
                        <a href="{{ route('events.edit', $event) }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Редактировать</a>
                        <a href="{{ route('events.announcements.create', $event) }}" class="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">Рассылка</a>
                    </div>
                @endif
            @endauth
        </div>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
            <div class="bg-white rounded-lg shadow p-6 grid gap-6 lg:grid-cols-3">
                <div class="lg:col-span-2 space-y-4">
                    <p class="text-sm text-gray-500">{{ $event->starts_at->translatedFormat('d F Y, H:i') }}</p>
                    <p class="text-gray-700 whitespace-pre-line">{{ $event->description }}</p>

                    <div class="grid gap-3 sm:grid-cols-2 text-sm">
                        <div class="border rounded p-3"><span class="font-medium">Место:</span> {{ $event->venue }}</div>
                        <div class="border rounded p-3"><span class="font-medium">Организатор:</span> {{ $event->organizer->name }}</div>
                        <div class="border rounded p-3"><span class="font-medium">Цена:</span> {{ number_format((float) $event->price, 2, ',', ' ') }} RUB</div>
                        <div class="border rounded p-3"><span class="font-medium">Лимит мест:</span> {{ $event->capacity ?? 'без лимита' }}</div>
                    </div>
                </div>

                <div>
                    @if ($event->poster_path)
                        <img src="{{ asset('storage/'.$event->poster_path) }}" alt="{{ $event->title }}" class="w-full rounded border object-cover" />
                    @endif
                </div>
            </div>

            @auth
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="font-semibold mb-3">Регистрация</h3>

                    @if ($myRegistration && in_array($myRegistration->status, ['pending', 'confirmed'], true))
                        <p class="text-sm text-gray-600 mb-3">Ваш статус: <x-status-badge :status="$myRegistration->status" /></p>
                        <form method="POST" action="{{ route('events.unregister', $event) }}">
                            @csrf
                            @method('DELETE')
                            <x-danger-button>Отменить регистрацию</x-danger-button>
                        </form>
                    @else
                        <form method="POST" action="{{ route('events.register', $event) }}">
                            @csrf
                            <x-primary-button>Зарегистрироваться</x-primary-button>
                        </form>
                    @endif
                </div>
            @else
                <div class="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
                    Для регистрации на мероприятие <a href="{{ route('login') }}" class="underline">войдите в систему</a>.
                </div>
            @endauth

            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="font-semibold mb-4">Участники (заявки)</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead>
                            <tr>
                                <th class="py-2 text-left">Участник</th>
                                <th class="py-2 text-left">Email</th>
                                <th class="py-2 text-left">Дата</th>
                                <th class="py-2 text-left">Статус</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            @forelse ($event->registrations as $registration)
                                <tr>
                                    <td class="py-2">{{ $registration->participant->full_name }}</td>
                                    <td class="py-2">{{ $registration->participant->email }}</td>
                                    <td class="py-2">{{ $registration->registered_at->format('d.m.Y H:i') }}</td>
                                    <td class="py-2"><x-status-badge :status="$registration->status" /></td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="4" class="py-3 text-gray-500">Пока нет регистраций.</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>

            @auth
                @if (auth()->user()->hasRole('admin', 'organizer'))
                    <div class="bg-white rounded-lg shadow p-6">
                        <form method="POST" action="{{ route('events.destroy', $event) }}" onsubmit="return confirm('Удалить мероприятие?')">
                            @csrf
                            @method('DELETE')
                            <x-danger-button>Удалить мероприятие</x-danger-button>
                        </form>
                    </div>
                @endif
            @endauth
        </div>
    </div>
</x-app-layout>

