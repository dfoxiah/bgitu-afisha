<?php

namespace Tests\Feature;

use App\Models\Organizer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_open_admin_resources(): void
    {
        $admin = User::factory()->admin()->create([
            'email_verified_at' => now(),
        ]);

        $this->actingAs($admin)
            ->get(route('organizers.index'))
            ->assertOk();

        $this->actingAs($admin)
            ->get(route('participants.index'))
            ->assertOk();
    }

    public function test_participant_cannot_open_admin_resources(): void
    {
        $participant = User::factory()->participant()->create([
            'email_verified_at' => now(),
        ]);

        $this->actingAs($participant)
            ->get(route('organizers.index'))
            ->assertForbidden();

        $this->actingAs($participant)
            ->get(route('registrations.index'))
            ->assertForbidden();
    }

    public function test_organizer_can_open_registrations_but_not_admin_resources(): void
    {
        $organizerUser = User::factory()->organizer()->create([
            'email_verified_at' => now(),
        ]);

        Organizer::factory()->create([
            'user_id' => $organizerUser->id,
        ]);

        $this->actingAs($organizerUser)
            ->get(route('registrations.index'))
            ->assertOk();

        $this->actingAs($organizerUser)
            ->get(route('organizers.index'))
            ->assertForbidden();
    }
}
