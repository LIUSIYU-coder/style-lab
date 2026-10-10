import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lunarDayName, lunarMonths, lunarToSolar, solarToLunar } from './calendar.ts';
import { PROVINCES } from './regions.ts';
import { rng } from './rng.ts';

test('农历月份含闰月,顺序正确', () => {
  assert.deepEqual(lunarMonths(2023).map(m => m.label).slice(0, 4), ['正月', '二月', '闰二月', '三月']);
  assert.equal(lunarMonths(2024).length, 12);
});

test('农历转公历:已知日期', () => {
  assert.deepEqual(lunarToSolar(2023, -2, 1), { year: 2023, month: 3, day: 22 });
  assert.deepEqual(lunarToSolar(2023, 2, 1), { year: 2023, month: 2, day: 20 });
  assert.deepEqual(lunarToSolar(2000, 1, 1), { year: 2000, month: 2, day: 5 });
});

test('公历 → 农历 → 公历 往返一致', () => {
  const r = rng(11);
  for (let i = 0; i < 2000; i++) {
    const s = { year: 1921 + Math.floor(r() * 105), month: 1 + Math.floor(r() * 12), day: 1 + Math.floor(r() * 28) };
    const l = solarToLunar(s.year, s.month, s.day);
    assert.deepEqual(lunarToSolar(l.year, l.month, l.day), s);
  }
});

test('农历日名', () => {
  assert.deepEqual([1, 10, 11, 20, 21, 29, 30].map(lunarDayName), ['初一', '初十', '十一', '二十', '廿一', '廿九', '三十']);
});

test('省市经度数据完整且在中国经度范围内', () => {
  assert.equal(PROVINCES.length, 31);
  for (const p of PROVINCES) {
    assert.ok(p.cities.length > 0, p.name);
    for (const [name, lng] of p.cities) assert.ok(lng > 73 && lng < 136, `${p.name}${name} ${lng}`);
  }
});
