// Persistence model for study progress. Pure functions + a tiny async store interface,
// so the format is testable here and the concrete storage (expo-sqlite, AsyncStorage...)
// can be plugged in on the device later.

import { MIN_EASE } from './srs.ts';
import type { CardState } from './srs.ts';

export const SCHEMA_VERSION = 1;
export const PROGRESS_KEY = 'progress.v1';

export type SavedProgress = {
  version: number;
  states: Record<string, CardState>;
  // How many new words were introduced on which local day (drives the daily new-card limit).
  newIntroduced: { day: string; count: number };
};

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function emptyProgress(): SavedProgress {
  return { version: SCHEMA_VERSION, states: {}, newIntroduced: { day: '', count: 0 } };
}

// Local calendar day as YYYY-MM-DD. `tzOffsetMinutes` follows Date#getTimezoneOffset
// (minutes behind UTC) and is a parameter so tests do not depend on the machine's zone.
export function dayKey(now: number, tzOffsetMinutes = new Date(now).getTimezoneOffset()): string {
  return new Date(now - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function newIntroducedToday(p: SavedProgress, now: number, tz?: number): number {
  return p.newIntroduced.day === dayKey(now, tz) ? p.newIntroduced.count : 0;
}

export function recordNewIntroduced(p: SavedProgress, now: number, count: number, tz?: number): SavedProgress {
  const today = dayKey(now, tz);
  const before = p.newIntroduced.day === today ? p.newIntroduced.count : 0;
  return { ...p, newIntroduced: { day: today, count: before + count } };
}

function isValidCard(id: string, c: unknown): c is CardState {
  if (typeof c !== 'object' || c === null) return false;
  const s = c as Record<string, unknown>;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  return (
    s.id === id &&
    num(s.ease) && s.ease >= MIN_EASE &&
    num(s.intervalDays) && s.intervalDays >= 0 &&
    Number.isInteger(s.reps) && (s.reps as number) >= 0 &&
    Number.isInteger(s.lapses) && (s.lapses as number) >= 0 &&
    num(s.dueAt)
  );
}

export function serializeProgress(p: SavedProgress): string {
  return JSON.stringify(p);
}

// Never throws: missing, corrupt or future-version data gives an empty progress rather
// than crashing the app on launch; individual malformed cards are dropped.
export function parseProgress(raw: string | null): SavedProgress {
  if (!raw) return emptyProgress();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (typeof data !== 'object' || data === null) return emptyProgress();
  const d = data as Record<string, unknown>;
  if (d.version !== SCHEMA_VERSION) return emptyProgress();

  const states: Record<string, CardState> = {};
  if (typeof d.states === 'object' && d.states !== null) {
    for (const [id, c] of Object.entries(d.states as Record<string, unknown>)) {
      if (isValidCard(id, c)) states[id] = c;
    }
  }
  const ni = d.newIntroduced as { day?: unknown; count?: unknown } | undefined;
  const newIntroduced =
    ni && typeof ni.day === 'string' && Number.isInteger(ni.count) && (ni.count as number) >= 0
      ? { day: ni.day, count: ni.count as number }
      : { day: '', count: 0 };
  return { version: SCHEMA_VERSION, states, newIntroduced };
}

export async function loadProgress(store: KeyValueStore, key = PROGRESS_KEY): Promise<SavedProgress> {
  try {
    return parseProgress(await store.getItem(key));
  } catch {
    return emptyProgress();
  }
}

export async function saveProgress(store: KeyValueStore, p: SavedProgress, key = PROGRESS_KEY): Promise<void> {
  await store.setItem(key, serializeProgress(p));
}
