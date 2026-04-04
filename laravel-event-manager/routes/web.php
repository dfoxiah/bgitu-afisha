<?php

use App\Http\Controllers\CalendarController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EventAnnouncementController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\OrganizerController;
use App\Http\Controllers\ParticipantController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RegistrationController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('events.index');
});

Route::get('/events', [EventController::class, 'index'])->name('events.index');
Route::get('/events/{event}', [EventController::class, 'show'])
    ->whereNumber('event')
    ->name('events.show');
Route::get('/calendar', [CalendarController::class, 'index'])->name('calendar.index');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    Route::post('/events/{event}/register', [EventController::class, 'register'])->name('events.register');
    Route::delete('/events/{event}/register', [EventController::class, 'unregister'])->name('events.unregister');

    Route::middleware('role:admin,organizer')->group(function () {
        Route::resource('events', EventController::class)->except(['index', 'show']);
        Route::resource('registrations', RegistrationController::class);
        Route::get('/events/{event}/announcements/create', [EventAnnouncementController::class, 'create'])->name('events.announcements.create');
        Route::post('/events/{event}/announcements', [EventAnnouncementController::class, 'store'])->name('events.announcements.store');
    });

    Route::middleware('role:admin')->group(function () {
        Route::resource('organizers', OrganizerController::class);
        Route::resource('participants', ParticipantController::class);
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

