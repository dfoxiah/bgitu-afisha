<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAnnouncementRequest;
use App\Models\Event;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Mail;
use Illuminate\View\View;

class EventAnnouncementController extends Controller
{
    public function create(Event $event): View
    {
        $this->authorizeEventAccess($event);

        return view('announcements.create', compact('event'));
    }

    public function store(StoreAnnouncementRequest $request, Event $event): RedirectResponse
    {
        $this->authorizeEventAccess($event);

        $data = $request->validated();

        $emails = $event->registrations()
            ->with('participant')
            ->whereIn('status', ['pending', 'confirmed'])
            ->get()
            ->pluck('participant.email')
            ->filter()
            ->unique();

        foreach ($emails as $email) {
            Mail::raw($data['message'], function ($message) use ($email, $data): void {
                $message->to($email)->subject($data['subject']);
            });
        }

        return redirect()
            ->route('events.show', $event)
            ->with('success', 'Рассылка отправлена: '.$emails->count().' получателей.');
    }

    private function authorizeEventAccess(Event $event): void
    {
        $user = auth()->user();
        abort_unless($user, 403);

        if ($user->hasRole('admin')) {
            return;
        }

        $event->loadMissing('organizer');
        abort_if($event->organizer->user_id !== $user->id, 403);
    }
}

