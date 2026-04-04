<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRegistrationRequest;
use App\Http\Requests\UpdateRegistrationRequest;
use App\Models\Event;
use App\Models\Participant;
use App\Models\Registration;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class RegistrationController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->string('q'));
        $status = trim((string) $request->string('status'));

        $query = Registration::query()->with(['event.organizer', 'participant']);

        $user = $request->user();
        if ($user && $user->hasRole('organizer')) {
            $query->whereHas('event.organizer', function ($q) use ($user): void {
                $q->where('user_id', $user->id);
            });
        }

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->whereHas('event', function ($eventQuery) use ($search): void {
                    $eventQuery->where('title', 'like', "%{$search}%");
                })->orWhereHas('participant', function ($participantQuery) use ($search): void {
                    $participantQuery->where('full_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            });
        }

        $registrations = $query->orderByDesc('registered_at')->paginate(15)->withQueryString();

        return view('registrations.index', compact('registrations', 'search', 'status'));
    }

    public function create(Request $request): View
    {
        return view('registrations.create', [
            'registration' => new Registration(),
            'events' => $this->allowedEvents($request),
            'participants' => Participant::query()->orderBy('full_name')->get(),
        ]);
    }

    public function store(StoreRegistrationRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $exists = Registration::query()
            ->where('event_id', $data['event_id'])
            ->where('participant_id', $data['participant_id'])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'participant_id' => 'Этот участник уже связан с выбранным мероприятием.',
            ]);
        }

        Registration::create($data);

        return redirect()
            ->route('registrations.index')
            ->with('success', 'Регистрация создана.');
    }

    public function show(Registration $registration): View
    {
        $registration->load(['event.organizer', 'participant']);

        return view('registrations.show', compact('registration'));
    }

    public function edit(Request $request, Registration $registration): View
    {
        $this->authorizeRegistration($request, $registration);

        return view('registrations.edit', [
            'registration' => $registration,
            'events' => $this->allowedEvents($request),
            'participants' => Participant::query()->orderBy('full_name')->get(),
        ]);
    }

    public function update(UpdateRegistrationRequest $request, Registration $registration): RedirectResponse
    {
        $this->authorizeRegistration($request, $registration);

        $registration->update($request->validated());

        return redirect()
            ->route('registrations.show', $registration)
            ->with('success', 'Регистрация обновлена.');
    }

    public function destroy(Request $request, Registration $registration): RedirectResponse
    {
        $this->authorizeRegistration($request, $registration);

        $registration->delete();

        return redirect()
            ->route('registrations.index')
            ->with('success', 'Регистрация удалена.');
    }

    private function allowedEvents(Request $request)
    {
        $user = $request->user();

        if ($user && $user->hasRole('organizer')) {
            return Event::query()
                ->whereHas('organizer', function ($q) use ($user): void {
                    $q->where('user_id', $user->id);
                })
                ->orderBy('starts_at')
                ->get();
        }

        return Event::query()->orderBy('starts_at')->get();
    }

    private function authorizeRegistration(Request $request, Registration $registration): void
    {
        $user = $request->user();
        abort_unless($user, 403);

        if ($user->hasRole('admin')) {
            return;
        }

        $registration->loadMissing('event.organizer');
        abort_if($registration->event->organizer->user_id !== $user->id, 403);
    }
}

