import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatFileUpload } from '../useChatFileUpload';
import type { AttachedFile } from '@/types/chat';

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        isAxiosError: vi.fn(),
    },
}));

import axios from 'axios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFile = (bytes: number, type: string, name = 'f') =>
    new File([new Uint8Array(bytes)], name, { type });

const mockServerFile = {
    id: 42,
    original_filename: 'pic.png',
    mime_type: 'image/png',
    size: 123,
    human_size: '123 B',
    is_image: true,
    url: '/x/pic.png',
};

const mockSuccessResponse = {
    data: {
        file: mockServerFile,
        storage_used: 999,
    },
};

// Default hook options
const defaultOpts = () => ({
    projectId: 'p1',
    maxFileSizeMb: 1,
    allowedTypes: null as string[] | null,
});

// ---------------------------------------------------------------------------

describe('useChatFileUpload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(axios.isAxiosError).mockReturnValue(false);
        vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // VALIDATION — returns null and sets uploadError WITHOUT calling axios.post
    // -----------------------------------------------------------------------

    it('test_rejects_file_exceeding_max_size', async () => {
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), maxFileSizeMb: 1 }),
        );

        const file = makeFile(2 * 1024 * 1024, 'image/png');
        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(file);
        });

        expect(res).toBeNull();
        expect(result.current.uploadError).toBe('File exceeds maximum size of 1 MB');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('test_allows_any_type_when_allowedTypes_null', async () => {
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), allowedTypes: null }),
        );

        const file = makeFile(100, 'application/x-custom');
        await act(async () => {
            await result.current.uploadFile(file);
        });

        expect(axios.post).toHaveBeenCalled();
    });

    it('test_allows_wildcard_prefix_match', async () => {
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), allowedTypes: ['image/*'] }),
        );

        // Positive: image/png matches the image/* wildcard prefix
        const allowed = makeFile(100, 'image/png');
        await act(async () => {
            await result.current.uploadFile(allowed);
        });
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Reset call records before the negative case
        vi.clearAllMocks();
        vi.mocked(axios.isAxiosError).mockReturnValue(false);

        // Negative: application/pdf does not match image/* prefix
        const rejected = makeFile(100, 'application/pdf');
        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(rejected);
        });
        expect(res).toBeNull();
        expect(result.current.uploadError).toBe('File type application/pdf is not allowed');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('test_allows_exact_type_match', async () => {
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), allowedTypes: ['application/pdf'] }),
        );

        // Positive: exact match
        const pdf = makeFile(100, 'application/pdf');
        await act(async () => {
            await result.current.uploadFile(pdf);
        });
        expect(axios.post).toHaveBeenCalledTimes(1);

        // Reset call records before the negative case
        vi.clearAllMocks();
        vi.mocked(axios.isAxiosError).mockReturnValue(false);

        // Negative: image/png is not in the allowed list
        const png = makeFile(100, 'image/png');
        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(png);
        });
        expect(res).toBeNull();
        expect(result.current.uploadError).toBe('File type image/png is not allowed');
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('test_star_slash_star_allows_anything', async () => {
        // '*/*' means "allow any MIME type" — validation must pass and axios.post must be called.
        vi.mocked(axios.post).mockResolvedValue(mockSuccessResponse);

        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), allowedTypes: ['*/*'] }),
        );

        const file = makeFile(100, 'application/zip');
        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(file);
        });

        expect(result.current.uploadError).toBeNull();
        expect(axios.post).toHaveBeenCalled();
        expect(res).not.toBeNull();
    });

    it('test_empty_allowedTypes_array_skips_type_check', async () => {
        // allowedTypes.length === 0 → the type-check block is skipped → any file passes
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), allowedTypes: [] }),
        );

        const file = makeFile(100, 'application/octet-stream');
        await act(async () => {
            await result.current.uploadFile(file);
        });

        expect(axios.post).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // SUCCESS — server response is mapped to AttachedFile
    // -----------------------------------------------------------------------

    it('test_successful_upload_maps_server_response', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: {
                file: {
                    id: 42,
                    original_filename: 'pic.png',
                    mime_type: 'image/png',
                    size: 123,
                    human_size: '123 B',
                    is_image: true,
                    url: '/x/pic.png',
                },
                storage_used: 999,
            },
        });

        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), allowedTypes: null }),
        );

        const file = makeFile(100, 'image/png', 'pic.png');
        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(file);
        });

        expect(res).toEqual<AttachedFile>({
            id: 42,
            filename: 'pic.png',      // mapped from original_filename
            mime_type: 'image/png',
            size: 123,
            human_size: '123 B',
            is_image: true,
            url: '/x/pic.png',
        });
        expect(result.current.uploadError).toBeNull();
        expect(result.current.isUploading).toBe(false);
        expect(axios.post).toHaveBeenCalledWith(
            '/project/p1/files',
            expect.any(FormData),
            expect.any(Object),
        );
    });

    // -----------------------------------------------------------------------
    // ERROR MAPPING
    // -----------------------------------------------------------------------

    it('test_axios_error_uses_response_error_field', async () => {
        vi.mocked(axios.isAxiosError).mockReturnValue(true);
        vi.mocked(axios.post).mockRejectedValue({
            response: { data: { error: 'Disk full' } },
        });

        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts() }),
        );

        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(makeFile(100, 'image/png'));
        });

        expect(res).toBeNull();
        expect(result.current.uploadError).toBe('Disk full');
    });

    it('test_axios_error_falls_back_to_message_then_generic', async () => {
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        // Case 1: error field absent, message present → use message
        vi.mocked(axios.post).mockRejectedValue({
            response: { data: { message: 'Bad request' } },
        });

        const { result: result1 } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts() }),
        );
        await act(async () => {
            await result1.current.uploadFile(makeFile(100, 'image/png'));
        });
        expect(result1.current.uploadError).toBe('Bad request');

        // Case 2: neither error nor message → generic fallback
        vi.mocked(axios.post).mockRejectedValue({
            response: { data: {} },
        });

        const { result: result2 } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts() }),
        );
        await act(async () => {
            await result2.current.uploadFile(makeFile(100, 'image/png'));
        });
        expect(result2.current.uploadError).toBe('Upload failed');
    });

    it('test_non_axios_error_is_generic', async () => {
        vi.mocked(axios.isAxiosError).mockReturnValue(false);
        vi.mocked(axios.post).mockRejectedValue(new Error('boom'));

        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts() }),
        );

        let res: AttachedFile | null | undefined;
        await act(async () => {
            res = await result.current.uploadFile(makeFile(100, 'image/png'));
        });

        expect(res).toBeNull();
        expect(result.current.uploadError).toBe('Upload failed');
    });

    // -----------------------------------------------------------------------
    // clearError
    // -----------------------------------------------------------------------

    it('test_clear_error_resets_upload_error', async () => {
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts(), maxFileSizeMb: 1 }),
        );

        // Trigger a validation error via an oversized file
        await act(async () => {
            await result.current.uploadFile(makeFile(2 * 1024 * 1024, 'image/png'));
        });
        expect(result.current.uploadError).not.toBeNull();

        // Calling clearError should reset the error to null
        act(() => {
            result.current.clearError();
        });
        expect(result.current.uploadError).toBeNull();
    });

    // -----------------------------------------------------------------------
    // isUploading lifecycle
    // -----------------------------------------------------------------------

    it('test_is_uploading_false_after_success_and_after_error', async () => {
        const { result } = renderHook(() =>
            useChatFileUpload({ ...defaultOpts() }),
        );

        // After a successful upload the finally block sets isUploading = false
        await act(async () => {
            await result.current.uploadFile(makeFile(100, 'image/png'));
        });
        expect(result.current.isUploading).toBe(false);

        // After a rejected upload the finally block still sets isUploading = false
        vi.mocked(axios.post).mockRejectedValue(new Error('network error'));
        await act(async () => {
            await result.current.uploadFile(makeFile(100, 'image/png'));
        });
        expect(result.current.isUploading).toBe(false);
    });
});
