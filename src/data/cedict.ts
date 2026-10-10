// CC-CEDICT parsing and pinyin helpers. Pure functions; file I/O lives in scripts/.
// CC-CEDICT is CC BY-SA 4.0 (see the header of the downloaded file) - anything derived
// from it must keep attribution and the same licence.

export type CedictEntry = {
  traditional: string;
  simplified: string;
  pinyinNumbered: string; // e.g. "ni3 hao3"
  defs: string[];
};

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

// One syllable in CC-CEDICT notation ("lu:e4", "ma5", "r5") -> tone-marked pinyin.
export function syllableToMarks(raw: string): string {
  const syl = raw.replace(/u:/g, 'ü').replace(/U:/g, 'Ü');
  const m = /^(.*?)([1-5])$/.exec(syl);
  if (!m) return syl;
  const base = m[1];
  const tone = Number(m[2]);
  if (tone === 5) return base;

  const lower = base.toLowerCase();
  let idx = lower.search(/[a]/);
  if (idx < 0) idx = lower.search(/[e]/);
  if (idx < 0 && lower.includes('ou')) idx = lower.indexOf('o');
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return base; // m, ng, r, ...: no vowel to carry the mark

  const table = MARKS[lower[idx]];
  const marked = table[tone - 1];
  return base.slice(0, idx) + (base[idx] === base[idx].toUpperCase() ? marked.toUpperCase() : marked) + base.slice(idx + 1);
}

export function pinyinToMarks(numbered: string): string {
  return numbered.split(/\s+/).filter(Boolean).map(syllableToMarks).join(' ');
}

const LINE = /^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/\s*$/;

export function parseCedictLine(line: string): CedictEntry | null {
  if (!line || line.startsWith('#')) return null;
  const m = LINE.exec(line);
  if (!m) return null;
  return {
    traditional: m[1],
    simplified: m[2],
    pinyinNumbered: m[3],
    defs: m[4].split('/').filter(Boolean),
  };
}

export function buildIndex(lines: Iterable<string>): Map<string, CedictEntry[]> {
  const index = new Map<string, CedictEntry[]>();
  for (const line of lines) {
    const e = parseCedictLine(line);
    if (!e) continue;
    const list = index.get(e.simplified) ?? [];
    list.push(e);
    index.set(e.simplified, list);
  }
  return index;
}

const MINOR = /^(surname\b|(old |erhua |archaic )?variant of|see also|see |used in|also pr\.|Taiwan pr\.|abbr\. for|(Japanese )?kana)/i;

// Entries whose definitions are all surnames / variants / cross-references are only
// useful when nothing else exists.
export function mainEntries(entries: CedictEntry[]): CedictEntry[] {
  const main = entries.filter((e) => !e.defs.every((d) => MINOR.test(d)));
  const pool = main.length ? main : entries;
  // Proper nouns (capitalised pinyin, e.g. "Da4 xue2" = the Confucian classic) lose to
  // ordinary words when both exist.
  const common = pool.filter((e) => !/^[A-Z]/.test(e.pinyinNumbered));
  return common.length ? common : pool;
}

export function meaningOf(entry: CedictEntry, max = 3): string {
  const useful = entry.defs.filter((d) => !/^CL:/.test(d));
  return (useful.length ? useful : entry.defs).slice(0, max).join('; ');
}
