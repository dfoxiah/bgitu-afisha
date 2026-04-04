<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\Organizer;
use App\Models\Participant;
use App\Models\Registration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventRegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_participant_can_register_and_cancel_registration(): void
    {
        $user = User::factory()->participant()->create([
            'email_verified_at' => now(),
        ]);

        $participant = Participant::factory()->create([
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        $event = Event::factory()->create([
            'organizer_id' => Organizer::factory()->create()->id,
        ]);

        $this->actingAs($user)
            ->post(route('events.register', $event))
            ->assertRedirect();

        $this->assertDatabaseHas('registrations', [
            'event_id' => $event->id,
            'participant_id' => $participant->id,
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->delete(route('events.unregister', $event))
            ->assertRedirect();

        $this->assertDatabaseHas('registrations', [
            'event_id' => $event->id,
            'participant_id' => $participant->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_duplicate_registration_is_blocked(): void
    {
        $user = User::factory()->participant()->create([
            'email_verified_at' => now(),
        ]);

        $participant = Participant::factory()->create([
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        $event = Event::factory()->create([
            'organizer_id' => Organizer::factory()->create()->id,
        ]);

        Registration::factory()->create([
            'event_id' => $event->id,
            'participant_id' => $participant->id,
            'status' => 'confirmed',
        ]);

        $this->actingAs($user)
            ->post(route('events.register', $event))
            ->assertRedirect()
            ->assertSessionHas('error');
    }
}
