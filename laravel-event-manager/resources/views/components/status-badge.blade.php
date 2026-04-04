@props(['status'])

@php
    $map = [
        'pending' => 'bg-amber-100 text-amber-900',
        'confirmed' => 'bg-emerald-100 text-emerald-900',
        'cancelled' => 'bg-red-100 text-red-900',
    ];

    $class = $map[$status] ?? 'bg-gray-100 text-gray-900';
@endphp

<span {{ $attributes->merge(['class' => 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold '.$class]) }}>
    {{ ucfirst($status) }}
</span>

