import { mainEntries, meaningOf, pinyinToMarks } from './cedict.ts';
import type { CedictEntry } from './cedict.ts';
import type { Word } from '../core/wordlist.ts';

export type ReviewItem = {
  hanzi: string;
  level: number;
  reason:
    | 'missing in dictionary'
    | 'several readings'
    | 'sense marker in list'
    | 'same word and reading already in an earlier level (another sense?)';
  candidates: { pinyin: string; meaningEn: string }[];
};

export type BuildResult = { words: Word[]; review: ReviewItem[] };

// Hand-made corrections, keyed by headword ("吧") or headword@level ("好@2").
export type Overrides = Record<string, { pinyin: string; meaningEn?: string }>;

// Official lists mark optional characters with brackets: 没（有） means 没 or 没有.
// Returns dictionary look-up forms, fullest first.
export function lookupForms(headword: string): string[] {
  if (!/[（(]/.test(headword)) return [headword];
  const full = headword.replace(/[（()）]/g, '');
  const short = headword.replace(/[（(][^）)]*[）)]/g, '');
  return [...new Set([full, short])].filter(Boolean);
}

// A list line is the headword, optionally followed by a digit that tells apart
// several senses of the same headword (e.g. "点1"). The digit is not part of the word.
export function parseListLine(line: string): { hanzi: string; senseHint: boolean } | null {
  const t = line.trim();
  if (!t) return null;
  const hanzi = t.replace(/\d+$/, '');
  if (!hanzi) return null;
  return { hanzi, senseHint: hanzi !== t };
}

// Words are taken from the dictionary only when there is a single clear candidate.
// Everything else is still emitted (first candidate) but also listed for human review.
export function buildLevel(
  level: number,
  lines: string[],
  index: Map<string, CedictEntry[]>,
  opts: { startIndex?: number; seen?: Set<string>; overrides?: Overrides } = {},
): BuildResult {
  const seen = opts.seen ?? new Set<string>();
  const overrides = opts.overrides ?? {};
  const words: Word[] = [];
  const review: ReviewItem[] = [];
  let n = opts.startIndex ?? 0;

  for (const line of lines) {
    const item = parseListLine(line);
    if (!item) continue;
    n += 1;
    const id = `h3-l${level}-${String(n).padStart(4, '0')}`;
    const found = lookupForms(item.hanzi)
      .map((form) => index.get(form))
      .find((entries) => entries && entries.length > 0);

    if (!found) {
      review.push({ hanzi: item.hanzi, level, reason: 'missing in dictionary', candidates: [] });
      continue;
    }
    const candidates = mainEntries(found);
    const chosen = candidates[0];
    const fix = overrides[`${item.hanzi}@${level}`] ?? overrides[item.hanzi];
    const pinyin = fix ? fix.pinyin : pinyinToMarks(chosen.pinyinNumbered);
    const meaningEn = fix?.meaningEn ?? meaningOf(chosen);

    const key = `${item.hanzi}|${pinyin}`;
    if (seen.has(key)) {
      review.push({
        hanzi: item.hanzi,
        level,
        reason: 'same word and reading already in an earlier level (another sense?)',
        candidates: candidates.map((c) => ({ pinyin: pinyinToMarks(c.pinyinNumbered), meaningEn: meaningOf(c) })),
      });
      continue;
    }
    seen.add(key);
    words.push({ id, hanzi: item.hanzi, pinyin, meaningEn, level });

    const reason = fix
      ? null // a human already decided
      : candidates.length > 1
        ? 'several readings'
        : item.senseHint
          ? 'sense marker in list'
          : null;
    if (reason) {
      review.push({
        hanzi: item.hanzi,
        level,
        reason,
        candidates: candidates.map((c) => ({
          pinyin: pinyinToMarks(c.pinyinNumbered),
          meaningEn: meaningOf(c),
        })),
      });
    }
  }
  return { words, review };
}
