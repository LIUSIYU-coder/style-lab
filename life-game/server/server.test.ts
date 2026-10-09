import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { CodeStore, formatCode, MAX_DEVICES, normalizeCode } from './codes.ts';
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

test('兑换码:生成、规范化、设备上限、重置、作废', () => {
  const store = new CodeStore(join(dir, 'a', 'codes.json'));
  const [code] = store.create(3, 'test');
  assert.match(code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(formatCode(normalizeCode(code.toLowerCase().replaceAll('-', ' '))), code);
  assert.deepEqual(store.redeem('XXXX-XXXX-XXXX', 'device-0001'), { ok: false, reason: 'invalid' });
  for (let i = 0; i < MAX_DEVICES; i++) assert.equal(store.redeem(code.toLowerCase(), `device-000${i}`).ok, true);
  assert.equal(store.redeem(code, 'device-0000').ok, true, '已绑定的设备可以反复解锁');
  assert.deepEqual(store.redeem(code, 'device-9999'), { ok: false, reason: 'devices' });
  assert.equal(store.info(code)?.uses, MAX_DEVICES + 1);
  assert.ok(store.reset(code));
  assert.equal(store.redeem(code, 'device-9999').ok, true);
  assert.ok(store.disable(code));
  assert.deepEqual(store.redeem(code, 'device-9999'), { ok: false, reason: 'disabled' });
  assert.deepEqual(store.stats(), { total: 3, used: 1, batches: { test: { total: 3, used: 1 } } });
});

test('接口:兑换深度解析、静态文件、限流', async () => {
  const dist = join(dir, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>t</title>');
  writeFileSync(join(dist, 'assets', 'a.js'), 'console.log(1)');
  writeFileSync(join(dir, 'secret.txt'), 'nope');
  const store = new CodeStore(join(dir, 'b', 'codes.json'));
  const [code] = store.create(1, 'api');
  const app = createApp({ store, distDir: dist, maxFailures: 3 });
  await new Promise<void>(r => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const post = (body: unknown) => fetch(`${base}/api/unlock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
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
    assert.equal(store.info(code)?.uses, 2, '无效请求不消耗兑换码');

    for (let i = 0; i < 3; i++) assert.equal((await post({ code: 'AAAA-BBBB-CCCC', device: 'device-bbbb', input, place: null, picks })).status, 403);
    const blocked = await post({ code, device: 'device-bbbb', input, place: null, picks });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /15 分钟/);
  } finally {
    app.close();
  }
});
