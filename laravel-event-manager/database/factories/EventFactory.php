<?php

namespace Database\Factories;

use App\Models\Organizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Event>
 */
class EventFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = fake()->dateTimeBetween('+2 days', '+6 months');

        return [
            'organizer_id' => Organizer::factory(),
            'title' => fake()->randomElement([
                'Технологический митап',
                'Музыкальный вечер',
                'Бизнес-завтрак',
                'Фестиваль науки',
                'Городская лекция',
            ]).' '.fake()->city(),
            'description' => fake()->paragraph(3),
            'starts_at' => $start,
            'venue' => fake()->streetAddress().', '.fake()->city(),
            'price' => fake()->numberBetween(0, 15000),
            'capacity' => fake()->optional(0.8)->numberBetween(20, 400),
            'poster_path' => null,
        ];
    }
}
