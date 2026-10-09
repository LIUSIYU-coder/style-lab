// 深度解析的阅读页。内容由服务器生成,这里只负责排版。
import type { DeepReport } from './engine/deep.ts';
import { esc } from './html.ts';

const CHECK_KEY = 'life-code.weeks.';

function loadChecks(id: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHECK_KEY + id) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveChecks(id: string, checks: Set<string>) {
  try {
    localStorage.setItem(CHECK_KEY + id, JSON.stringify([...checks]));
  } catch {
    /* 忽略 */
  }
}

/** 小说全文,用于"复制全文" */
export function novelText(d: DeepReport): string {
  return [
    `《${d.title}》`,
    ...d.novel.flatMap(c => ['', `${c.title}（${c.subtitle}）`, ...c.paragraphs]),
    '',
    '尾声',
    ...d.epilogue,
  ].join('\n');
}

export function deepHtml(d: DeepReport): string {
  const toc = [
    ['novel', '你的这一天'],
    ['pillars', '四柱逐柱'],
    ['dayun', '人生章节'],
    ['notes', '24 个选择'],
    ['patterns', '你是怎样的人'],
    ['weeks', '四周小实验'],
    ['letter', '一封信'],
  ];
  const novel = d.novel
    .map(
      c => `
      <section class="chapter">
        <h3>${esc(c.title)}</h3>
        <p class="chapter-sub">${esc(c.subtitle)}</p>
        ${c.paragraphs.map((p, i) => `<p class="${i === 0 ? 'lead' : i === c.paragraphs.length - 1 ? 'coda' : ''}">${esc(p)}</p>`).join('')}
      </section>`,
    )
    .join('<p class="fleuron" aria-hidden="true">· · ·</p>');

  const pillars = d.pillars
    .map(
      p => `
      <article class="pillar-card">
        <header><span class="gz">${esc(p.ganZhi)}</span><span><b>${esc(p.label)} · ${esc(p.name)}</b><small>纳音 ${esc(p.naYin)}</small></span></header>
        ${p.text.map(t => `<p>${esc(t)}</p>`).join('')}
      </article>`,
    )
    .join('');

  const dayun = d.daYun
    .map(
      y => `
      <li>
        <span class="yun-gz">${esc(y.ganZhi)}</span>
        <div><b>${esc(y.ages)} · ${esc(y.theme)}</b><p>${esc(y.text)}</p>${y.inGame ? `<p class="in-game">${esc(y.inGame)}</p>` : ''}</div>
      </li>`,
    )
    .join('');

  const notes = d.notes
    .map(
      n => `
      <details class="note-item">
        <summary><span class="when">${esc(n.clock)}<small>${esc(n.agesLabel)}</small></span><span class="what">${esc(n.picked)}</span></summary>
        <div class="note-body">
          <div class="chips">${n.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
          <p>${esc(n.note)}</p>
          <p class="hint">如果当时选了别的：</p>
          <ul class="others">${n.others.map(o => `<li><b>${esc(o.text)}</b><span>${esc(o.result)}</span></li>`).join('')}</ul>
        </div>
      </details>`,
    )
    .join('');

  const patterns = d.patterns
    .map(p => `<div class="pattern"><h4>${esc(p.title)}</h4><p>${esc(p.text)}</p>${p.evidence ? `<p class="hint">${esc(p.evidence)}</p>` : ''}</div>`)
    .join('');

  const checks = loadChecks(d.title);
  const weeks = d.weeks
    .map(
      w => `
      <div class="week">
        <div class="week-head"><span class="week-no">第 ${w.week} 周</span><b>${esc(w.title)}</b></div>
        <p class="hint">${esc(w.why)}</p>
        ${w.steps.map((s, i) => {
          const id = `${w.week}-${i}`;
          return `<label class="step"><input type="checkbox" data-check="${id}"${checks.has(id) ? ' checked' : ''}><span>${esc(s)}</span></label>`;
        }).join('')}
      </div>`,
    )
    .join('');

  return `
    <p class="eyebrow">完整深度解析</p>
    <h2 class="h2" id="deep-title" tabindex="-1">${esc(d.title)}</h2>
    <p class="lede">${esc(d.summary)}</p>
    <nav class="toc" aria-label="目录">${toc.map(([id, name]) => `<a href="#d-${id}">${name}</a>`).join('')}</nav>

    <section class="panel deep-block" id="d-novel">
      <div class="panel-title"><span>《你的这一天》</span><b>五章小说</b></div>
      <div class="novel">${novel}
        <section class="chapter epilogue"><h3>尾声</h3>${d.epilogue.map(p => `<p>${esc(p)}</p>`).join('')}</section>
      </div>
      <button class="btn" type="button" id="btn-copy-novel">复制小说全文</button>
      <p class="hint" id="copy-note" aria-live="polite"></p>
    </section>

    <section class="panel deep-block" id="d-pillars">
      <div class="panel-title"><span>四柱逐柱解读</span><b>年 · 月 · 日 · 时</b></div>
      ${pillars}
    </section>

    <section class="panel deep-block" id="d-dayun">
      <div class="panel-title"><span>大运 · 人生章节</span><b>每十年一个主题</b></div>
      <ol class="yun-chapters">${dayun}</ol>
      <p class="hint">大运在这里是游戏的"章节背景"，用来对照你在那个年纪做的选择，不是对现实的判断。</p>
    </section>

    <section class="panel deep-block" id="d-notes">
      <div class="panel-title"><span>24 个选择逐条批注</span><b>点开看没走的路</b></div>
      <div class="notes">${notes}</div>
    </section>

    <section class="panel deep-block" id="d-patterns">
      <div class="panel-title"><span>你是怎样的人</span><b>三种处境</b></div>
      ${patterns}
      <div class="combo"><span class="hint">主轴 + 副轴</span><h4>${esc(d.combo.name)}</h4><p>${esc(d.combo.text)}</p></div>
    </section>

    <section class="panel deep-block" id="d-weeks">
      <div class="panel-title"><span>四周小实验</span><b>做完打个勾</b></div>
      ${weeks}
    </section>

    <section class="letter" id="d-letter">
      ${d.letter.map((p, i) => `<p class="${i === 0 ? 'salute' : ''}">${esc(p)}</p>`).join('')}
      <p class="sign">—— 破晓时分的你</p>
    </section>

    <div class="btn-row">
      <button class="btn" type="button" id="btn-deep-back">回到纪念卡</button>
      <button class="btn" type="button" id="btn-deep-replay">换一种选法</button>
    </div>
    <p class="fine">深度解析由你的出生设定和 24 个选择生成，是虚构的娱乐内容，不构成任何预测或建议。</p>
  `;
}

export function bindDeep(root: HTMLElement, d: DeepReport) {
  const checks = loadChecks(d.title);
  root.querySelectorAll<HTMLInputElement>('[data-check]').forEach(box =>
    box.addEventListener('change', () => {
      if (box.checked) checks.add(box.dataset.check!);
      else checks.delete(box.dataset.check!);
      saveChecks(d.title, checks);
    }),
  );
  root.querySelector<HTMLButtonElement>('#btn-copy-novel')?.addEventListener('click', async () => {
    const note = root.querySelector<HTMLElement>('#copy-note')!;
    try {
      await navigator.clipboard.writeText(novelText(d));
      note.textContent = '已复制，可以粘贴到备忘录或发给朋友。';
    } catch {
      note.textContent = '复制失败了，可以长按文字手动选择复制。';
    }
  });
}
