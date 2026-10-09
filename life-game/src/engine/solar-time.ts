// 出生时间校正:中国夏令时(1986–1991)与真太阳时。
// 所有时间都按"墙上钟表时间"处理，不经过 Date 的本地时区，避免浏览器时区造成偏移。

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

// 中国在 1986–1991 年夏季实行夏令时。起止均为当地 02:00
// (开始时 02:00 拨到 03:00,结束时 02:00 拨回 01:00),与 tz 数据库 Asia/Shanghai 一致。
const CHINA_DST: ReadonlyArray<readonly [number, number, number, number, number]> = [
  // [年, 开始月, 开始日, 结束月, 结束日]
  [1986, 5, 4, 9, 14],
  [1987, 4, 12, 9, 13],
  [1988, 4, 17, 9, 11],
  [1989, 4, 16, 9, 17],
  [1990, 4, 15, 9, 16],
  [1991, 4, 14, 9, 15],
];

function minutesOfYear(t: WallTime): number {
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) / 60000;
}

/** 这个钟表时间是否处在中国夏令时内（结束当天 01:00–02:00 的重复时段按夏令时处理）。 */
export function isChinaDst(t: WallTime): boolean {
  const rule = CHINA_DST.find(r => r[0] === t.year);
  if (!rule) return false;
  const [, sm, sd, em, ed] = rule;
  const m = minutesOfYear(t);
  const start = minutesOfYear({ year: t.year, month: sm, day: sd, hour: 2, minute: 0 });
  const end = minutesOfYear({ year: t.year, month: em, day: ed, hour: 2, minute: 0 });
  return m >= start && m < end;
}

/** 时差方程（分钟）:真太阳时 − 平太阳时，误差约 ±1 分钟，对排盘足够。 */
export function equationOfTime(t: WallTime): number {
  const dayOfYear =
    (Date.UTC(t.year, t.month - 1, t.day) - Date.UTC(t.year, 0, 1)) / 86400000 + 1;
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export function addMinutes(t: WallTime, minutes: number): WallTime {
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) + Math.round(minutes) * 60000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export interface Correction {
  /** 用来排盘的时间 */
  time: WallTime;
  /** 夏令时扣掉的分钟数(0 或 60) */
  dstMinutes: number;
  /** 经度修正 + 时差方程，合计分钟；未选城市时为 null */
  solarMinutes: number | null;
}

/**
 * 输入按北京时间(UTC+8)填写的出生时间。
 * 先扣除夏令时；给了出生地经度时，再换算成当地真太阳时。
 */
export function correctBirthTime(t: WallTime, longitude: number | null): Correction {
  const dstMinutes = isChinaDst(t) ? 60 : 0;
  let time = addMinutes(t, -dstMinutes);
  let solarMinutes: number | null = null;
  if (longitude !== null) {
    solarMinutes = (longitude - 120) * 4 + equationOfTime(time);
    time = addMinutes(time, solarMinutes);
  }
  return { time, dstMinutes, solarMinutes };
}
