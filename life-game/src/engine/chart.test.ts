import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SolarTime } from 'tyme4ts';
import { computeChart, ELEMENTS, type BirthInput } from './chart.ts';
import { correctBirthTime, equationOfTime, isChinaDst, type WallTime } from './solar-time.ts';
import { rng } from './rng.ts';

const at = (year: number, month: number, day: number, hour: number, minute: number): WallTime => ({ year, month, day, hour, minute });
const birth = (t: WallTime, gender: BirthInput['gender'] = 'male'): BirthInput => ({ time: t, gender, longitude: null });
const pillarsOf = (t: WallTime) => computeChart(birth(t)).pillars.map(p => p.gan + p.zhi).join(' ');

test('基本排盘', () => {
  assert.equal(pillarsOf(at(1995, 5, 20, 8, 30)), computeExpected(at(1995, 5, 20, 8, 30)));
  const c = computeChart(birth(at(1992, 5, 20, 8, 30)));
  assert.equal(c.pillars[2].ganShiShen, '日主');
  assert.equal(ELEMENTS.reduce((s, e) => s + c.elements[e], 0), 100);
  assert.ok(c.daYun.length >= 8);
});

test('晚子时算次日:日柱与时柱自洽', () => {
  assert.equal(pillarsOf(at(2000, 1, 1, 23, 30)), '己卯 丙子 己未 甲子');
  assert.equal(pillarsOf(at(2000, 1, 2, 0, 10)), '己卯 丙子 己未 甲子');
});

test('年柱、月柱以立春分界(2027 立春 02-04 09:46)', () => {
  assert.match(pillarsOf(at(2027, 2, 4, 9, 40)), /^丙午 辛丑/);
  assert.match(pillarsOf(at(2027, 2, 4, 9, 50)), /^丁未 壬寅/);
});

test('与 tyme4ts 独立计算的四柱一致(3000 个随机时间)', () => {
  const r = rng(20261009);
  for (let i = 0; i < 3000; i++) {
    const t = at(
      1930 + Math.floor(r() * 100),
      1 + Math.floor(r() * 12),
      1 + Math.floor(r() * 28),
      Math.floor(r() * 24),
      Math.floor(r() * 60),
    );
    if (isChinaDst(t)) continue; // 夏令时会先校正,单独测试
    assert.equal(pillarsOf(t), computeExpected(t), JSON.stringify(t));
  }
});

test('夏令时:钟表时间先减一小时再排盘', () => {
  const c = computeChart(birth(at(1990, 6, 20, 1, 30)));
  assert.equal(c.correction.dstMinutes, 60);
  assert.deepEqual(c.correction.time, at(1990, 6, 20, 0, 30));
  assert.equal(c.pillars.map(p => p.gan + p.zhi).join(' '), computeExpected(at(1990, 6, 20, 0, 30)));
});

test('夏令时区间与 tz 数据库(Asia/Shanghai)一致', () => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  });
  for (let ms = Date.UTC(1985, 0, 1); ms < Date.UTC(1993, 0, 1); ms += 30 * 60000) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    const wall = at(+parts.year, +parts.month, +parts.day, +parts.hour, +parts.minute);
    const offsetHours = (Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) - ms) / 3600000;
    // 夏令时结束当天 01:00–02:00 会出现两次,我们统一按夏令时处理,跳过第二次
    if (offsetHours === 8 && isChinaDst(wall)) continue;
    assert.equal(isChinaDst(wall), offsetHours === 9, JSON.stringify(wall));
  }
});

test('真太阳时:经度与时差方程', () => {
  // 2 月中旬时差方程约 −14 分钟,11 月初约 +16 分钟
  assert.ok(Math.abs(equationOfTime(at(2001, 2, 11, 12, 0)) + 14.2) < 1);
  assert.ok(Math.abs(equationOfTime(at(2001, 11, 3, 12, 0)) - 16.4) < 1);
  // 乌鲁木齐(87.6°E)比北京时间晚两个多小时
  const c = correctBirthTime(at(2001, 6, 1, 12, 0), 87.6);
  assert.ok(c.solarMinutes !== null && c.solarMinutes < -125 && c.solarMinutes > -135);
  assert.equal(c.time.hour, 9);
});

function computeExpected(t: WallTime): string {
  const ec = SolarTime.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, 0).getLunarHour().getEightChar();
  return [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getHour()].map(x => x.getName()).join(' ');
}
