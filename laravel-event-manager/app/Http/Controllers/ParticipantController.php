<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreParticipantRequest;
use App\Http\Requests\UpdateParticipantRequest;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ParticipantController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->string('q'));

        $query = Participant::query()->withCount('registrations')->with('user');

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $participants = $query->orderBy('full_name')->paginate(10)->withQueryString();

        return view('participants.index', compact('participants', 'search'));
    }

    public function create(): View
    {
        $users = User::query()
            ->where('role', 'participant')
            ->whereDoesntHave('participant')
            ->orderBy('name')
            ->get();

        return view('participants.create', [
            'participant' => new Participant(),
            'users' => $users,
        ]);
    }

    public function store(StoreParticipantRequest $request): RedirectResponse
    {
        $participant = Participant::create($request->validated());

        return redirect()
            ->route('participants.show', $participant)
            ->with('success', 'Участник создан.');
    }

    public function show(Participant $participant): View
    {
        $participant->load(['registrations.event']);

        return view('participants.show', compact('participant'));
    }

    public function edit(Participant $participant): View
    {
        $users = User::query()
            ->where('role', 'participant')
            ->where(function ($q) use ($participant): void {
                $q->whereDoesntHave('participant')->orWhere('id', $participant->user_id);
            })
            ->orderBy('name')
            ->get();

        return view('participants.edit', compact('participant', 'users'));
    }

    public function update(UpdateParticipantRequest $request, Participant $participant): RedirectResponse
    {
        $participant->update($request->validated());

        return redirect()
            ->route('participants.show', $participant)
            ->with('success', 'Участник обновлен.');
    }

    public function destroy(Participant $participant): RedirectResponse
    {
        $participant->delete();

        return redirect()
            ->route('participants.index')
            ->with('success', 'Участник удален.');
    }
}

