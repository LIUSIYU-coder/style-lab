// 兑换码仓库。只保存兑换码的 SHA-256 摘要,即使数据泄露也拿不到原始兑换码。
// 数据可以放在本机 JSON 文件里(自己的服务器),也可以放在 Upstash Redis 里(免费托管平台的磁盘会被清空)。
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

/* ---------------- 存储后端 ---------------- */

export interface Backend {
  get(hash: string): Promise<CodeRecord | null>;
  put(entries: Array<[string, CodeRecord]>): Promise<void>;
  all(): Promise<CodeRecord[]>;
}

/** 本机 JSON 文件。每次读写都直接读文件,命令行工具和运行中的服务器可以同时操作。 */
export class FileBackend implements Backend {
  readonly file: string;

  constructor(file: string) {
    this.file = file;
  }

  private read(): Record<string, CodeRecord> {
    if (!existsSync(this.file)) return {};
    return (JSON.parse(readFileSync(this.file, 'utf8')) as { codes: Record<string, CodeRecord> }).codes;
  }

  private write(codes: Record<string, CodeRecord>) {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ version: 1, codes }, null, 1));
    renameSync(tmp, this.file);
  }

  async get(hash: string) {
    return this.read()[hash] ?? null;
  }

  async put(entries: Array<[string, CodeRecord]>) {
    const codes = this.read();
    for (const [h, r] of entries) codes[h] = r;
    this.write(codes);
  }

  async all() {
    return Object.values(this.read());
  }
}

type Fetch = typeof fetch;

/** Upstash Redis(通过 REST 接口,不需要额外依赖)。每个兑换码一个键,另有一个集合记录全部键。 */
export class UpstashBackend implements Backend {
  private readonly url: string;
  private readonly token: string;
  private readonly fetcher: Fetch;
  private readonly prefix: string;

  constructor(url: string, token: string, fetcher: Fetch = fetch, prefix = 'lifecode') {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.fetcher = fetcher;
    this.prefix = prefix;
  }

  private async pipeline(commands: Array<Array<string>>): Promise<unknown[]> {
    const res = await this.fetcher(`${this.url}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Upstash 请求失败:${res.status}`);
    const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    return data.map(d => {
      if (d.error) throw new Error(`Upstash 出错:${d.error}`);
      return d.result;
    });
  }

  private key(hash: string) {
    return `${this.prefix}:code:${hash}`;
  }

  async get(hash: string) {
    const [v] = await this.pipeline([['GET', this.key(hash)]]);
    return typeof v === 'string' ? (JSON.parse(v) as CodeRecord) : null;
  }

  async put(entries: Array<[string, CodeRecord]>) {
    if (!entries.length) return;
    const cmds: string[][] = entries.map(([h, r]) => ['SET', this.key(h), JSON.stringify(r)]);
    cmds.push(['SADD', `${this.prefix}:index`, ...entries.map(([h]) => h)]);
    await this.pipeline(cmds);
  }

  async all() {
    const [members] = await this.pipeline([['SMEMBERS', `${this.prefix}:index`]]);
    const hashes = (members as string[] | null) ?? [];
    const out: CodeRecord[] = [];
    for (let i = 0; i < hashes.length; i += 500) {
      const [vals] = await this.pipeline([['MGET', ...hashes.slice(i, i + 500).map(h => this.key(h))]]);
      for (const v of vals as Array<string | null>) if (v) out.push(JSON.parse(v) as CodeRecord);
    }
    return out;
  }
}

/** 按环境变量选择存储:配置了 Upstash 就用 Upstash,否则用本机文件 */
export function backendFromEnv(defaultFile: string): Backend {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashBackend(url, token);
  return new FileBackend(process.env.DATA_FILE ?? defaultFile);
}

/* ---------------- 兑换码逻辑 ---------------- */

export class CodeStore {
  readonly backend: Backend;

  constructor(backend: Backend) {
    this.backend = backend;
  }

  /** 生成一批新兑换码,返回明文(只在这一次能看到) */
  async create(count: number, batch: string): Promise<string[]> {
    const now = new Date().toISOString();
    const out: string[] = [];
    const entries: Array<[string, CodeRecord]> = [];
    const seen = new Set<string>();
    while (out.length < count) {
      const code = generateCode();
      const h = hashCode(code);
      if (seen.has(h) || (await this.backend.get(h))) continue;
      seen.add(h);
      entries.push([h, { batch, created: now, devices: [], firstUsed: null, lastUsed: null, uses: 0 }]);
      out.push(formatCode(code));
    }
    await this.backend.put(entries);
    return out;
  }

  async redeem(raw: string, device: string): Promise<RedeemResult> {
    const norm = normalizeCode(raw);
    if (norm.length !== CODE_LENGTH) return { ok: false, reason: 'invalid' };
    const h = hashCode(norm);
    const rec = await this.backend.get(h);
    if (!rec) return { ok: false, reason: 'invalid' };
    if (rec.disabled) return { ok: false, reason: 'disabled' };
    const known = rec.devices.includes(device);
    if (!known && rec.devices.length >= MAX_DEVICES) return { ok: false, reason: 'devices' };
    const now = new Date().toISOString();
    if (!known) rec.devices.push(device);
    rec.firstUsed ??= now;
    rec.lastUsed = now;
    rec.uses += 1;
    await this.backend.put([[h, rec]]);
    return { ok: true, devicesLeft: MAX_DEVICES - rec.devices.length, firstTime: !known };
  }

  async info(raw: string): Promise<CodeRecord | null> {
    return this.backend.get(hashCode(normalizeCode(raw)));
  }

  /** 清空已绑定的设备(买家换手机时用) */
  async reset(raw: string): Promise<boolean> {
    return this.update(raw, rec => (rec.devices = []));
  }

  /** 作废(退款时用) */
  async disable(raw: string): Promise<boolean> {
    return this.update(raw, rec => (rec.disabled = true));
  }

  async stats() {
    const all = await this.backend.all();
    const batches = new Map<string, { total: number; used: number }>();
    for (const r of all) {
      const b = batches.get(r.batch) ?? { total: 0, used: 0 };
      b.total += 1;
      if (r.firstUsed) b.used += 1;
      batches.set(r.batch, b);
    }
    return { total: all.length, used: all.filter(r => r.firstUsed).length, batches: Object.fromEntries(batches) };
  }

  private async update(raw: string, fn: (rec: CodeRecord) => void): Promise<boolean> {
    const h = hashCode(normalizeCode(raw));
    const rec = await this.backend.get(h);
    if (!rec) return false;
    fn(rec);
    await this.backend.put([[h, rec]]);
    return true;
  }
}
