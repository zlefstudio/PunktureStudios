// Serializes sync and restore, including across tabs on the same origin.
let tail: Promise<unknown> = Promise.resolve();
export function withDataLock<T>(work: () => Promise<T>): Promise<T> {
  const run = () => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('punkture-data', work)
    : work();
  const next = tail.then(run, run);
  tail = next.catch(() => { });
  return next;
}
