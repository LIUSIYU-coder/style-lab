// 本机存档:只存出生参数和每一步选了第几个选项,刷新或退出后可以继续。
// 存在浏览器的 localStorage 里,不上传;读写失败(隐私模式等)时静默忽略。
import type { BirthInput } from './engine/chart.ts';

const KEY = 'life-code.save.v1';

export interface Save {
  input: BirthInput;
  picks: number[];
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
      Array.isArray(s.picks) && s.picks.every(Number.isInteger);
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
