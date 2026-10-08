// Spaced-repetition scheduler (SM-2 style). Pure functions, no I/O, so it can be
// unit-tested without a device.

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export type CardState = {
  id: string;
  ease: number; // growth multiplier for the interval
  intervalDays: number;
  reps: number; // consecutive successful reviews
  lapses: number; // times the card was forgotten
  dueAt: number; // epoch ms
};

export const MIN_EASE = 1.3;
export const START_EASE = 2.5;
export const RELEARN_MINUTES = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export function newCardState(id: string, now: number): CardState {
  return { id, ease: START_EASE, intervalDays: 0, reps: 0, lapses: 0, dueAt: now };
}

export function review(state: CardState, grade: Grade, now: number): CardState {
  if (grade === 'again') {
    return {
      ...state,
      ease: Math.max(MIN_EASE, state.ease - 0.2),
      intervalDays: 0,
      reps: 0,
      lapses: state.lapses + 1,
      dueAt: now + RELEARN_MINUTES * 60 * 1000,
    };
  }

  let intervalDays: number;
  let ease = state.ease;

  if (grade === 'hard') {
    ease = Math.max(MIN_EASE, ease - 0.15);
    intervalDays = Math.max(1, Math.round(state.intervalDays * 1.2));
  } else if (grade === 'good') {
    intervalDays =
      state.reps === 0 ? 1 : state.reps === 1 ? 3 : Math.round(state.intervalDays * ease);
  } else {
    ease = ease + 0.15;
    intervalDays =
      state.reps === 0 ? 4 : Math.max(4, Math.round(state.intervalDays * ease * 1.3));
  }

  return {
    ...state,
    ease,
    intervalDays,
    reps: state.reps + 1,
    dueAt: now + intervalDays * DAY_MS,
  };
}

export function isDue(state: CardState, now: number): boolean {
  return state.dueAt <= now;
}
