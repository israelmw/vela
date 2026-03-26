/** Exponential backoff capped at 60s (wall clock for next_retry_at). */
export function computeRetryDelayMs(attemptZeroBased: number): number {
  const base = 1000 * Math.pow(2, Math.min(10, attemptZeroBased));
  return Math.min(60_000, base);
}
