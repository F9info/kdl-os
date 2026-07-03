import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '../utils';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce regression', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('debounces value updates', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    expect(result.current).toBe('a');

    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    await vi.advanceTimersByTimeAsync(299);
    expect(result.current).toBe('a');

    await vi.advanceTimersByTimeAsync(1);
    expect(result.current).toBe('b');

    vi.useRealTimers();
  });

  it('cancels pending timers on unmount', async () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    unmount();

    await vi.advanceTimersByTimeAsync(300);
    expect(result.current).toBe('a');

    vi.useRealTimers();
  });
});
