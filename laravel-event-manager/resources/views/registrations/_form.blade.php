@csrf

<div class="grid gap-6 md:grid-cols-2">
    <div>
        <x-input-label for="event_id" value="Мероприятие" />
        <select id="event_id" name="event_id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
            <option value="">Выберите мероприятие</option>
            @foreach ($events as $event)
                <option value="{{ $event->id }}" @selected(old('event_id', $registration->event_id) == $event->id)>{{ $event->title }} ({{ $event->starts_at->format('d.m.Y H:i') }})</option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('event_id')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="participant_id" value="Участник" />
        <select id="participant_id" name="participant_id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
            <option value="">Выберите участника</option>
            @foreach ($participants as $participant)
                <option value="{{ $participant->id }}" @selected(old('participant_id', $registration->participant_id) == $participant->id)>{{ $participant->full_name }} ({{ $participant->email }})</option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('participant_id')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="registered_at" value="Дата регистрации" />
        <x-text-input id="registered_at" name="registered_at" type="datetime-local" class="mt-1 block w-full" :value="old('registered_at', $registration->registered_at?->format('Y-m-d\TH:i') ?? now()->format('Y-m-d\TH:i'))" required />
        <x-input-error :messages="$errors->get('registered_at')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="status" value="Статус" />
        <select id="status" name="status" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required>
            @foreach (['pending' => 'Ожидает', 'confirmed' => 'Подтверждено', 'cancelled' => 'Отменено'] as $value => $label)
                <option value="{{ $value }}" @selected(old('status', $registration->status ?? 'pending') === $value)>{{ $label }}</option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('status')" class="mt-2" />
    </div>
</div>

<div class="mt-6 flex items-center gap-3">
    <x-primary-button>{{ $buttonLabel }}</x-primary-button>
    <a href="{{ route('registrations.index') }}" class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Отмена</a>
</div>

