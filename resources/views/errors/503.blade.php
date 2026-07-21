@php($page = \App\Support\MaintenancePage::data())
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="{{ $page['retry'] }}">
    <title>{{ $page['siteName'] }} — Update in progress</title>
    @if ($page['favicon'])<link rel="icon" href="{{ $page['favicon'] }}">@endif
    <style>
        *{box-sizing:border-box}
        body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
            font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
            background:#0b0f17;color:#e5e7eb;padding:24px}
        .card{max-width:480px;text-align:center}
        .logo{max-width:160px;max-height:64px;margin:0 auto 24px;display:block}
        h1{font-size:22px;font-weight:600;margin:0 0 12px}
        p{font-size:15px;line-height:1.6;color:#9ca3af;margin:0 0 8px}
        .spinner{width:28px;height:28px;margin:24px auto 0;border:3px solid #1f2937;
            border-top-color:#6366f1;border-radius:50%;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
    </style>
</head>
<body>
    <div class="card">
        @if ($page['logo'])
            <img class="logo" src="{{ $page['logo'] }}" alt="{{ $page['siteName'] }}">
        @endif
        <h1>Update in progress</h1>
        <p>{{ $page['message'] }}</p>
        <p>This page will refresh automatically.</p>
        <div class="spinner"></div>
    </div>
</body>
</html>
