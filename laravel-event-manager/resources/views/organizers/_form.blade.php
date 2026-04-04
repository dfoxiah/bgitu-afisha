@csrf

<div class="grid gap-6 md:grid-cols-2">
    <div>
        <x-input-label for="name" value="Название" />
        <x-text-input id="name" name="name" type="text" class="mt-1 block w-full" :value="old('name', $organizer->name)" required />
        <x-input-error :messages="$errors->get('name')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="contacts" value="Контакты" />
        <x-text-input id="contacts" name="contacts" type="text" class="mt-1 block w-full" :value="old('contacts', $organizer->contacts)" required />
        <x-input-error :messages="$errors->get('contacts')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="website" value="Сайт" />
        <x-text-input id="website" name="website" type="url" class="mt-1 block w-full" :value="old('website', $organizer->website)" />
        <x-input-error :messages="$errors->get('website')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="user_id" value="Аккаунт организатора" />
        <select id="user_id" name="user_id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <option value="">Не привязывать</option>
            @foreach ($users as $user)
                <option value="{{ $user->id }}" @selected(old('user_id', $organizer->user_id) == $user->id)>{{ $user->name }} ({{ $user->email }})</option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('user_id')" class="mt-2" />
    </div>

    <div class="md:col-span-2">
        <x-input-label for="description" value="Описание" />
        <textarea id="description" name="description" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">{{ old('description', $organizer->description) }}</textarea>
        <x-input-error :messages="$errors->get('description')" class="mt-2" />
    </div>
</div>

<div class="mt-6 flex items-center gap-3">
    <x-primary-button>{{ $buttonLabel }}</x-primary-button>
    <a href="{{ route('organizers.index') }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Отмена</a>
</div>

