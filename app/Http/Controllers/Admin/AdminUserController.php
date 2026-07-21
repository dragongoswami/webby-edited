<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Traits\ChecksDemoMode;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class AdminUserController extends Controller
{
    use ChecksDemoMode;

    public function index(Request $request): Response
    {
        $perPage = min(max(1, (int) $request->input('per_page', 10)), 100);
        $search = trim((string) $request->input('search', ''));

        $query = User::query()
            ->withCount('projects')
            ->orderBy('created_at', 'desc');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->paginate($perPage)->withQueryString();
        $isDemo = config('app.demo');

        return Inertia::render('Admin/Users', [
            'user' => $request->user()->only('id', 'name', 'email', 'avatar', 'role'),
            'users' => $users->through(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $isDemo && $user->role !== 'admin' ? $this->maskEmail($user->email) : $user->email,
                'role' => $user->role,
                'status' => $user->status ?? 'active',
                'projects_count' => $user->projects_count,
                'created_at' => $user->created_at->toISOString(),
                'is_super_admin' => $user->isSuperAdmin(),
            ]),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validated();
        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);
        $user->email_verified_at = now();
        $user->save();

        return back()->with('success', __('User created successfully'));
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validated();

        if (isset($validated['password']) && $validated['password']) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        if ($user->id === $request->user()->id && isset($validated['role']) && $validated['role'] !== 'admin') {
            return back()->withErrors(['role' => __('You cannot change your own admin role')]);
        }

        if ($user->isSuperAdmin()) {
            if (isset($validated['role']) && $validated['role'] !== 'admin') {
                return back()->withErrors(['role' => __('The super admin role cannot be changed.')]);
            }

            if (isset($validated['status']) && $validated['status'] !== 'active') {
                return back()->withErrors(['status' => __('The super admin account cannot be deactivated.')]);
            }
        }

        $user->update($validated);

        return back()->with('success', __('User updated successfully'));
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        if ($user->id === $request->user()->id) {
            return back()->withErrors(['error' => __('You cannot delete your own account')]);
        }

        if ($user->isSuperAdmin()) {
            return back()->withErrors(['error' => __('The super admin account cannot be deleted.')]);
        }

        // Personal API keys are morph-keyed (no FK cascade) — delete explicitly.
        $user->tokens()->delete();

        $user->delete();

        return back()->with('success', __('User deleted successfully'));
    }

    /**
     * Search users by name or email for autocomplete.
     */
    public function search(Request $request): JsonResponse
    {
        $search = $request->input('search', '');

        if (strlen($search) < 2) {
            return response()->json(['users' => []]);
        }

        $users = User::query()
            ->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            })
            ->limit(20)
            ->get(['id', 'name', 'email', 'role']);

        if (config('app.demo')) {
            $users->transform(function ($user) {
                if ($user->role !== 'admin') {
                    $user->email = $this->maskEmail($user->email);
                }
                unset($user->role);

                return $user;
            });
        }

        return response()->json(['users' => $users]);
    }

    /**
     * Mask an email address for demo mode (e.g. "j***@gmail.com").
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return '***@***.***';
        }

        $local = $parts[0];
        $domain = $parts[1];
        $maskedLocal = substr($local, 0, 1).str_repeat('*', max(strlen($local) - 1, 2));

        return $maskedLocal.'@'.$domain;
    }
}
