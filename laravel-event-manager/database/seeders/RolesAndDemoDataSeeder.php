<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\Organizer;
use App\Models\Participant;
use App\Models\Registration;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RolesAndDemoDataSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@events.local'],
            [
                'name' => 'Администратор',
                'role' => 'admin',
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ]
        );

        $organizerUser = User::query()->updateOrCreate(
            ['email' => 'organizer@events.local'],
            [
                'name' => 'Организатор',
                'role' => 'organizer',
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ]
        );

        $participantUser = User::query()->updateOrCreate(
            ['email' => 'participant@events.local'],
            [
                'name' => 'Участник',
                'role' => 'participant',
                'email_verified_at' => now(),
                'password' => Hash::make('password'),
            ]
        );

        Organizer::query()->whereNotIn('user_id', [$organizerUser->id, null])->delete();
        Participant::query()->whereNotIn('user_id', [$participantUser->id, null])->delete();

        $mainOrganizer = Organizer::query()->updateOrCreate(
            ['user_id' => $organizerUser->id],
            [
                'name' => 'Агентство городских событий',
                'contacts' => '+7 (900) 123-45-67, organizer@events.local',
                'website' => 'https://events.local',
                'description' => 'Организация образовательных и городских мероприятий.',
            ]
        );

        $secondOrganizer = Organizer::factory()->create([
            'name' => 'Культурный центр Вектор',
            'contacts' => '+7 (900) 555-10-10, info@vector.local',
        ]);

        $participantProfile = Participant::query()->updateOrCreate(
            ['user_id' => $participantUser->id],
            [
                'full_name' => 'Иван Петров',
                'email' => 'participant@events.local',
                'phone' => '+7 (921) 111-22-33',
                'notes' => 'Интерес к IT и образовательным мероприятиям',
            ]
        );

        $otherParticipants = Participant::factory(15)->create();
        $allParticipants = $otherParticipants->prepend($participantProfile);

        $baseEvents = collect([
            [
                'title' => 'Конференция по веб-разработке',
                'description' => 'Практические доклады по Laravel, архитектуре и тестированию.',
                'starts_at' => now()->addDays(7)->setTime(11, 0),
                'venue' => 'Москва, Технопарк Сириус',
                'price' => 3500,
                'capacity' => 180,
            ],
            [
                'title' => 'Открытая лекция по управлению проектами',
                'description' => 'Инструменты планирования, оценки сроков и управления рисками.',
                'starts_at' => now()->addDays(15)->setTime(18, 30),
                'venue' => 'Санкт-Петербург, Невский проспект, 20',
                'price' => 0,
                'capacity' => 120,
            ],
            [
                'title' => 'Осенний IT-форум',
                'description' => 'Обмен опытом между разработчиками, аналитиками и менеджерами.',
                'starts_at' => now()->addMonth()->setTime(10, 0),
                'venue' => 'Казань, Экспоцентр',
                'price' => 5000,
                'capacity' => 250,
            ],
        ])->map(fn (array $payload) => Event::query()->create($payload + ['organizer_id' => $mainOrganizer->id]));

        $extraEvents = Event::factory(4)->create(['organizer_id' => $secondOrganizer->id]);
        $events = $baseEvents->merge($extraEvents);

        $events->each(function (Event $event) use ($allParticipants): void {
            $picked = $allParticipants->random(rand(3, min(8, $allParticipants->count())));

            $picked->each(function (Participant $participant) use ($event): void {
                Registration::query()->updateOrCreate(
                    [
                        'event_id' => $event->id,
                        'participant_id' => $participant->id,
                    ],
                    [
                        'registered_at' => now()->subDays(rand(1, 30)),
                        'status' => collect(['pending', 'confirmed', 'confirmed', 'cancelled'])->random(),
                    ]
                );
            });
        });

        Registration::query()->updateOrCreate(
            [
                'event_id' => $baseEvents->first()->id,
                'participant_id' => $participantProfile->id,
            ],
            [
                'registered_at' => now()->subDays(3),
                'status' => 'confirmed',
            ]
        );

        $admin->touch();
    }
}
