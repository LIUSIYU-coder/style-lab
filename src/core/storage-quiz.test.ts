import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newCardState, review } from './srs.ts';
import {
  dayKey, emptyProgress, loadProgress, newIntroducedToday, parseProgress,
  recordNewIntroduced, saveProgress, serializeProgress,
} from './storage.ts';
import type { KeyValueStore } from './storage.ts';
import { buildQuiz, scoreQuiz } from './quiz.ts';
import type { Word } from './wordlist.ts';

const T0 = Date.UTC(2026, 11, 13, 12, 0, 0);

test('progress round-trips through serialisation', () => {
  const p = emptyProgress();
  p.states.a = review(newCardState('a', T0), 'good', T0);
  p.states.b = review(newCardState('b', T0), 'again', T0);
  assert.deepEqual(parseProgress(serializeProgress(p)), p);
});

test('missing, corrupt or future-version data gives an empty progress, never throws', () => {
  assert.deepEqual(parseProgress(null), emptyProgress());
  assert.deepEqual(parseProgress('not json {'), emptyProgress());
  assert.deepEqual(parseProgress('42'), emptyProgress());
  assert.deepEqual(parseProgress(JSON.stringify({ version: 99, states: {} })), emptyProgress());
});

test('malformed cards are dropped, valid ones kept', () => {
  const good = newCardState('ok', T0);
  const raw = JSON.stringify({
    version: 1,
    states: {
      ok: good,
      wrongId: { ...good, id: 'someone-else' },
      badEase: { ...newCardState('badEase', T0), ease: 0.5 },
      nan: { ...newCardState('nan', T0), dueAt: 'soon' },
      negative: { ...newCardState('negative', T0), reps: -1 },
    },
    newIntroduced: { day: '2026-12-13', count: 3 },
  });
  const p = parseProgress(raw);
  assert.deepEqual(Object.keys(p.states), ['ok']);
  assert.equal(p.newIntroduced.count, 3);
});

test('daily new-word counter resets on a new local day', () => {
  const tz = -480; // UTC+8
  let p = emptyProgress();
  assert.equal(newIntroducedToday(p, T0, tz), 0);
  p = recordNewIntroduced(p, T0, 4, tz);
  p = recordNewIntroduced(p, T0 + 60_000, 3, tz);
  assert.equal(newIntroducedToday(p, T0 + 120_000, tz), 7);
  assert.equal(newIntroducedToday(p, T0 + 24 * 3600_000, tz), 0); // next day
});

test('dayKey follows the supplied timezone offset', () => {
  const t = Date.UTC(2026, 11, 13, 20, 0, 0); // 20:00 UTC
  assert.equal(dayKey(t, 0), '2026-12-13');
  assert.equal(dayKey(t, -480), '2026-12-14'); // 04:00 next day in UTC+8
  assert.equal(dayKey(t, 300), '2026-12-13'); // 15:00 in UTC-5
});

test('load/save go through the store; a failing store falls back to empty', async () => {
  const mem = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => mem.get(k) ?? null,
    setItem: async (k, v) => void mem.set(k, v),
  };
  const p = emptyProgress();
  p.states.a = newCardState('a', T0);
  await saveProgress(store, p);
  assert.deepEqual(await loadProgress(store), p);

  const broken: KeyValueStore = {
    getItem: async () => { throw new Error('disk error'); },
    setItem: async () => {},
  };
  assert.deepEqual(await loadProgress(broken), emptyProgress());
});

const WORDS: Word[] = Array.from({ length: 12 }, (_, i) => ({
  id: `w${i}`, hanzi: `字${i}`, pinyin: `p${i}`, meaningEn: `meaning ${i % 10}`, level: 1 + (i % 2),
}));

test('quiz is deterministic for a seed and every question is well-formed', () => {
  const a = buildQuiz(WORDS, { count: 8, seed: 7 });
  const b = buildQuiz(WORDS, { count: 8, seed: 7 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, buildQuiz(WORDS, { count: 8, seed: 8 }));
  assert.equal(a.length, 8);
  for (const q of a) {
    const word = WORDS.find((w) => w.id === q.wordId)!;
    assert.equal(q.choices[q.answerIndex], word.meaningEn);
    assert.equal(new Set(q.choices).size, q.choices.length, 'no duplicate choices');
    assert.ok(q.choices.length >= 2 && q.choices.length <= 4);
  }
});

test('words that share a meaning are never offered as each other\'s distractor', () => {
  // w0 and w10 both mean "meaning 0"
  for (let seed = 0; seed < 30; seed++) {
    for (const q of buildQuiz(WORDS, { count: 12, seed })) {
      assert.equal(new Set(q.choices).size, q.choices.length);
    }
  }
});

test('quiz handles tiny word lists and asks for no more than exist', () => {
  assert.deepEqual(buildQuiz([], { count: 5, seed: 1 }), []);
  assert.deepEqual(buildQuiz([WORDS[0]], { count: 5, seed: 1 }), []); // nothing to contrast with
  assert.equal(buildQuiz(WORDS.slice(0, 3), { count: 10, seed: 1 }).length, 3);
});

test('scoring counts correct answers, skips and lists the wrong words', () => {
  const qs = buildQuiz(WORDS, { count: 4, seed: 3 });
  const answers = qs.map((q, i) => (i === 0 ? q.answerIndex : i === 1 ? (q.answerIndex + 1) % q.choices.length : null));
  const r = scoreQuiz(qs, answers);
  assert.equal(r.correct, 1);
  assert.equal(r.total, 4);
  assert.equal(r.percent, 25);
  assert.deepEqual(r.wrongWordIds, qs.slice(1).map((q) => q.wordId));
  assert.deepEqual(scoreQuiz([], []), { correct: 0, total: 0, percent: 0, wrongWordIds: [] });
});
