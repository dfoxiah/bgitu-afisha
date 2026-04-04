<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEventRequest;
use App\Http\Requests\UpdateEventRequest;
use App\Models\Event;
use App\Models\Organizer;
use App\Models\Registration;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class EventController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->string('q'));
        $sort = (string) $request->string('sort', 'starts_at_asc');

        $query = Event::query()
            ->with('organizer')
            ->withCount([
                'registrations as active_registrations_count' => function ($q) {
                    $q->whereIn('status', ['pending', 'confirmed']);
                },
            ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('venue', 'like', "%{$search}%")
                    ->orWhereHas('organizer', function ($organizerQuery) use ($search): void {
                        $organizerQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        switch ($sort) {
            case 'starts_at_desc':
                $query->orderByDesc('starts_at');
                break;
            case 'price_asc':
                $query->orderBy('price');
                break;
            case 'price_desc':
                $query->orderByDesc('price');
                break;
            default:
                $query->orderBy('starts_at');
        }

        $events = $query->paginate(10)->withQueryString();

        $monthlyStats = Event::query()
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->get()
            ->groupBy(fn (Event $event) => $event->starts_at->format('Y-m'))
            ->map(fn ($items) => $items->count())
            ->take(6);

        return view('events.index', compact('events', 'search', 'sort', 'monthlyStats'));
    }

    public function create(Request $request): View
    {
        $organizers = $this->allowedOrganizers($request);

        abort_if($organizers->isEmpty(), 403, 'Для этой учетной записи не привязан организатор.');

        return view('events.create', [
            'event' => new Event(),
            'organizers' => $organizers,
        ]);
    }

    public function store(StoreEventRequest $request): RedirectResponse
    {
        $data = $request->validated();
        unset($data['poster']);
        $data['organizer_id'] = $this->resolveOrganizerId($request, (int) $data['organizer_id']);

        if ($request->hasFile('poster')) {
            $data['poster_path'] = $request->file('poster')->store('posters', 'public');
        }

        $event = Event::create($data);

        return redirect()
            ->route('events.show', $event)
            ->with('success', 'Мероприятие создано.');
    }

    public function show(Event $event): View
    {
        $event->load(['organizer', 'registrations.participant']);

        $myRegistration = null;

        if (auth()->check() && auth()->user()->participant) {
            $myRegistration = Registration::query()
                ->where('event_id', $event->id)
                ->where('participant_id', auth()->user()->participant->id)
                ->first();
        }

        return view('events.show', compact('event', 'myRegistration'));
    }

    public function edit(Request $request, Event $event): View
    {
        $this->authorizeEventAccess($request, $event);

        return view('events.edit', [
            'event' => $event,
            'organizers' => $this->allowedOrganizers($request),
        ]);
    }

    public function update(UpdateEventRequest $request, Event $event): RedirectResponse
    {
        $this->authorizeEventAccess($request, $event);

        $data = $request->validated();
        unset($data['poster']);
        $data['organizer_id'] = $this->resolveOrganizerId($request, (int) $data['organizer_id']);

        if ($request->hasFile('poster')) {
            if ($event->poster_path) {
                Storage::disk('public')->delete($event->poster_path);
            }

            $data['poster_path'] = $request->file('poster')->store('posters', 'public');
        }

        $event->update($data);

        return redirect()
            ->route('events.show', $event)
            ->with('success', 'Мероприятие обновлено.');
    }

    public function destroy(Request $request, Event $event): RedirectResponse
    {
        $this->authorizeEventAccess($request, $event);

        if ($event->poster_path) {
            Storage::disk('public')->delete($event->poster_path);
        }

        $event->delete();

        return redirect()
            ->route('events.index')
            ->with('success', 'Мероприятие удалено.');
    }

    public function register(Request $request, Event $event): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $participant = $user->participant;

        if (! $participant) {
            $participant = $user->participant()->create([
                'full_name' => $user->name,
                'email' => $user->email,
                'phone' => 'Не указан',
            ]);
        }

        $registration = Registration::query()
            ->where('event_id', $event->id)
            ->where('participant_id', $participant->id)
            ->first();

        if ($registration && in_array($registration->status, ['pending', 'confirmed'], true)) {
            return back()->with('error', 'Вы уже зарегистрированы на это мероприятие.');
        }

        if (! $event->hasAvailableSlots()) {
            return back()->with('error', 'Свободных мест нет.');
        }

        Registration::updateOrCreate(
            ['event_id' => $event->id, 'participant_id' => $participant->id],
            ['registered_at' => now(), 'status' => 'pending']
        );

        return back()->with('success', 'Заявка на регистрацию отправлена.');
    }

    public function unregister(Request $request, Event $event): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $participant = $user->participant;
        if (! $participant) {
            return back()->with('error', 'Профиль участника не найден.');
        }

        $registration = Registration::query()
            ->where('event_id', $event->id)
            ->where('participant_id', $participant->id)
            ->first();

        if (! $registration) {
            return back()->with('error', 'Регистрация не найдена.');
        }

        $registration->update(['status' => 'cancelled']);

        return back()->with('success', 'Регистрация отменена.');
    }

    private function allowedOrganizers(Request $request)
    {
        $user = $request->user();

        if (! $user) {
            return collect();
        }

        if ($user->hasRole('admin')) {
            return Organizer::query()->orderBy('name')->get();
        }

        return Organizer::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->get();
    }

    private function resolveOrganizerId(Request $request, int $organizerId): int
    {
        $user = $request->user();
        abort_unless($user, 403);

        if ($user->hasRole('admin')) {
            return $organizerId;
        }

        $myOrganizerId = Organizer::query()
            ->where('user_id', $user->id)
            ->value('id');

        abort_if(! $myOrganizerId || $myOrganizerId !== $organizerId, 403);

        return $organizerId;
    }

    private function authorizeEventAccess(Request $request, Event $event): void
    {
        $user = $request->user();
        abort_unless($user, 403);

        if ($user->hasRole('admin')) {
            return;
        }

        $myOrganizerId = Organizer::query()
            ->where('user_id', $user->id)
            ->value('id');

        abort_if((int) $event->organizer_id !== (int) $myOrganizerId, 403);
    }
}


