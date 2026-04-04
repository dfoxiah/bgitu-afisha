@if (session('success') || session('error'))
    <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 mt-4">
        @if (session('success'))
            <div class="rounded-md bg-emerald-100 text-emerald-900 px-4 py-3 text-sm">
                {{ session('success') }}
            </div>
        @endif

        @if (session('error'))
            <div class="rounded-md bg-red-100 text-red-900 px-4 py-3 text-sm mt-2">
                {{ session('error') }}
            </div>
        @endif
    </div>
@endif

