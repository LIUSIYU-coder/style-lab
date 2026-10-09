// 本机存档:只存出生参数和每一步所选选项的编号,刷新或退出后可以继续。
// 存在浏览器的 localStorage 里,不上传;读写失败(隐私模式等)时静默忽略。
import type { BirthInput } from './engine/chart.ts';

const KEY = 'life-code.save.v3';

export interface Save {
  input: BirthInput;
  /** 出生城市名,用作剧情里的家乡;没填为 null */
  place: string | null;
  /** 每一步所选选项的编号(a、b、c…) */
  picks: string[];
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* 无法存档时游戏照常进行 */
  }
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    const t = s?.input?.time;
    const ok =
      t && [t.year, t.month, t.day, t.hour, t.minute].every(Number.isInteger) &&
      (s.input.gender === 'male' || s.input.gender === 'female') &&
      (s.input.longitude === null || typeof s.input.longitude === 'number') &&
      (s.place === null || typeof s.place === 'string') &&
      Array.isArray(s.picks) && s.picks.length <= 24 && s.picks.every(k => typeof k === 'string' && /^[a-h]$/.test(k));
    return ok ? s : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 忽略 */
  }
}
