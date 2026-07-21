<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockImage;
use Illuminate\Http\JsonResponse;

class ImageLibraryApiController extends Controller
{
    public function index(): JsonResponse
    {
        $images = StockImage::all([
            'filename', 'type', 'subject', 'category',
            'categories', 'mood', 'tone', 'contrast',
        ]);

        return response()->json([
            'images' => $images,
        ]);
    }
}
