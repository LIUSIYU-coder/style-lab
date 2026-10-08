// Multiple-choice vocabulary quiz. Deterministic for a given seed so results can be
// tested and a quiz can be reproduced.

import type { Word } from './wordlist.ts';

export type Question = {
  wordId: string;
  prompt: string; // the hanzi
  choices: string[]; // English meanings
  answerIndex: number;
};

// Small seeded PRNG (mulberry32).
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuiz(
  words: Word[],
  opts: { count: number; seed: number; choices?: number },
): Question[] {
  const rand = rng(opts.seed);
  const want = opts.choices ?? 4;
  const picked = shuffle(words, rand).slice(0, opts.count);
  const questions: Question[] = [];

  for (const w of picked) {
    // Distractors: other words with a different meaning, same level first.
    const pool = words.filter((o) => o.id !== w.id && o.meaningEn !== w.meaningEn);
    const sameLevel = shuffle(pool.filter((o) => o.level === w.level), rand);
    const otherLevel = shuffle(pool.filter((o) => o.level !== w.level), rand);

    const seen = new Set([w.meaningEn]);
    const distractors: string[] = [];
    for (const o of [...sameLevel, ...otherLevel]) {
      if (distractors.length >= want - 1) break;
      if (seen.has(o.meaningEn)) continue;
      seen.add(o.meaningEn);
      distractors.push(o.meaningEn);
    }
    if (distractors.length < 1) continue; // not enough material for a real question

    const choices = shuffle([w.meaningEn, ...distractors], rand);
    questions.push({
      wordId: w.id,
      prompt: w.hanzi,
      choices,
      answerIndex: choices.indexOf(w.meaningEn),
    });
  }
  return questions;
}

export type QuizResult = { correct: number; total: number; percent: number; wrongWordIds: string[] };

// answers[i] is the chosen index for question i, or null if skipped.
export function scoreQuiz(questions: Question[], answers: (number | null)[]): QuizResult {
  const wrong: string[] = [];
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.answerIndex) correct += 1;
    else wrong.push(q.wordId);
  });
  const total = questions.length;
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100), wrongWordIds: wrong };
}
