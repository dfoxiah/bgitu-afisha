@csrf

<div class="grid gap-6 md:grid-cols-2">
    <div>
        <x-input-label for="organizer_id" value="Организатор" />
        <select id="organizer_id" name="organizer_id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
            <option value="">Выберите организатора</option>
            @foreach ($organizers as $organizer)
                <option value="{{ $organizer->id }}" @selected(old('organizer_id', $event->organizer_id) == $organizer->id)>{{ $organizer->name }}</option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('organizer_id')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="title" value="Название" />
        <x-text-input id="title" name="title" type="text" class="mt-1 block w-full" :value="old('title', $event->title)" required />
        <x-input-error :messages="$errors->get('title')" class="mt-2" />
    </div>

    <div class="md:col-span-2">
        <x-input-label for="description" value="Описание" />
        <textarea id="description" name="description" rows="5" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>{{ old('description', $event->description) }}</textarea>
        <x-input-error :messages="$errors->get('description')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="starts_at" value="Дата и время" />
        <x-text-input id="starts_at" name="starts_at" type="datetime-local" class="mt-1 block w-full" :value="old('starts_at', $event->starts_at?->format('Y-m-d\TH:i'))" required />
        <x-input-error :messages="$errors->get('starts_at')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="venue" value="Место" />
        <x-text-input id="venue" name="venue" type="text" class="mt-1 block w-full" :value="old('venue', $event->venue)" required />
        <x-input-error :messages="$errors->get('venue')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="price" value="Цена (RUB)" />
        <x-text-input id="price" name="price" type="number" step="0.01" min="0" class="mt-1 block w-full" :value="old('price', $event->price)" required />
        <x-input-error :messages="$errors->get('price')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="capacity" value="Лимит мест (опционально)" />
        <x-text-input id="capacity" name="capacity" type="number" min="1" class="mt-1 block w-full" :value="old('capacity', $event->capacity)" />
        <x-input-error :messages="$errors->get('capacity')" class="mt-2" />
    </div>

    <div class="md:col-span-2">
        <x-input-label for="poster" value="Афиша" />
        <input id="poster" name="poster" type="file" accept="image/*" class="mt-1 block w-full text-sm text-gray-600" />
        <x-input-error :messages="$errors->get('poster')" class="mt-2" />

        @if ($event->poster_path)
            <img src="{{ asset('storage/'.$event->poster_path) }}" alt="{{ $event->title }}" class="mt-3 h-36 w-auto rounded border" />
        @endif
    </div>
</div>

<div class="mt-6 flex items-center gap-3">
    <x-primary-button>{{ $buttonLabel }}</x-primary-button>
    <a href="{{ route('events.index') }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Отмена</a>
</div>

