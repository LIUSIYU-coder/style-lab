import { isDue, newCardState } from './srs.ts';
import type { CardState } from './srs.ts';
import type { Word } from './wordlist.ts';

export type SessionOptions = {
  words: Word[];
  states: Record<string, CardState>;
  now: number;
  newPerDay: number;
  newIntroducedToday: number;
};

// Due reviews come first (most overdue first), then unseen words up to the daily
// new-card allowance, in list order.
export function buildSession(opts: SessionOptions): { card: Word; state: CardState }[] {
  const { words, states, now, newPerDay, newIntroducedToday } = opts;

  const due = words
    .filter((w) => states[w.id] && isDue(states[w.id], now))
    .sort((a, b) => states[a.id].dueAt - states[b.id].dueAt)
    .map((w) => ({ card: w, state: states[w.id] }));

  const allowance = Math.max(0, newPerDay - newIntroducedToday);
  const fresh = words
    .filter((w) => !states[w.id])
    .slice(0, allowance)
    .map((w) => ({ card: w, state: newCardState(w.id, now) }));

  return [...due, ...fresh];
}
