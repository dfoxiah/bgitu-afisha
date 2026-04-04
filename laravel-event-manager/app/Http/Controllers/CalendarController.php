<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CalendarController extends Controller
{
    public function index(Request $request): View
    {
        $month = (string) $request->string('month', now()->format('Y-m'));

        try {
            $currentMonth = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        } catch (\Throwable) {
            $currentMonth = now()->startOfMonth();
        }

        $start = $currentMonth->copy()->startOfWeek(Carbon::MONDAY);
        $end = $currentMonth->copy()->endOfMonth()->endOfWeek(Carbon::SUNDAY);

        $events = Event::query()
            ->with('organizer')
            ->whereBetween('starts_at', [$start, $end])
            ->orderBy('starts_at')
            ->get();

        $eventsByDate = $events->groupBy(fn (Event $event) => $event->starts_at->toDateString());

        $days = collect();
        for ($day = $start->copy(); $day->lte($end); $day->addDay()) {
            $days->push($day->copy());
        }

        return view('calendar.index', [
            'currentMonth' => $currentMonth,
            'days' => $days,
            'eventsByDate' => $eventsByDate,
            'prevMonth' => $currentMonth->copy()->subMonth()->format('Y-m'),
            'nextMonth' => $currentMonth->copy()->addMonth()->format('Y-m'),
        ]);
    }
}

