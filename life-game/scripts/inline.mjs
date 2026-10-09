// 把 vite build 的产物内联成单个 HTML 文件:dist/life-code.html(可直接打开,或上传到任意静态托管)。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const read = file => readFileSync(join(dist, file), 'utf8');
const SCRIPT = /<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g;
const STYLE = /<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g;

let html = read('index.html');
const scripts = [...html.matchAll(SCRIPT)].map(
  m => `<script type="module">${read(m[1]).replace(/<\/script/gi, '<\\/script')}</script>`,
);
html = html
  .replace(SCRIPT, '')
  .replace(STYLE, (_, href) => `<style>${read(href)}</style>`)
  // 脚本放在 body 末尾,执行时 DOM 已就绪
  .replace('</body>', `${scripts.join('\n')}\n</body>`);

writeFileSync(join(dist, 'life-code.html'), html);
console.log(`wrote dist/life-code.html (${(html.length / 1024).toFixed(1)} KB)`);
