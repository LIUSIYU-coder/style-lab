// 本机存档:只存出生参数、扉页信息和每一步所选选项的编号,刷新或退出后可以继续。
// 存在浏览器的 localStorage 里;读写失败(隐私模式等)时静默忽略。
import type { BirthInput } from './engine/chart.ts';
import { parseBirthInput, parsePicks, parsePlace } from './engine/validate.ts';
import { parseReader, type Reader } from './engine/reader.ts';

const KEY = 'life-code.save.v4';

export interface Save {
  input: BirthInput;
  /** 出生城市名,用作剧情里的家乡;没填为 null */
  place: string | null;
  /** 每一步所选选项的编号(a、b、c…) */
  picks: string[];
  reader: Reader;
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
    const s = JSON.parse(raw) as Record<string, unknown>;
    const input = parseBirthInput(s?.input);
    const place = parsePlace(s?.place);
    const picks = parsePicks(s?.picks);
    const reader = parseReader(s?.reader);
    return input && place !== undefined && picks && reader ? { input, place, picks, reader } : null;
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
