import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MIN_EASE, RELEARN_MINUTES, isDue, newCardState, review } from './srs.ts';
import type { CardState } from './srs.ts';
import { buildSession } from './session.ts';
import { groupByLevel, validateWordList } from './wordlist.ts';
import type { Word } from './wordlist.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 11, 13);

test('first good review schedules 1 day, then 3 days, then interval * ease', () => {
  let s = newCardState('a', T0);
  s = review(s, 'good', T0);
  assert.equal(s.intervalDays, 1);
  assert.equal(s.dueAt, T0 + DAY);
  s = review(s, 'good', s.dueAt);
  assert.equal(s.intervalDays, 3);
  s = review(s, 'good', s.dueAt);
  assert.equal(s.intervalDays, Math.round(3 * 2.5)); // 8
  assert.equal(s.reps, 3);
  assert.equal(s.lapses, 0);
});

test('again resets progress, counts a lapse and re-queues in minutes', () => {
  let s = newCardState('a', T0);
  s = review(s, 'good', T0);
  s = review(s, 'good', T0 + DAY);
  const failed = review(s, 'again', T0 + 4 * DAY);
  assert.equal(failed.reps, 0);
  assert.equal(failed.intervalDays, 0);
  assert.equal(failed.lapses, 1);
  assert.equal(failed.dueAt, T0 + 4 * DAY + RELEARN_MINUTES * 60 * 1000);
  assert.ok(failed.ease < s.ease);
});

test('ease never drops below the floor', () => {
  let s: CardState = newCardState('a', T0);
  for (let i = 0; i < 30; i++) s = review(s, 'again', T0);
  assert.equal(s.ease, MIN_EASE);
  for (let i = 0; i < 30; i++) s = review(s, 'hard', T0);
  assert.equal(s.ease, MIN_EASE);
});

test('hard is never shorter than 1 day; easy on a new card is 4 days and raises ease', () => {
  const hard = review(newCardState('a', T0), 'hard', T0);
  assert.equal(hard.intervalDays, 1);
  const easy = review(newCardState('b', T0), 'easy', T0);
  assert.equal(easy.intervalDays, 4);
  assert.ok(easy.ease > 2.5);
});

test('isDue compares against dueAt inclusively', () => {
  const s = review(newCardState('a', T0), 'good', T0);
  assert.equal(isDue(s, T0 + DAY - 1), false);
  assert.equal(isDue(s, T0 + DAY), true);
});

test('bundled fixture words pass validation', () => {
  const words = JSON.parse(
    readFileSync(new URL('../../data/fixtures/sample-words.json', import.meta.url), 'utf8'),
  ) as Word[];
  assert.deepEqual(validateWordList(words), []);
  assert.equal(groupByLevel(words).get(1)?.length, words.length);
});

test('validation catches duplicates, bad levels and tone-number pinyin', () => {
  const base: Word = { id: 'x1', hanzi: '好', pinyin: 'hǎo', meaningEn: 'good', level: 1 };
  const issues = validateWordList([
    base,
    { ...base },
    { id: 'x2', hanzi: '坏', pinyin: 'huai4', meaningEn: 'bad', level: 10 },
    { id: 'x3', hanzi: '', pinyin: 'x', meaningEn: '', level: 1 },
  ]).map((i) => `${i.id}:${i.problem}`);
  assert.ok(issues.includes('x1:duplicate id'));
  assert.ok(issues.includes('x1:duplicate hanzi+pinyin'));
  assert.ok(issues.includes('x2:level out of range: 10'));
  assert.ok(issues.includes('x2:pinyin uses tone numbers, expected tone marks'));
  assert.ok(issues.includes('x3:empty hanzi'));
  assert.ok(issues.includes('x3:empty meaning'));
});

test('session puts most-overdue reviews first, then new cards within the allowance', () => {
  const words: Word[] = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
    id,
    hanzi: id,
    pinyin: id,
    meaningEn: id,
    level: 1 + (i % 2),
  }));
  const states: Record<string, CardState> = {
    a: { ...newCardState('a', T0), dueAt: T0 - 2 * DAY },
    b: { ...newCardState('b', T0), dueAt: T0 - 5 * DAY },
    c: { ...newCardState('c', T0), dueAt: T0 + DAY }, // not due yet
  };
  const session = buildSession({ words, states, now: T0, newPerDay: 3, newIntroducedToday: 2 });
  assert.deepEqual(
    session.map((s) => s.card.id),
    ['b', 'a', 'd'], // overdue b, a; one new card left in today's allowance of 3-2
  );
  const none = buildSession({ words, states, now: T0, newPerDay: 2, newIntroducedToday: 5 });
  assert.deepEqual(none.map((s) => s.card.id), ['b', 'a']); // allowance exhausted
});
