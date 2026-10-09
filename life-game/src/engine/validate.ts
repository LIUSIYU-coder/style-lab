// 校验从浏览器存档或网络请求里读到的数据。前端读存档和服务器收请求共用。
import type { BirthInput } from './chart.ts';
import { TOTAL_CHOICES } from './story.ts';

export const MIN_YEAR = 1920;
export const MAX_YEAR = 2026;

const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

export function parseBirthInput(x: unknown): BirthInput | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const t = o.time as Record<string, unknown> | undefined;
  if (!t || typeof t !== 'object') return null;
  if (!isInt(t.year, MIN_YEAR, MAX_YEAR) || !isInt(t.month, 1, 12) || !isInt(t.hour, 0, 23) || !isInt(t.minute, 0, 59)) return null;
  const days = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
  if (!isInt(t.day, 1, days)) return null;
  if (o.gender !== 'male' && o.gender !== 'female') return null;
  const lng = o.longitude;
  if (lng !== null && !(typeof lng === 'number' && Number.isFinite(lng) && lng >= 70 && lng <= 140)) return null;
  return { time: { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute }, gender: o.gender, longitude: lng };
}

/** 出生城市名:不填为 null;无效时返回 undefined */
export function parsePlace(x: unknown): string | null | undefined {
  if (x === null) return null;
  return typeof x === 'string' && /^[一-龥]{1,12}$/.test(x) ? x : undefined;
}

/** 选项编号列表;complete 为 true 时要求走完 24 步 */
export function parsePicks(x: unknown, complete = false): string[] | null {
  if (!Array.isArray(x) || x.length > TOTAL_CHOICES) return null;
  if (complete && x.length !== TOTAL_CHOICES) return null;
  return x.every(k => typeof k === 'string' && /^[a-h]$/.test(k)) ? (x as string[]) : null;
}
