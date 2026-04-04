<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin', 'organizer') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'event_id' => ['required', 'exists:events,id'],
            'participant_id' => ['required', 'exists:participants,id'],
            'registered_at' => ['required', 'date'],
            'status' => ['required', 'in:pending,confirmed,cancelled'],
        ];
    }
}

