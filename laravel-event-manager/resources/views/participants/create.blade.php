<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">Новый участник</h2>
    </x-slot>

    <div class="py-8">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white rounded-lg shadow p-6">
                <form method="POST" action="{{ route('participants.store') }}">
                    @include('participants._form', ['buttonLabel' => 'Сохранить'])
                </form>
            </div>
        </div>
    </div>
</x-app-layout>

