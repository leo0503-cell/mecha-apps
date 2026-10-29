export const TRIAL_MS = 30_000;
export function secondsRemaining(deadline: number, now: number): number {
  return Math.max(0, Math.min(30, Math.ceil((deadline - now) / 1000)));
}
export function getDeadline(id: string, now = Date.now()): number {
  const key = `mecha.hub.trial.${id}`;
  try {
    const raw = sessionStorage.getItem(key);
    const stored = Number(raw);
    if (raw !== null && Number.isFinite(stored) && stored > 0)
      return Math.min(stored, now + TRIAL_MS);
    const deadline = now + TRIAL_MS;
    sessionStorage.setItem(key, String(deadline));
    return deadline;
  } catch {
    return now + TRIAL_MS;
  }
}
