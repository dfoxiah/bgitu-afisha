<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Event extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'organizer_id',
        'title',
        'description',
        'starts_at',
        'venue',
        'price',
        'capacity',
        'poster_path',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'price' => 'decimal:2',
        ];
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Organizer::class);
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(Registration::class);
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(Participant::class, 'registrations')
            ->withPivot(['status', 'registered_at'])
            ->withTimestamps();
    }

    public function hasAvailableSlots(): bool
    {
        if ($this->capacity === null) {
            return true;
        }

        $activeCount = $this->registrations()
            ->whereIn('status', ['pending', 'confirmed'])
            ->count();

        return $activeCount < $this->capacity;
    }
}

