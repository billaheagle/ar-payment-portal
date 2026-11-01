const RETRY_DELAYS_SECONDS = [10, 30, 120, 600, 1800];

export const nextAttemptAt = (attempts: number, now: Date): Date | null => {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(`Attempts must be a positive integer: ${String(attempts)}`);
  }
  if (Number.isNaN(now.getTime())) throw new Error('Invalid date for now');

  const delay = RETRY_DELAYS_SECONDS[attempts - 1];
  if (delay === undefined) return null;

  return new Date(now.getTime() + delay * 1000);
};
