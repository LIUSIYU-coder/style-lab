// 书本:单页、从书脊处翻页;页面里的文字一句句显出来;手势(长按、轻点、上滑)。
import { esc } from '../html.ts';
import { Sound } from './sound.ts';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise(r => setTimeout(r, reducedMotion() ? Math.min(ms, 120) : ms));
const NUM = '〇一二三四五六七八九';

/** 页码用中文数字 */
export function cnNum(n: number): string {
  if (n <= 10) return n === 10 ? '十' : NUM[n];
  if (n < 20) return '十' + NUM[n - 10];
  return NUM[Math.floor(n / 10)] + '十' + (n % 10 ? NUM[n % 10] : '');
}

export interface PageOptions {
  /** 页眉右侧,比如"第一章 · 清晨" */
  head?: string;
  /** 页脚页码 */
  folio?: number;
  /** 页面正文的额外 class */
  cls?: string;
}

export class Book {
  readonly el: HTMLElement;
  private current: HTMLElement | null = null;
  private cleanups: Array<() => void> = [];

  constructor(el: HTMLElement) {
    this.el = el;
  }

  page(inner: string, opts: PageOptions = {}): HTMLElement {
    const el = document.createElement('section');
    el.className = 'page';
    el.innerHTML = `
      ${opts.head !== undefined ? `<header class="page-head"><span>人生之书</span><span>${esc(opts.head)}</span></header>` : ''}
      <div class="page-body ${opts.cls ?? ''}">${inner}</div>
      ${opts.folio ? `<footer class="page-foot">· ${cnNum(opts.folio)} ·</footer>` : ''}`;
    return el;
  }

  /** 离开当前页时要做的清理(停动画、停声音) */
  onLeave(fn: () => void) {
    this.cleanups.push(fn);
  }

  turn(next: HTMLElement, sound = true) {
    this.cleanups.forEach(f => f());
    this.cleanups = [];
    this.el.append(next);
    const old = this.current;
    if (old) {
      this.el.append(old);
      old.classList.add('leaf');
      old.setAttribute('aria-hidden', 'true');
      if (sound) Sound.flip();
      const remove = () => old.remove();
      old.addEventListener('animationend', remove, { once: true });
      setTimeout(remove, 1400);
    }
    this.current = next;
    next.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  }
}

function scrollIn(el: Element) {
  el.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** 一句一句显出来;点一下页面就直接全部显出 */
export async function reveal(container: HTMLElement, lines: string[], cls = '', fast = false) {
  let skip = false;
  const page = container.closest('.page');
  const onTap = (e: Event) => {
    if (!(e.target as HTMLElement).closest('button, input, textarea, select, a')) skip = true;
  };
  page?.addEventListener('pointerdown', onTap);
  for (const line of lines) {
    const p = document.createElement('p');
    p.className = `ink-in ${cls}`;
    p.textContent = line;
    container.append(p);
    scrollIn(p);
    if (!skip) await wait(fast ? 140 : Math.min(2600, 450 + line.length * 50));
  }
  page?.removeEventListener('pointerdown', onTap);
}

export function gestureButton(container: HTMLElement, label: string, withFill: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gesture ink-in';
  b.innerHTML = `${withFill ? '<span class="fill"></span>' : ''}<span class="pulse" aria-hidden="true"></span><span class="g-label">${esc(label)}</span>`;
  container.append(b);
  scrollIn(b);
  return b;
}

/** 按住 duration 毫秒;键盘回车直接完成 */
export function hold(btn: HTMLButtonElement, duration: number, onProgress: (p: number) => void): Promise<void> {
  return new Promise(resolve => {
    let start = 0, raf = 0, done = false;
    const set = (p: number) => { btn.style.setProperty('--p', String(p)); onProgress(p); };
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); set(1); resolve(); };
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      set(p);
      if (p >= 1) finish();
      else raf = requestAnimationFrame(tick);
    };
    btn.addEventListener('pointerdown', e => {
      if (done) return;
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      start = performance.now();
      raf = requestAnimationFrame(tick);
    });
    const cancel = () => { if (!done) { cancelAnimationFrame(raf); set(0); } };
    btn.addEventListener('pointerup', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } });
  });
}

/** 轻点 times 下 */
export function taps(btn: HTMLButtonElement, times: number, onTap: (n: number) => void): Promise<void> {
  return new Promise(resolve => {
    let n = 0;
    btn.addEventListener('click', () => {
      if (n >= times) return;
      n += 1;
      onTap(n);
      if (n >= times) resolve();
    });
  });
}

/** 在按钮上向上滑;点一下(或键盘)也能完成,照顾不方便滑动的人 */
export function swipeUp(btn: HTMLButtonElement, onProgress: (p: number) => void): Promise<void> {
  return new Promise(resolve => {
    let y0: number | null = null, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const t0 = performance.now();
      const anim = (now: number) => { const p = Math.min(1, (now - t0) / 500); onProgress(p); if (p < 1) requestAnimationFrame(anim); else resolve(); };
      requestAnimationFrame(anim);
    };
    btn.addEventListener('pointerdown', e => { y0 = e.clientY; btn.setPointerCapture?.(e.pointerId); });
    btn.addEventListener('pointermove', e => {
      if (y0 === null || done) return;
      const p = Math.max(0, Math.min(1, (y0 - e.clientY) / 80));
      onProgress(p * 0.6);
      if (p >= 1) finish();
    });
    btn.addEventListener('pointerup', e => {
      if (done) return;
      const moved = y0 === null ? 0 : y0 - e.clientY;
      y0 = null;
      if (moved > 40 || Math.abs(moved) < 6) finish();
      else onProgress(0);
    });
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } });
  });
}

const MARKS = '甲乙丙丁戊';

/** 显示选项,返回选中的序号 */
export function choose(container: HTMLElement, labels: string[]): Promise<number> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'options ink-in';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '你的选择');
    box.innerHTML = labels.map((l, i) => `<button class="opt" type="button" data-i="${i}"><b aria-hidden="true">${MARKS[i]}</b><span>${esc(l)}</span></button>`).join('');
    container.append(box);
    scrollIn(box);
    box.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.opt');
      if (!b) return;
      box.remove();
      resolve(Number(b.dataset.i));
    });
  });
}

export function append(container: HTMLElement, html: string): HTMLElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  const el = tpl.content.firstElementChild as HTMLElement;
  container.append(el);
  scrollIn(el);
  return el;
}
