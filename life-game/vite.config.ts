import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径,便于放在任何静态托管的子目录下
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
