// 启动:node server/main.ts
// 环境变量:PORT(默认 8080)、HOST(默认 127.0.0.1)、TRUST_PROXY=1(自己的 Caddy 后面)或 first(Render 等托管平台)
//   DATA_FILE(默认 data/codes.json),或 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN(免费托管平台用)
//   ADMIN_TOKEN(设置后开启 /admin 管理页)、SITE(卡密里写的域名)
import { join } from 'node:path';
import { createApp } from './app.ts';
import { backendFromEnv, CodeStore } from './codes.ts';

const root = join(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';
const store = new CodeStore(backendFromEnv(join(root, 'data', 'codes.json')));
const adminToken = process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length >= 12 ? process.env.ADMIN_TOKEN : undefined;
if (process.env.ADMIN_TOKEN && !adminToken) console.warn('ADMIN_TOKEN 太短(至少 12 位),管理页没有开启');
const app = createApp({ store, distDir: join(root, 'dist'), trustProxy: process.env.TRUST_PROXY === 'first' ? 'first' : process.env.TRUST_PROXY === '1', adminToken, site: process.env.SITE });

app.listen(port, host, () => {
  console.log(`人生底层代码 已启动:http://${host}:${port}`);
});
