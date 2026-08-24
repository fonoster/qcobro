export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Races `promise` against a timeout, rejecting with a `TimeoutError` if it fires first.
 * Does not cancel `promise` itself — not possible for an in-flight promise — only stops
 * waiting on it; the timer is cleared once `promise` settles, whichever happens first.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
