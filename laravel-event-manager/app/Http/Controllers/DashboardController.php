<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Registration;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(): View
    {
        $upcomingEvents = Event::query()
            ->with('organizer')
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->take(5)
            ->get();

        $totalParticipants = Registration::query()->distinct('participant_id')->count('participant_id');

        $statusStats = Registration::query()
            ->where('registered_at', '>=', now()->subDays(30))
            ->get()
            ->groupBy('status')
            ->map(fn ($items) => $items->count());

        $estimatedRevenue = Registration::query()
            ->with('event')
            ->where('status', 'confirmed')
            ->get()
            ->sum(fn (Registration $registration) => (float) $registration->event->price);

        return view('dashboard', [
            'eventsCount' => Event::count(),
            'registrationsCount' => Registration::count(),
            'participantsCount' => $totalParticipants,
            'statusStats' => $statusStats,
            'estimatedRevenue' => $estimatedRevenue,
            'upcomingEvents' => $upcomingEvents,
        ]);
    }
}

