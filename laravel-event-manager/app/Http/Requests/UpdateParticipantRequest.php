<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateParticipantRequest extends FormRequest
{
    public function authorize(): bool
    {
        $participant = $this->route('participant');
        $user = $this->user();

        if (! $user || ! $participant) {
            return false;
        }

        return $user->hasRole('admin') || $participant->user_id === $user->id;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $participant = $this->route('participant');

        return [
            'user_id' => [
                'nullable',
                'exists:users,id',
                Rule::unique('participants', 'user_id')->ignore($participant?->id),
            ],
            'full_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('participants', 'email')->ignore($participant?->id)],
            'phone' => ['required', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}

