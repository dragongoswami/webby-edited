@extends('emails.layouts.base')

@section('content')
    <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">
        {{ $heading }}
    </h2>

    @if (! empty($intro))
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #3f3f46;">
            {{ $intro }}
        </p>
    @endif

    @if (! empty($details))
        @include('emails.partials.details-box', [
            'title' => $detailsTitle ?? __('Ticket Details'),
            'details' => $details,
            'primaryColor' => $primaryColor,
        ])
    @endif

    @if (! empty($bodyHtml))
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
               style="margin: 16px 0 24px; background-color: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
            <tr>
                <td style="padding: 16px 20px;">
                    <div style="font-size: 15px; line-height: 24px; color: #3f3f46;">
                        {!! $bodyHtml !!}
                    </div>
                </td>
            </tr>
        </table>
    @endif

    @if (! empty($attachments))
        <p style="margin: 0 0 16px; font-size: 13px; line-height: 22px; color: #52525b;">
            <strong style="color: #18181b;">{{ __('Attachments:') }}</strong> {{ implode(', ', $attachments) }}
        </p>
    @endif

    @include('emails.partials.button', [
        'url' => $actionUrl,
        'text' => $actionText,
        'primaryColor' => $primaryColor,
        'primaryForeground' => $primaryForeground,
    ])

    @if (! empty($footer))
        <p style="margin: 24px 0 0; font-size: 14px; line-height: 22px; color: #71717a;">
            {{ $footer }}
        </p>
    @endif
@endsection
