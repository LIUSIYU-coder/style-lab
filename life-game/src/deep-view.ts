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
    '《你的这一天》',
    ...d.novel.flatMap(c => ['', `${c.title}（${c.subtitle}）`, ...c.paragraphs]),
    '',
    '尾声',
    ...d.epilogue,
  ].join('\n');
}

export function deepHtml(d: DeepReport): string {
  const toc = [
    ['now', '现在这一页'],
    ['rewrites', '六行深读'],
    ['patterns', '你是怎样的人'],
    ['pillars', '四柱'],
    ['dayun', '大运'],
    ['notes', '24 个选择'],
    ['weeks', '小实验'],
    ['letter', '一封信'],
    ['novel', '附赠小说'],
  ];
  const now = `
    <div class="now-box"><span class="hint" style="color:inherit">你今年 ${d.now.age} 岁，正走到</span><b>${esc(d.now.clock)} · ${esc(d.now.stage)}</b></div>
    ${d.now.text.map(t => `<p>${esc(t)}</p>`).join('')}
    ${d.now.concern ? `<div class="combo"><span class="hint">你最近在意的：${esc(d.now.concern.title)}</span>${d.now.concern.text.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}`;
  const rewrites = d.rewrites
    .map(r => `
      <div class="rw">
        <div class="rw-head"><b>${esc(r.title)}</b><span class="verdict v-${r.verdict}">${r.verdict}</span></div>
        ${r.text.map(t => `<p>${esc(t)}</p>`).join('')}
      </div>`)
    .join('');
  const lines = d.lines.length
    ? `<div class="combo"><span class="hint">你亲手写下的话</span>${d.lines.map(l => `<p class="hint">${esc(l.label)}</p><p class="written still">${esc(l.text)}</p>`).join('')}</div>`
    : '';
  const novel = d.novel
    .map(
      c => `
      <section class="chapter-d">
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
    <p class="eyebrow">书末附录 · 已解锁</p>
    <h2 class="h2" id="deep-title" tabindex="-1">${esc(d.title)}</h2>
    <p class="lede">${esc(d.summary)}</p>
    <nav class="toc" aria-label="目录">${toc.map(([id, name]) => `<a href="#d-${id}">${name}</a>`).join('')}</nav>

    <section class="panel" id="d-now">
      <div class="panel-title"><span>你现在所在的这一页</span><b>第一节</b></div>
      ${now}
    </section>

    <section class="panel" id="d-rewrites">
      <div class="panel-title"><span>六行底层代码</span><b>逐行深读</b></div>
      ${rewrites}
    </section>

    <section class="panel" id="d-patterns">
      <div class="panel-title"><span>你是怎样的人</span><b>三种处境</b></div>
      ${patterns}
      <div class="combo"><span class="hint">主轴 + 副轴</span><h4>${esc(d.combo.name)}</h4><p>${esc(d.combo.text)}</p></div>
    </section>

    <section class="panel" id="d-pillars">
      <div class="panel-title"><span>四柱逐柱</span><b>年 · 月 · 日 · 时</b></div>
      ${pillars}
    </section>

    <section class="panel" id="d-dayun">
      <div class="panel-title"><span>大运 · 人生章节</span><b>每十年一个主题</b></div>
      <ol class="yun-chapters">${dayun}</ol>
      <p class="hint">大运在这里是游戏的"章节背景"，用来对照你在那个年纪做的选择，不是对现实的判断。</p>
    </section>

    <section class="panel" id="d-notes">
      <div class="panel-title"><span>24 个选择</span><b>点开看没走的路</b></div>
      <div class="notes">${notes}</div>
    </section>

    <section class="panel" id="d-weeks">
      <div class="panel-title"><span>四周小实验</span><b>做完打个勾</b></div>
      ${weeks}
    </section>

    <section class="letter" id="d-letter">
      ${d.letter.map((p, i) => `<p class="${i === 0 ? 'salute' : ''}">${esc(p)}</p>`).join('')}
      <p class="sign">—— 破晓时分的你</p>
    </section>
    ${lines}

    <section class="panel" id="d-novel">
      <div class="panel-title"><span>附赠 · 《你的这一天》</span><b>五章小说</b></div>
      <div class="novel">${novel}
        <section class="chapter-d epilogue"><h3>尾声</h3>${d.epilogue.map(p => `<p>${esc(p)}</p>`).join('')}</section>
      </div>
      <button class="btn" type="button" id="btn-copy-novel">复制小说全文</button>
      <p class="copy-note" id="copy-note" aria-live="polite"></p>
    </section>

    <div class="row center">
      <button class="btn" type="button" id="btn-deep-back">回到书末附录</button>
      <button class="btn" type="button" id="btn-deep-replay">重读一遍，换一种选法</button>
    </div>
    <p class="fine">人生说明书由你的出生设定、扉页信息和 24 个选择生成，是虚构的娱乐内容，不构成任何预测或建议。</p>
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
