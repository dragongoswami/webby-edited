<?php

namespace App\Http\Controllers\Admin;

use App\Helpers\CurrencyHelper;
use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Models\CreditPack;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class AdminCreditPackController extends Controller
{
    use ChecksDemoMode;

    public function index(Request $request)
    {
        $query = CreditPack::query()->orderBy('sort_order');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->status === 'active');
        }

        return Inertia::render('Admin/CreditPacks/Index', [
            'creditPacks' => $query->with('plans:id,name')->get(),
            'plans' => Plan::query()->orderBy('name')->get(['id', 'name']),
            'stats' => [
                'total_packs' => CreditPack::count(),
                'active_packs' => CreditPack::where('is_active', true)->count(),
            ],
            'filters' => $request->only(['search', 'status']),
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/CreditPacks/Create', [
            'plans' => Plan::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function edit(CreditPack $creditPack)
    {
        return Inertia::render('Admin/CreditPacks/Edit', [
            'creditPack' => $creditPack->load('plans:id,name'),
            'plans' => Plan::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $this->validatePack($request);

        DB::transaction(function () use ($validated) {
            $pack = CreditPack::create([
                'name' => $validated['name'],
                'slug' => Str::slug($validated['name']),
                'description' => $validated['description'] ?? null,
                'credits' => $validated['credits'],
                'bonus_credits' => $validated['bonus_credits'] ?? 0,
                'price' => $validated['price'],
                'currency' => CurrencyHelper::getCode(),
                'is_active' => $validated['is_active'] ?? true,
                'is_popular' => $validated['is_popular'] ?? false,
                'sort_order' => $validated['sort_order'] ?? 0,
            ]);

            $pack->plans()->sync($validated['plan_ids'] ?? []);
        });

        return redirect()->route('admin.credit-packs')->with('success', __('Credit pack created successfully.'));
    }

    public function update(Request $request, CreditPack $creditPack)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $this->validatePack($request, $creditPack->id);

        DB::transaction(function () use ($request, $creditPack, $validated) {
            $creditPack->update([
                'name' => $validated['name'],
                'slug' => Str::slug($validated['name']),
                'description' => $validated['description'] ?? null,
                'credits' => $validated['credits'],
                'bonus_credits' => $validated['bonus_credits'] ?? 0,
                'price' => $validated['price'],
                'currency' => CurrencyHelper::getCode(),
                'is_active' => $validated['is_active'] ?? $creditPack->is_active,
                'is_popular' => $validated['is_popular'] ?? $creditPack->is_popular,
                'sort_order' => $validated['sort_order'] ?? $creditPack->sort_order,
            ]);

            if ($request->has('plan_ids')) {
                $creditPack->plans()->sync($validated['plan_ids'] ?? []);
            }
        });

        return redirect()->route('admin.credit-packs')->with('success', __('Credit pack updated successfully.'));
    }

    public function destroy(CreditPack $creditPack)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $creditPack->delete();

        return back()->with('success', __('Credit pack deleted successfully.'));
    }

    public function toggleStatus(CreditPack $creditPack)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $creditPack->update(['is_active' => ! $creditPack->is_active]);

        $status = $creditPack->is_active ? 'activated' : 'deactivated';

        return back()->with('success', __('Credit pack :status successfully.', ['status' => $status]));
    }

    public function reorder(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'creditPacks' => 'required|array',
            'creditPacks.*.id' => 'required|exists:credit_packs,id',
            'creditPacks.*.sort_order' => 'required|integer|min:0',
        ]);

        foreach ($request->creditPacks as $packData) {
            CreditPack::where('id', $packData['id'])->update(['sort_order' => $packData['sort_order']]);
        }

        return response()->json(['success' => true]);
    }

    private function validatePack(Request $request, ?int $ignoreId = null): array
    {
        $request->merge(['slug' => Str::slug((string) $request->input('name'))]);

        return $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('credit_packs', 'name')->ignore($ignoreId)],
            'slug' => [Rule::unique('credit_packs', 'slug')->ignore($ignoreId)],
            'description' => 'nullable|string|max:1000',
            'credits' => 'required|integer|min:1',
            'bonus_credits' => 'nullable|integer|min:0',
            'price' => 'required|numeric|min:0',
            'is_active' => 'boolean',
            'is_popular' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
            'plan_ids' => 'nullable|array',
            'plan_ids.*' => 'integer|exists:plans,id',
        ], [
            'slug.unique' => __('A credit pack with a similar name already exists.'),
        ]);
    }
}
