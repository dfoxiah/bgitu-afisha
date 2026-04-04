@csrf

<div class="grid gap-6 md:grid-cols-2">
    <div>
        <x-input-label for="full_name" value="ФИО" />
        <x-text-input id="full_name" name="full_name" type="text" class="mt-1 block w-full" :value="old('full_name', $participant->full_name)" required />
        <x-input-error :messages="$errors->get('full_name')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="email" value="Email" />
        <x-text-input id="email" name="email" type="email" class="mt-1 block w-full" :value="old('email', $participant->email)" required />
        <x-input-error :messages="$errors->get('email')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="phone" value="Телефон" />
        <x-text-input id="phone" name="phone" type="text" class="mt-1 block w-full" :value="old('phone', $participant->phone)" required />
        <x-input-error :messages="$errors->get('phone')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="user_id" value="Аккаунт пользователя" />
        <select id="user_id" name="user_id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <option value="">Не привязывать</option>
            @foreach ($users as $user)
                <option value="{{ $user->id }}" @selected(old('user_id', $participant->user_id) == $user->id)>{{ $user->name }} ({{ $user->email }})</option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('user_id')" class="mt-2" />
    </div>

    <div class="md:col-span-2">
        <x-input-label for="notes" value="Заметки" />
        <textarea id="notes" name="notes" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">{{ old('notes', $participant->notes) }}</textarea>
        <x-input-error :messages="$errors->get('notes')" class="mt-2" />
    </div>
</div>

<div class="mt-6 flex items-center gap-3">
    <x-primary-button>{{ $buttonLabel }}</x-primary-button>
    <a href="{{ route('participants.index') }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Отмена</a>
</div>

