// 关于"真实的你":扉页上填的称呼、谁带大你,书末问的现实困惑,以及你亲手写下的句子。
// 这些信息让剧情换成你身边真实的人,也让深度解析写的是你本人。
import { CARERS, WRITE_KEYS, type Carer, type WriteKey } from './story.ts';

export const CONCERNS = [
  { key: 'work', label: '工作和以后的方向' },
  { key: 'people', label: '和身边人的相处' },
  { key: 'self', label: '自己的状态和情绪' },
  { key: 'family', label: '家里的人和事' },
  { key: 'change', label: '想改变，却一直没开始' },
] as const;
export type ConcernKey = (typeof CONCERNS)[number]['key'];

export interface Reader {
  /** 怎么称呼你,可以为空 */
  name: string;
  carer: Carer;
  /** 家里人怎么叫你(小名),可以为空 */
  nick: string;
  /** 小时候最好的朋友的名字,可以为空(为空时书里随机一个) */
  friend: string;
  concern: ConcernKey | null;
  lines: Partial<Record<WriteKey, string>>;
}

export const DEFAULT_READER: Reader = { name: '', carer: '外婆', nick: '', friend: '', concern: null, lines: {} };
export const MAX_NAME = 8;
export const MAX_NICK = 6;
export const MAX_LINE = 40;

/** 去掉控制字符和首尾空白,截到最大长度 */
export function cleanText(x: unknown, max: number): string {
  return typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '';
}

export function parseReader(x: unknown): Reader | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!CARERS.includes(o.carer as Carer)) return null;
  const concern = o.concern === null || o.concern === undefined ? null : CONCERNS.find(c => c.key === o.concern)?.key;
  if (concern === undefined) return null;
  const lines: Partial<Record<WriteKey, string>> = {};
  const raw = (o.lines && typeof o.lines === 'object' ? o.lines : {}) as Record<string, unknown>;
  for (const k of WRITE_KEYS) {
    const t = cleanText(raw[k], MAX_LINE);
    if (t) lines[k] = t;
  }
  return { name: cleanText(o.name, MAX_NAME), carer: o.carer as Carer, nick: cleanText(o.nick, MAX_NICK), friend: cleanText(o.friend, MAX_NICK), concern, lines };
}

/** 按出生日期算出今天的周岁 */
export function ageOn(birth: { year: number; month: number; day: number }, today = new Date()): number {
  let age = today.getFullYear() - birth.year;
  if (today.getMonth() + 1 < birth.month || (today.getMonth() + 1 === birth.month && today.getDate() < birth.day)) age -= 1;
  return Math.max(0, age);
}

/** 书里用的"你是谁":把扉页信息交给剧情 */
export const whoOf = (r: Reader) => ({ carer: r.carer, friend: r.friend || undefined, nick: r.nick || undefined });
