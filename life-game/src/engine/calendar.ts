// 农历 ↔ 公历换算,供表单的"农历"输入使用。闰月用负数表示(如 -2 为闰二月)。
import { Lunar, LunarYear, Solar } from 'lunar-typescript';

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_TENS = ['初', '十', '廿', '三'];
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export interface LunarMonthOption {
  value: number;
  label: string;
  days: number;
}

export function lunarMonthName(month: number): string {
  return `${month < 0 ? '闰' : ''}${MONTH_NAMES[Math.abs(month) - 1]}月`;
}

export function lunarDayName(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  return DAY_TENS[Math.floor(day / 10)] + DIGITS[day % 10];
}

/** 某个农历年的所有月份(含闰月,按先后顺序)。 */
export function lunarMonths(year: number): LunarMonthOption[] {
  return LunarYear.fromYear(year)
    .getMonthsInYear()
    .filter(m => m.getYear() === year)
    .map(m => ({ value: m.getMonth(), label: lunarMonthName(m.getMonth()), days: m.getDayCount() }));
}

export function lunarToSolar(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const s = Lunar.fromYmd(year, month, day).getSolar();
  return { year: s.getYear(), month: s.getMonth(), day: s.getDay() };
}

export function solarToLunar(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const l = Solar.fromYmd(year, month, day).getLunar();
  return { year: l.getYear(), month: l.getMonth(), day: l.getDay() };
}

/** 如 "1998 · 戊寅年" */
export function lunarYearLabel(year: number): string {
  return `${year} · ${Lunar.fromYmd(year, 1, 1).getYearInGanZhi()}年`;
}
