<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrganizerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organizer = $this->route('organizer');

        return [
            'user_id' => [
                'nullable',
                'exists:users,id',
                Rule::unique('organizers', 'user_id')->ignore($organizer?->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'contacts' => ['required', 'string', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }
}

