<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreOrganizerRequest;
use App\Http\Requests\UpdateOrganizerRequest;
use App\Models\Organizer;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class OrganizerController extends Controller
{
    public function index(Request $request): View
    {
        $search = trim((string) $request->string('q'));

        $query = Organizer::query()->withCount('events')->with('user');

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('contacts', 'like', "%{$search}%");
            });
        }

        $organizers = $query->orderBy('name')->paginate(10)->withQueryString();

        return view('organizers.index', compact('organizers', 'search'));
    }

    public function create(): View
    {
        $users = User::query()
            ->where('role', 'organizer')
            ->whereDoesntHave('organizer')
            ->orderBy('name')
            ->get();

        return view('organizers.create', [
            'organizer' => new Organizer(),
            'users' => $users,
        ]);
    }

    public function store(StoreOrganizerRequest $request): RedirectResponse
    {
        $organizer = Organizer::create($request->validated());

        return redirect()
            ->route('organizers.show', $organizer)
            ->with('success', 'Организатор создан.');
    }

    public function show(Organizer $organizer): View
    {
        $organizer->load('events');

        return view('organizers.show', compact('organizer'));
    }

    public function edit(Organizer $organizer): View
    {
        $users = User::query()
            ->where('role', 'organizer')
            ->where(function ($q) use ($organizer): void {
                $q->whereDoesntHave('organizer')->orWhere('id', $organizer->user_id);
            })
            ->orderBy('name')
            ->get();

        return view('organizers.edit', compact('organizer', 'users'));
    }

    public function update(UpdateOrganizerRequest $request, Organizer $organizer): RedirectResponse
    {
        $organizer->update($request->validated());

        return redirect()
            ->route('organizers.show', $organizer)
            ->with('success', 'Организатор обновлен.');
    }

    public function destroy(Organizer $organizer): RedirectResponse
    {
        $organizer->delete();

        return redirect()
            ->route('organizers.index')
            ->with('success', 'Организатор удален.');
    }
}

