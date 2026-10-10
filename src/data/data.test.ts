import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIndex, mainEntries, parseCedictLine, pinyinToMarks, syllableToMarks } from './cedict.ts';
import { buildLevel, lookupForms, parseListLine } from './build.ts';
import { validateWordList } from '../core/wordlist.ts';

test('tone marks go on the right vowel', () => {
  const cases: [string, string][] = [
    ['ni3', 'nǐ'],
    ['hao3', 'hǎo'],
    ['xue2', 'xué'],
    ['lu:e4', 'lüè'],
    ['nu:3', 'nǚ'],
    ['liu2', 'liú'], // last vowel of "iu"
    ['hui4', 'huì'], // last vowel of "ui"
    ['gou3', 'gǒu'], // "ou" -> o
    ['zhong1', 'zhōng'],
    ['yao1', 'yāo'],
    ['ma5', 'ma'], // neutral tone has no mark
    ['r5', 'r'],
    ['Bei3', 'Běi'],
  ];
  for (const [input, expected] of cases) assert.equal(syllableToMarks(input), expected, input);
  assert.equal(pinyinToMarks('ni3 hao3'), 'nǐ hǎo');
});

test('parses CC-CEDICT lines and skips comments', () => {
  assert.equal(parseCedictLine('# comment'), null);
  const e = parseCedictLine('你好 你好 [ni3 hao3] /hello/hi/');
  assert.deepEqual(e, {
    traditional: '你好',
    simplified: '你好',
    pinyinNumbered: 'ni3 hao3',
    defs: ['hello', 'hi'],
  });
});

test('surname and variant-only entries are ignored when a real entry exists', () => {
  const idx = buildIndex([
    '好 好 [Hao3] /surname Hao/',
    '好 好 [hao3] /good/well/proper/',
    '好 好 [hao4] /to be fond of/',
  ]);
  const main = mainEntries(idx.get('好')!);
  assert.equal(main.length, 2);
  assert.deepEqual(main.map((m) => m.pinyinNumbered), ['hao3', 'hao4']);
});

test('list lines: sense digits are stripped and remembered', () => {
  assert.deepEqual(parseListLine('点1'), { hanzi: '点', senseHint: true });
  assert.deepEqual(parseListLine(' 爸爸 '), { hanzi: '爸爸', senseHint: false });
  assert.equal(parseListLine('   '), null);
});

test('buildLevel: clear words pass, ambiguous and missing ones go to review', () => {
  const idx = buildIndex([
    '爸爸 爸爸 [ba4 ba5] /dad/father/',
    '好 好 [hao3] /good/',
    '好 好 [hao4] /to be fond of/',
    '點 点 [dian3] /a dot/point/',
  ]);
  const { words, review } = buildLevel(1, ['爸爸', '好', '点1', '不存在的词'], idx);

  assert.deepEqual(words.map((w) => [w.hanzi, w.pinyin]), [
    ['爸爸', 'bà ba'],
    ['好', 'hǎo'], // first candidate, but flagged
    ['点', 'diǎn'],
  ]);
  assert.deepEqual(
    review.map((r) => [r.hanzi, r.reason]),
    [
      ['好', 'several readings'],
      ['点', 'sense marker in list'],
      ['不存在的词', 'missing in dictionary'],
    ],
  );
  assert.deepEqual(validateWordList(words), []);
});

test('proper-noun readings lose to ordinary words', () => {
  const idx = buildIndex([
    '大學 大学 [Da4 xue2] /the Great Learning/',
    '大學 大学 [da4 xue2] /university; college/',
  ]);
  const { words, review } = buildLevel(1, ['大学'], idx);
  assert.equal(words[0].pinyin, 'dà xué');
  assert.deepEqual(review, []);
});

test('bracketed optional characters are looked up in full, then shortened', () => {
  assert.deepEqual(lookupForms('没（有）'), ['没有', '没']);
  assert.deepEqual(lookupForms('有时（候）'), ['有时候', '有时']);
  assert.deepEqual(lookupForms('爸爸'), ['爸爸']);
  const idx = buildIndex(['沒有 没有 [mei2 you3] /haven\'t/']);
  const { words, review } = buildLevel(1, ['没（有）'], idx);
  assert.equal(words[0].hanzi, '没（有）'); // the syllabus spelling is kept for display
  assert.equal(words[0].pinyin, 'méi yǒu');
  assert.deepEqual(review, []);
});

test('the same word and reading in a later level is not duplicated', () => {
  const idx = buildIndex(['好 好 [hao3] /good/']);
  const seen = new Set<string>();
  const l1 = buildLevel(1, ['好'], idx, { seen });
  const l2 = buildLevel(2, ['好'], idx, { seen });
  assert.equal(l1.words.length, 1);
  assert.equal(l2.words.length, 0);
  assert.equal(l2.review[0].reason, 'same word and reading already in an earlier level (another sense?)');
});

test('overrides win and silence the review flag', () => {
  const idx = buildIndex(['吧 吧 [ba1] /bar/', '吧 吧 [ba5] /particle/']);
  const plain = buildLevel(1, ['吧'], idx);
  assert.equal(plain.review[0].reason, 'several readings');
  const fixed = buildLevel(1, ['吧'], idx, { overrides: { 吧: { pinyin: 'ba', meaningEn: 'sentence-final particle' } } });
  assert.equal(fixed.words[0].pinyin, 'ba');
  assert.equal(fixed.words[0].meaningEn, 'sentence-final particle');
  assert.deepEqual(fixed.review, []);
});
