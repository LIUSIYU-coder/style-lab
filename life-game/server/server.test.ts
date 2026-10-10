import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { CodeStore, FileBackend, formatCode, MAX_DEVICES, normalizeCode, UpstashBackend, type Backend } from './codes.ts';
import { createApp } from './app.ts';
import { computeChart } from '../src/engine/chart.ts';
import { buildLifeCode } from '../src/engine/profile.ts';
import { resolveBeat, storyContext, TOTAL_CHOICES } from '../src/engine/story.ts';

const dir = mkdtempSync(join(tmpdir(), 'life-code-'));
const input = { time: { year: 1996, month: 3, day: 8, hour: 14, minute: 20 }, gender: 'female' as const, longitude: 104.06 };

function fullPicks(place: string | null) {
  const code = buildLifeCode(computeChart(input));
  const ctx = storyContext(code.seed, place);
  const flags = new Set<string>();
  const picks: string[] = [];
  for (let i = 0; i < TOTAL_CHOICES; i++) {
    const opt = resolveBeat(i, ctx, flags).options[i % 3];
    opt.set.forEach(f => flags.add(f));
    picks.push(opt.key);
  }
  return picks;
}

/** 只实现用到的几个命令的 Upstash 假服务 */
function fakeUpstash(): typeof fetch {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const run = (cmd: string[]): unknown => {
    const [op, key, ...rest] = cmd;
    if (op === 'GET') return kv.get(key) ?? null;
    if (op === 'SET') { kv.set(key, rest[0]); return 'OK'; }
    if (op === 'SADD') { const set = sets.get(key) ?? new Set(); rest.forEach(m => set.add(m)); sets.set(key, set); return rest.length; }
    if (op === 'SMEMBERS') return [...(sets.get(key) ?? [])];
    if (op === 'MGET') return [key, ...rest].map(k => kv.get(k) ?? null);
    throw new Error(op);
  };
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer t0ken');
    const cmds = JSON.parse(String(init?.body)) as string[][];
    return new Response(JSON.stringify(cmds.map(c => ({ result: run(c) }))), { status: 200 });
  }) as typeof fetch;
}

async function storeScenario(backend: Backend) {
  const store = new CodeStore(backend);
  const [code] = await store.create(3, 'test');
  assert.match(code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(formatCode(normalizeCode(code.toLowerCase().replaceAll('-', ' '))), code);
  assert.deepEqual(await store.redeem('XXXX-XXXX-XXXX', 'device-0001'), { ok: false, reason: 'invalid' });
  for (let i = 0; i < MAX_DEVICES; i++) assert.equal((await store.redeem(code.toLowerCase(), `device-000${i}`)).ok, true);
  assert.equal((await store.redeem(code, 'device-0000')).ok, true, '已绑定的设备可以反复解锁');
  assert.deepEqual(await store.redeem(code, 'device-9999'), { ok: false, reason: 'devices' });
  assert.equal((await store.info(code))?.uses, MAX_DEVICES + 1);
  assert.ok(await store.reset(code));
  assert.equal((await store.redeem(code, 'device-9999')).ok, true);
  assert.ok(await store.disable(code));
  assert.deepEqual(await store.redeem(code, 'device-9999'), { ok: false, reason: 'disabled' });
  assert.deepEqual(await store.stats(), { total: 3, used: 1, batches: { test: { total: 3, used: 1 } } });
}

test('兑换码(本机文件):生成、规范化、设备上限、重置、作废', () => storeScenario(new FileBackend(join(dir, 'a', 'codes.json'))));
test('兑换码(Upstash):同样的流程', () => storeScenario(new UpstashBackend('https://example.upstash.io/', 't0ken', fakeUpstash())));

test('Upstash 出问题时给出能看懂的原因', async () => {
  const bad = (status: number) => (async () => new Response('{}', { status })) as typeof fetch;
  await assert.rejects(new UpstashBackend('https://x.upstash.io', 'bad', bad(401)).get('h'), /令牌/);
  await assert.rejects(new UpstashBackend('https://x.upstash.io', 'bad', bad(500)).get('h'), /500/);
  const down = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  await assert.rejects(new UpstashBackend('more-lynx.upstash.io', 'x', down).get('h'), /网址/);
});

test('接口:兑换深度解析、静态文件、限流', async () => {
  const dist = join(dir, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>t</title>');
  writeFileSync(join(dist, 'assets', 'a.js'), 'console.log(1)');
  writeFileSync(join(dir, 'secret.txt'), 'nope');
  const store = new CodeStore(new FileBackend(join(dir, 'b', 'codes.json')));
  const [code] = await store.create(1, 'api');
  const app = createApp({ store, distDir: dist, maxFailures: 3, adminToken: 'admin-secret-123', site: 'life.example.com' });
  await new Promise<void>(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const post = (body: unknown) => fetch(`${base}/api/unlock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    const big = 'x'.repeat(5000);
    writeFileSync(join(dist, 'assets', 'big.js'), big);
    const gz = await fetch(base + '/assets/big.js', { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(gz.headers.get('content-encoding'), 'gzip');
    assert.equal(await gz.text(), big, '压缩后解开要和原文一致');
    const br = await fetch(base + '/assets/big.js', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(br.headers.get('content-encoding'), 'br');
    assert.equal(await br.text(), big);
    const plain = await fetch(base + '/assets/big.js', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(plain.headers.get('content-encoding'), null);
    assert.match(home.headers.get('content-type') ?? '', /text\/html/);
    assert.match((await fetch(base + '/assets/a.js')).headers.get('cache-control') ?? '', /immutable/);
    assert.equal((await fetch(base + '/..%2Fsecret.txt')).status, 400);
    assert.equal((await fetch(base + '/nope.html')).status, 404);

    const picks = fullPicks('成都');
    const ok = await post({ code, device: 'device-aaaa', input, place: '成都', picks });
    assert.equal(ok.status, 200);
    const data = await ok.json();
    assert.equal(data.ok, true);
    assert.equal(data.devicesLeft, MAX_DEVICES - 1);
    assert.equal(data.deep.novel.length, 5);
    assert.ok(data.deep.novel[0].paragraphs[1].startsWith('成都的一个清晨'));

    assert.equal((await post({ code, device: 'device-aaaa', input, place: '成都', picks: picks.slice(0, 10) })).status, 400);
    assert.equal((await post({ code, device: 'x', input, place: null, picks })).status, 400);
    assert.equal((await post({ code, device: 'device-aaaa', input: { ...input, gender: 'x' }, place: null, picks })).status, 400);
    assert.equal((await post({ code, device: 'device-aaaa', input, place: '成都', picks, reader: { carer: '邻居' } })).status, 400);
    const withReader = await post({ code, device: 'device-aaaa', input, place: '成都', picks: fullPicks('成都'), reader: { name: '阿禾', carer: '外婆', concern: 'work', lines: { dawn: '慢慢来' } } });
    const rd = await withReader.json();
    assert.equal(rd.ok, true);
    assert.ok(rd.deep.title.startsWith('阿禾'));
    assert.equal(rd.deep.now.concern.title, '工作和以后的方向');
    assert.equal((await store.info(code))?.uses, 2, '无效请求不消耗兑换码');

    // 管理页
    assert.equal((await fetch(base + '/admin')).status, 200);
    const adm = (body: unknown) => fetch(`${base}/api/admin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const made = await (await adm({ token: 'admin-secret-123', action: 'create', count: 2, batch: 'web' })).json();
    assert.equal(made.lines.length, 2);
    assert.match(made.lines[0], /^网址 https:\/\/life\.example\.com  兑换码 [2-9A-Z]{4}-/);
    const newCode = made.lines[0].split('兑换码 ')[1];
    assert.equal((await (await adm({ token: 'admin-secret-123', action: 'check', code: newCode })).json()).record.batch, 'web');
    assert.equal((await (await adm({ token: 'admin-secret-123', action: 'stats' })).json()).stats.total, 3);
    assert.equal((await adm({ token: 'wrong', action: 'stats' })).status, 403);

    for (let i = 0; i < 2; i++) assert.equal((await post({ code: 'AAAA-BBBB-CCCC', device: 'device-bbbb', input, place: null, picks })).status, 403);
    const blocked = await post({ code, device: 'device-bbbb', input, place: null, picks });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /15 分钟/);
  } finally {
    app.close();
  }
});
