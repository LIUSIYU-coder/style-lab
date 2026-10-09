// 网页服务器:托管打包好的网页(dist/),并提供兑换深度解析的接口。
// 不依赖任何第三方包,Node 22.18 以上可以直接运行 TypeScript。
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { computeChart } from '../src/engine/chart.ts';
import { buildLifeCode } from '../src/engine/profile.ts';
import { replayStory, storyContext } from '../src/engine/story.ts';
import { buildReport, choiceOf } from '../src/engine/report.ts';
import { buildDeepReport } from '../src/engine/deep.ts';
import { parseBirthInput, parsePicks, parsePlace } from '../src/engine/validate.ts';
import { CodeStore, isDeviceId, MAX_DEVICES } from './codes.ts';

export interface AppOptions {
  store: CodeStore;
  distDir: string;
  /** 部署在 Caddy/Nginx 后面时为 true,从 X-Forwarded-For 取真实 IP */
  trustProxy?: boolean;
  /** 每个 IP 在一个时间窗口内允许输错兑换码的次数 */
  maxFailures?: number;
  failureWindowMs?: number;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const ERRORS = {
  invalid: '兑换码不对，请检查一下有没有输错（不区分大小写，横线可以不输）。',
  disabled: '这个兑换码已经停用了。如有疑问，请联系卖家。',
  devices: `这个兑换码已经在 ${MAX_DEVICES} 台设备上用过了。换了手机的话，请联系卖家帮你重置。`,
  limited: '输错次数太多了，请过 15 分钟再试。',
  bad: '请求有误，请刷新页面后重试。',
  incomplete: '要先过完这一天的 24 个小时，才能生成深度解析。',
} as const;

function send(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(text);
}

async function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createApp(opts: AppOptions): Server {
  const { store, distDir } = opts;
  const maxFailures = opts.maxFailures ?? 8;
  const windowMs = opts.failureWindowMs ?? 15 * 60_000;
  const failures = new Map<string, { count: number; until: number }>();

  const clientIp = (req: IncomingMessage) => {
    if (opts.trustProxy) {
      const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
      if (fwd.length) return fwd[fwd.length - 1];
    }
    return req.socket.remoteAddress ?? 'unknown';
  };

  const limited = (ip: string) => {
    const f = failures.get(ip);
    if (!f) return false;
    if (Date.now() > f.until) {
      failures.delete(ip);
      return false;
    }
    return f.count >= maxFailures;
  };

  const fail = (ip: string) => {
    const now = Date.now();
    const f = failures.get(ip);
    if (!f || now > f.until) failures.set(ip, { count: 1, until: now + windowMs });
    else f.count += 1;
    if (failures.size > 10_000) for (const [k, v] of failures) if (now > v.until) failures.delete(k);
  };

  async function unlock(req: IncomingMessage, res: ServerResponse) {
    const ip = clientIp(req);
    if (limited(ip)) return send(res, 429, { ok: false, error: ERRORS.limited });
    const raw = await readBody(req, 8 * 1024);
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      /* 当作无效请求 */
    }
    if (!parsed || typeof parsed !== 'object') return send(res, 400, { ok: false, error: ERRORS.bad });
    const body = parsed as Record<string, unknown>;
    const input = parseBirthInput(body.input);
    const place = parsePlace(body.place);
    const picks = parsePicks(body.picks, true);
    if (typeof body.code !== 'string' || !isDeviceId(body.device) || !input || place === undefined) {
      return send(res, 400, { ok: false, error: ERRORS.bad });
    }
    if (!picks) return send(res, 400, { ok: false, error: ERRORS.incomplete });

    // 先确认这局游戏能复现,再消耗兑换码的设备名额
    let deep;
    try {
      const chart = computeChart(input);
      const code = buildLifeCode(chart);
      const ctx = storyContext(code.seed, place);
      const { steps } = replayStory(ctx, picks);
      if (steps.length !== picks.length) return send(res, 400, { ok: false, error: ERRORS.incomplete });
      const report = buildReport(chart, code, steps.map(s => choiceOf(s.resolved, s.option)));
      deep = buildDeepReport({ chart, code, ctx, picks, report });
    } catch {
      return send(res, 400, { ok: false, error: ERRORS.bad });
    }

    const result = store.redeem(body.code, body.device);
    if (!result.ok) {
      if (result.reason === 'invalid') fail(ip);
      return send(res, result.reason === 'invalid' ? 403 : 409, { ok: false, reason: result.reason, error: ERRORS[result.reason] });
    }
    send(res, 200, { ok: true, devicesLeft: result.devicesLeft, deep });
  }

  async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string) {
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(distDir, rel));
    if (!file.startsWith(normalize(distDir) + sep)) {
      res.writeHead(400).end();
      return;
    }
    try {
      const st = await stat(file);
      if (!st.isFile()) throw new Error('not file');
      const data = await readFile(file);
      const ext = extname(file).toLowerCase();
      res.writeHead(200, {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('页面不存在');
    }
  }

  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const done = (p: Promise<void>) => p.catch(() => {
      if (!res.headersSent) send(res, 500, { ok: false, error: '服务器开小差了，请稍后再试。' });
      else res.end();
    });
    if (url.pathname === '/api/unlock') {
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: ERRORS.bad });
      return done(unlock(req, res));
    }
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: ERRORS.bad });
    return done(serveStatic(req, res, url.pathname));
  });
}
