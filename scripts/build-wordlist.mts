// Usage:
//   node scripts/build-wordlist.ts --cedict <cedict.txt|.gz> --level 1=<L1.txt> --level 2=<L2.txt> [--overrides fixes.json] --out data/private/words.json
//
// Inputs are downloaded by you (see README); nothing here fetches data. Output goes to a
// git-ignored folder because the sources' licences are not cleared for redistribution.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { buildIndex } from '../src/data/cedict.ts';
import { buildLevel } from '../src/data/build.ts';
import type { Overrides } from '../src/data/build.ts';
import { validateWordList } from '../src/core/wordlist.ts';
import type { ReviewItem } from '../src/data/build.ts';
import type { Word } from '../src/core/wordlist.ts';

function readText(path: string): string {
  const buf = readFileSync(path);
  return (path.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
}

const args = process.argv.slice(2);
let cedictPath = '';
let out = 'data/private/words.json';
let overrides: Overrides = {};
const levelFiles: [number, string][] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cedict') cedictPath = args[++i];
  else if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--overrides') overrides = JSON.parse(readText(args[++i]));
  else if (args[i] === '--level') {
    const [lv, path] = args[++i].split('=');
    levelFiles.push([Number(lv), path]);
  }
}
if (!cedictPath || levelFiles.length === 0) {
  console.error('missing --cedict or --level; see usage at the top of this file');
  process.exit(1);
}

const index = buildIndex(readText(cedictPath).split('\n'));
const words: Word[] = [];
const review: ReviewItem[] = [];
const seen = new Set<string>();

for (const [level, path] of levelFiles) {
  const result = buildLevel(level, readText(path).split('\n'), index, {
    startIndex: 0,
    seen,
    overrides,
  });
  words.push(...result.words);
  review.push(...result.review);
  const reasons = result.review.reduce<Record<string, number>>((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`level ${level}: ${result.words.length} words, review: ${JSON.stringify(reasons)}`);
}

const issues = validateWordList(words);
if (issues.length) console.warn(`validation issues: ${issues.length}`, issues.slice(0, 10));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(words, null, 2));
writeFileSync(out.replace(/\.json$/, '.review.json'), JSON.stringify(review, null, 2));
console.log(`wrote ${words.length} words -> ${out}  (review list: ${review.length} items)`);
