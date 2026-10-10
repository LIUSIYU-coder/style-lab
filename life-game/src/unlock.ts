// 兑换深度解析:设备编号、本机记住的兑换码、请求服务器。
import type { BirthInput } from './engine/chart.ts';
import type { DeepReport } from './engine/deep.ts';
import type { Reader } from './engine/reader.ts';
import { UNLOCK_API } from './config.ts';

const DEVICE_KEY = 'life-code.device';
const CODE_KEY = 'life-code.unlock';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 隐私模式下记不住,下次重新输入即可 */
  }
}

/** 本机的随机编号,用来限制一个兑换码最多在几台设备上使用 */
export function deviceId(): string {
  let id = get(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    set(DEVICE_KEY, id);
  }
  return id;
}

export const savedCode = () => get(CODE_KEY);
export const forgetCode = () => set(CODE_KEY, null);

export type UnlockResult = { ok: true; deep: DeepReport; devicesLeft: number } | { ok: false; error: string; forget?: boolean };

export async function unlock(code: string, input: BirthInput, place: string | null, picks: string[], reader: Reader): Promise<UnlockResult> {
  let res: Response;
  try {
    res = await fetch(UNLOCK_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, device: deviceId(), input, place, picks, reader }),
    });
  } catch {
    return { ok: false, error: '连不上兑换服务器，请检查网络后再试。如果你是在预览页面里，请到购买后收到的正式网址打开。' };
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    return { ok: false, error: '这里是预览页面，没有连接兑换服务器。请在购买后收到的正式网址里打开。' };
  }
  try {
    const data = await res.json();
    if (data.ok) {
      set(CODE_KEY, code);
      return { ok: true, deep: data.deep as DeepReport, devicesLeft: data.devicesLeft };
    }
    // 兑换码本身无效(而不是网络或请求问题)时,忘掉本机记住的码
    return { ok: false, error: String(data.error ?? '兑换失败，请稍后再试。'), forget: res.status === 403 || res.status === 409 };
  } catch {
    return { ok: false, error: '兑换失败，请稍后再试。' };
  }
}
