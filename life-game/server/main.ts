// 启动:node server/main.ts
// 环境变量:PORT(默认 8080)、HOST(默认 127.0.0.1)、DATA_FILE(默认 data/codes.json)、TRUST_PROXY=1
import { join } from 'node:path';
import { createApp } from './app.ts';
import { CodeStore } from './codes.ts';

const root = join(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';
const store = new CodeStore(process.env.DATA_FILE ?? join(root, 'data', 'codes.json'));
const app = createApp({ store, distDir: join(root, 'dist'), trustProxy: process.env.TRUST_PROXY === '1' });

app.listen(port, host, () => {
  console.log(`人生底层代码 已启动:http://${host}:${port}`);
});
