<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Models\StockImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class AdminStockImageController extends Controller
{
    use ChecksDemoMode;

    public function index(Request $request): Response
    {
        $query = StockImage::query();

        if ($type = $request->input('type')) {
            if (in_array($type, ['background', 'gallery'])) {
                $query->where('type', $type);
            }
        }

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }

        if ($search = $request->input('search')) {
            $escaped = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $query->where(function ($q) use ($escaped) {
                $q->where('filename', 'like', "%{$escaped}%")
                    ->orWhere('subject', 'like', "%{$escaped}%")
                    ->orWhere('category', 'like', "%{$escaped}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $images = $query->latest()->paginate($perPage);

        return Inertia::render('Admin/StockImages/Index', [
            'images' => $images,
            'stats' => [
                'total' => StockImage::count(),
                'backgrounds' => StockImage::where('type', 'background')->count(),
                'gallery' => StockImage::where('type', 'gallery')->count(),
            ],
            'categories' => StockImage::select('category')
                ->distinct()
                ->orderBy('category')
                ->pluck('category'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'image' => 'required|image|max:2048',
            'type' => 'required|in:background,gallery',
        ]);

        $file = $request->file('image');
        $type = $request->input('type');
        $subdir = $type === 'background' ? 'backgrounds' : 'gallery';

        $request->validate([
            'subject' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'],
            'category' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'],
            'mood' => ['nullable', 'string', 'max:50', 'regex:/^[a-z0-9-]*$/'],
            'tone' => 'required|in:light,dark,warm,cool,neutral',
            'contrast' => 'required|in:dark-text,light-text',
        ]);

        $meta = [
            'subject' => $request->input('subject'),
            'category' => $request->input('category'),
            'categories' => $request->filled('categories')
                ? $request->input('categories')
                : explode('-', $request->input('category')),
            'mood' => $request->input('mood') ?: null,
            'tone' => $request->input('tone'),
            'contrast' => $request->input('contrast'),
        ];

        // Build filename from metadata following the naming convention
        $prefix = $type === 'background' ? 'bg' : 'gal';
        $subject = $meta['subject'];
        $category = $meta['category'];
        $tone = $meta['tone'];
        $contrast = $meta['contrast'];

        if ($type === 'background' && ! empty($meta['mood'])) {
            $generatedName = "{$prefix}_{$subject}_{$category}_{$meta['mood']}_{$tone}_{$contrast}.jpeg";
        } else {
            $generatedName = "{$prefix}_{$subject}_{$category}_{$tone}_{$contrast}.jpeg";
        }

        // Sanitize
        $generatedName = preg_replace('/[^a-zA-Z0-9_.-]/', '-', $generatedName);

        if (StockImage::where('filename', $generatedName)->exists()) {
            return back()->withErrors(['subject' => __('An image with this metadata already exists.')]);
        }

        $file->storeAs("image-library/{$subdir}", $generatedName, 'public');
        $filename = $generatedName;

        StockImage::create(array_merge($meta, [
            'filename' => $filename,
            'type' => $type,
        ]));

        return redirect()->route('admin.stock-images')
            ->with('success', __('Stock image added successfully'));
    }

    public function update(Request $request, StockImage $stockImage): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'category' => ['sometimes', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'],
            'categories' => 'sometimes|array',
            'categories.*' => ['string', 'regex:/^[a-z0-9]+$/'],
            'mood' => ['nullable', 'string', 'max:50', 'regex:/^[a-z0-9-]*$/'],
            'tone' => 'sometimes|in:light,dark,warm,cool,neutral',
            'contrast' => 'sometimes|in:dark-text,light-text',
        ]);

        $stockImage->update($validated);

        return redirect()->route('admin.stock-images')
            ->with('success', __('Stock image updated successfully'));
    }

    public function destroy(StockImage $stockImage): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $subdir = $stockImage->type === 'background' ? 'backgrounds' : 'gallery';
        Storage::disk('public')->delete("image-library/{$subdir}/{$stockImage->filename}");

        $stockImage->delete();

        return redirect()->route('admin.stock-images')
            ->with('success', __('Stock image deleted successfully'));
    }
}
