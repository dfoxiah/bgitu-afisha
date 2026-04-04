<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Рассылка: {{ $event->title }}</h2>
    </x-slot>

    <x-flash-message />

    <div class="py-8">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white rounded-lg shadow p-6">
                <form method="POST" action="{{ route('events.announcements.store', $event) }}" class="space-y-5">
                    @csrf

                    <div>
                        <x-input-label for="subject" value="Тема письма" />
                        <x-text-input id="subject" name="subject" type="text" class="mt-1 block w-full" :value="old('subject')" required />
                        <x-input-error :messages="$errors->get('subject')" class="mt-2" />
                    </div>

                    <div>
                        <x-input-label for="message" value="Текст сообщения" />
                        <textarea id="message" name="message" rows="8" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>{{ old('message') }}</textarea>
                        <x-input-error :messages="$errors->get('message')" class="mt-2" />
                    </div>

                    <div class="flex items-center gap-3">
                        <x-primary-button>Отправить</x-primary-button>
                        <a href="{{ route('events.show', $event) }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Назад</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</x-app-layout>

