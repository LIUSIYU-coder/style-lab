// Word-list model. The data itself is NOT bundled here: official HSK lists need a
// licence check before shipping (see README), so the app loads lists through this
// shape and the source can be swapped without touching the scheduler.

export type Word = {
  id: string;
  hanzi: string;
  pinyin: string; // with tone marks, e.g. "nǐ hǎo"
  meaningEn: string;
  level: number; // 1-9 under HSK 3.0
};

export type ValidationIssue = { id: string; problem: string };

const TONE_MARKS = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

export function validateWordList(words: Word[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();

  for (const w of words) {
    if (seenIds.has(w.id)) issues.push({ id: w.id, problem: 'duplicate id' });
    seenIds.add(w.id);

    const pair = `${w.hanzi}|${w.pinyin}`;
    if (seenPairs.has(pair)) issues.push({ id: w.id, problem: 'duplicate hanzi+pinyin' });
    seenPairs.add(pair);

    if (!w.hanzi.trim()) issues.push({ id: w.id, problem: 'empty hanzi' });
    if (!w.meaningEn.trim()) issues.push({ id: w.id, problem: 'empty meaning' });
    if (!Number.isInteger(w.level) || w.level < 1 || w.level > 9) {
      issues.push({ id: w.id, problem: `level out of range: ${w.level}` });
    }
    // Neutral-tone-only syllables (e.g. "de") legitimately have no mark, so only
    // flag pinyin that is empty or contains non-pinyin characters.
    if (!w.pinyin.trim()) issues.push({ id: w.id, problem: 'empty pinyin' });
    else if (/[0-9]/.test(w.pinyin) && !TONE_MARKS.test(w.pinyin)) {
      issues.push({ id: w.id, problem: 'pinyin uses tone numbers, expected tone marks' });
    }
  }
  return issues;
}

export function groupByLevel(words: Word[]): Map<number, Word[]> {
  const out = new Map<number, Word[]>();
  for (const w of words) {
    const list = out.get(w.level) ?? [];
    list.push(w);
    out.set(w.level, list);
  }
  return out;
}
