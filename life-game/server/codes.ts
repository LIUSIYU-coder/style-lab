// 兑换码仓库。只保存兑换码的 SHA-256 摘要,即使数据文件泄露也拿不到原始兑换码。
// 每次读写都直接读文件,这样命令行工具(scripts/codes.ts)和正在运行的服务器可以同时操作。
import { createHash, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** 去掉了容易看错的 0 O 1 I */
export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 12;
export const MAX_DEVICES = 3;

export interface CodeRecord {
  batch: string;
  created: string;
  devices: string[];
  firstUsed: string | null;
  lastUsed: string | null;
  uses: number;
  disabled?: boolean;
}

interface StoreFile {
  version: 1;
  codes: Record<string, CodeRecord>;
}

export type RedeemResult =
  | { ok: true; devicesLeft: number; firstTime: boolean }
  | { ok: false; reason: 'invalid' | 'disabled' | 'devices' };

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function formatCode(norm: string): string {
  return norm.match(/.{1,4}/g)?.join('-') ?? norm;
}

export function hashCode(norm: string): string {
  return createHash('sha256').update('life-code:' + norm).digest('hex');
}

export function generateCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export function isDeviceId(x: unknown): x is string {
  return typeof x === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(x);
}

export class CodeStore {
  readonly file: string;

  constructor(file: string) {
    this.file = file;
  }

  private read(): StoreFile {
    if (!existsSync(this.file)) return { version: 1, codes: {} };
    return JSON.parse(readFileSync(this.file, 'utf8')) as StoreFile;
  }

  private write(data: StoreFile) {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 1));
    renameSync(tmp, this.file);
  }

  /** 生成一批新兑换码,返回明文(只在这一次能看到) */
  create(count: number, batch: string): string[] {
    const data = this.read();
    const now = new Date().toISOString();
    const out: string[] = [];
    while (out.length < count) {
      const code = generateCode();
      const h = hashCode(code);
      if (data.codes[h]) continue;
      data.codes[h] = { batch, created: now, devices: [], firstUsed: null, lastUsed: null, uses: 0 };
      out.push(formatCode(code));
    }
    this.write(data);
    return out;
  }

  redeem(raw: string, device: string): RedeemResult {
    const norm = normalizeCode(raw);
    if (norm.length !== CODE_LENGTH) return { ok: false, reason: 'invalid' };
    const data = this.read();
    const rec = data.codes[hashCode(norm)];
    if (!rec) return { ok: false, reason: 'invalid' };
    if (rec.disabled) return { ok: false, reason: 'disabled' };
    const known = rec.devices.includes(device);
    if (!known && rec.devices.length >= MAX_DEVICES) return { ok: false, reason: 'devices' };
    const now = new Date().toISOString();
    if (!known) rec.devices.push(device);
    rec.firstUsed ??= now;
    rec.lastUsed = now;
    rec.uses += 1;
    this.write(data);
    return { ok: true, devicesLeft: MAX_DEVICES - rec.devices.length, firstTime: !known };
  }

  info(raw: string): CodeRecord | null {
    return this.read().codes[hashCode(normalizeCode(raw))] ?? null;
  }

  /** 清空已绑定的设备(买家换手机时用) */
  reset(raw: string): boolean {
    return this.update(raw, rec => (rec.devices = []));
  }

  /** 作废(退款时用) */
  disable(raw: string): boolean {
    return this.update(raw, rec => (rec.disabled = true));
  }

  stats() {
    const all = Object.values(this.read().codes);
    const batches = new Map<string, { total: number; used: number }>();
    for (const r of all) {
      const b = batches.get(r.batch) ?? { total: 0, used: 0 };
      b.total += 1;
      if (r.firstUsed) b.used += 1;
      batches.set(r.batch, b);
    }
    return { total: all.length, used: all.filter(r => r.firstUsed).length, batches: Object.fromEntries(batches) };
  }

  private update(raw: string, fn: (rec: CodeRecord) => void): boolean {
    const data = this.read();
    const rec = data.codes[hashCode(normalizeCode(raw))];
    if (!rec) return false;
    fn(rec);
    this.write(data);
    return true;
  }
}
