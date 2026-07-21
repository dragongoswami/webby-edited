import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageBubble } from './MessageBubble';
import { ChatMessage } from '@/types/chat';

describe('MessageBubble', () => {
    it('renders user message content', () => {
        const message: ChatMessage = {
            id: '1',
            type: 'user',
            content: 'Hello, AI!',
            timestamp: new Date(),
        };

        render(<MessageBubble message={message} />);

        expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
    });

    it('renders assistant message content', () => {
        const message: ChatMessage = {
            id: '2',
            type: 'assistant',
            content: 'Hello! How can I help you?',
            timestamp: new Date(),
        };

        render(<MessageBubble message={message} />);

        expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
    });

    it('shows AI avatar for assistant messages', () => {
        const message: ChatMessage = {
            id: '2',
            type: 'assistant',
            content: 'Test response',
            timestamp: new Date(),
        };

        render(<MessageBubble message={message} />);

        expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('does not show avatar for user messages', () => {
        const message: ChatMessage = {
            id: '1',
            type: 'user',
            content: 'Test message',
            timestamp: new Date(),
        };

        render(<MessageBubble message={message} />);

        expect(screen.queryByText('AI')).not.toBeInTheDocument();
    });

    it('preserves whitespace in message content', () => {
        const message: ChatMessage = {
            id: '1',
            type: 'user',
            content: 'Line 1\nLine 2\nLine 3',
            timestamp: new Date(),
        };

        render(<MessageBubble message={message} />);

        const textElement = screen.getByText(/Line 1/);
        expect(textElement).toHaveClass('whitespace-pre-wrap');
    });

    describe('Markdown Support', () => {
        it('renders markdown in assistant messages', () => {
            const message: ChatMessage = {
                id: '1',
                type: 'assistant',
                content: '## Header\nThis is **bold** text',
                timestamp: new Date(),
            };
            render(<MessageBubble message={message} />);
            expect(screen.getByText('Header')).toBeInTheDocument();
            expect(screen.getByText('bold')).toBeInTheDocument();
        });

        it('renders markdown in user messages', () => {
            const message: ChatMessage = {
                id: '2',
                type: 'user',
                content: '**Bold message**',
                timestamp: new Date(),
            };
            render(<MessageBubble message={message} />);
            expect(screen.getByText('Bold message')).toBeInTheDocument();
        });

        it('renders plain text without markdown as-is', () => {
            const message: ChatMessage = {
                id: '3',
                type: 'assistant',
                content: 'Just plain text, no markdown',
                timestamp: new Date(),
            };
            render(<MessageBubble message={message} />);
            expect(screen.getByText('Just plain text, no markdown')).toBeInTheDocument();
        });
    });

    // Dispatcher boundary — a user message whose content starts with one of
    // the synthetic prefixes must render as the compact left-aligned event
    // bubble (isSyntheticEvent path), NOT the right-aligned primary bubble
    // used for regular text. Without this test the wiring between
    // MessageBubble and SyntheticEvent is silently untested; inverting the
    // condition or mismatching the prefix would ship without failing CI.
    describe('synthetic event dispatching', () => {
        it('renders [THEME_APPLY] as a compact left-aligned bubble with the preset title', () => {
            const message: ChatMessage = {
                id: 'theme-1',
                type: 'user',
                content:
                    '[THEME_APPLY] Applying Mocha theme\n\nI want to switch this site to the "Mocha" theme preset...',
                timestamp: new Date(),
            };
            const { container } = render(<MessageBubble message={message} />);

            // Compact title visible
            expect(screen.getByText('Applying Mocha theme')).toBeInTheDocument();
            // Left-aligned wrapper (synthetic path), not right-aligned
            expect(container.querySelector('.justify-start')).not.toBeNull();
            expect(container.querySelector('.justify-end')).toBeNull();
            // The raw 3 KB prompt body is NOT visible by default
            expect(
                screen.queryByText(/I want to switch this site to the "Mocha"/)
            ).not.toBeInTheDocument();
        });

        it('renders [BATCH_EDIT] through the synthetic dispatcher (no longer via the old primary bubble)', () => {
            const message: ChatMessage = {
                id: 'batch-1',
                type: 'user',
                content:
                    '[BATCH_EDIT] Update multiple elements:\n1. <h1.text-5xl>: "old" → "new"',
                timestamp: new Date(),
            };
            const { container } = render(<MessageBubble message={message} />);

            // Icon renders — uniquely identifies the batch-edit synthetic
            // bubble regardless of which translated title mock/runtime emits.
            expect(screen.getByText('📝')).toBeInTheDocument();
            // No longer wrapped in the right-aligned primary bubble that the
            // legacy inline BatchEditMessage used.
            expect(container.querySelector('.justify-end')).toBeNull();
            expect(container.querySelector('.justify-start')).not.toBeNull();
        });

        it('falls through to the normal right-aligned user bubble when a synthetic message has attachedFiles (no silent file drop)', () => {
            // Current call sites never attach files alongside a synthetic
            // payload — but if a future caller does, the compact bubble
            // would silently drop the file chips because the synthetic
            // branch renders before the attachedFiles block. Guard: when
            // attachedFiles is non-empty, render the full bubble.
            const message: ChatMessage = {
                id: 'hybrid-1',
                type: 'user',
                content: '[AI_EDIT] Improve the styling of <h1>: "Welcome"',
                timestamp: new Date(),
                attachedFiles: [
                    {
                        id: 1,
                        filename: 'ref.png',
                        mime_type: 'image/png',
                        size: 1234,
                        human_size: '1.2 KB',
                        is_image: true,
                        url: '/tmp/ref.png',
                    },
                ],
            };
            const { container } = render(<MessageBubble message={message} />);

            // Should render as the right-aligned primary bubble, not the
            // compact synthetic bubble — so the file chip is visible.
            expect(container.querySelector('.justify-end')).not.toBeNull();
            expect(screen.getByText('ref.png')).toBeInTheDocument();
        });

        it('non-synthetic user text still renders in the right-aligned primary bubble', () => {
            const message: ChatMessage = {
                id: 'normal-1',
                type: 'user',
                content: 'Add a gallery section',
                timestamp: new Date(),
            };
            const { container } = render(<MessageBubble message={message} />);
            expect(screen.getByText('Add a gallery section')).toBeInTheDocument();
            expect(container.querySelector('.justify-end')).not.toBeNull();
        });
    });
});
