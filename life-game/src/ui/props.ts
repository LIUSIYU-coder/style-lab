// 每一幕右下角的物件小图标(线描 SVG,64×64)。
import type { PropId } from '../engine/story.ts';

export const PROPS: Record<PropId, string> = {
  chime: '<path d="M14 8 H50 M20 8 V14 M32 8 V14 M44 8 V14"/><rect x="17" y="14" width="6" height="22" rx="2"/><rect x="29" y="14" width="6" height="32" rx="2"/><rect x="41" y="14" width="6" height="18" rx="2"/><path d="M32 46 V54"/><circle cx="32" cy="57" r="3"/>',
  kite: '<polygon points="32,4 50,26 32,46 14,26"/><path d="M32 4 V46 M14 26 H50"/><path d="M32 46 q-7 5 0 9 q7 4 0 9"/>',
  umbrella: '<path d="M6 30 Q32 2 58 30 Q51 25 45 30 Q38 25 32 30 Q26 25 19 30 Q13 25 6 30 Z"/><path d="M32 30 V52 q0 6 -6 6 q-5 0 -5 -5"/>',
  lantern: '<path d="M24 8 H40 M28 8 V12 M36 8 V12"/><rect x="16" y="12" width="32" height="36" rx="14"/><path d="M32 12 V48 M23 15 Q18 30 23 45 M41 15 Q46 30 41 45 M26 48 H38 M32 48 V60 M28 52 V60 M36 52 V60"/>',
  bicycle: '<circle cx="15" cy="42" r="11"/><circle cx="49" cy="42" r="11"/><path d="M15 42 L27 24 H44 L49 42 M27 24 L34 42 H15 M44 24 L46 15 H53 M23 19 H32"/>',
  bowl: '<path d="M8 32 H56 Q54 52 32 54 Q10 52 8 32 Z M22 54 H42"/><path d="M40 10 L28 34 M48 12 L34 34"/>',
  pencil: '<polygon points="14,50 44,20 52,28 22,58"/><path d="M14 50 L9 61 L22 58 M40 24 L48 32"/>',
  phone: '<rect x="18" y="4" width="28" height="56" rx="5"/><path d="M27 10 H37 M18 48 H46"/><circle cx="32" cy="54" r="2"/>',
  signpost: '<path d="M32 6 V60 M24 60 H40"/><polygon points="12,12 46,12 53,19 46,26 12,26"/><polygon points="52,32 18,32 11,39 18,46 52,46"/>',
  notebook: '<rect x="14" y="6" width="38" height="52" rx="3"/><path d="M10 16 H18 M10 28 H18 M10 40 H18 M24 18 H44 M24 26 H44 M24 34 H38"/>',
  lamp: '<path d="M14 58 H42 M26 58 V42 L38 22"/><polygon points="32,16 52,12 47,32"/><path d="M48 34 L54 42 M43 36 L44 46"/>',
  suitcase: '<rect x="8" y="20" width="48" height="34" rx="5"/><path d="M24 20 V13 H40 V20 M20 20 V54 M44 20 V54"/><circle cx="16" cy="58" r="3"/><circle cx="48" cy="58" r="3"/>',
  laptop: '<rect x="13" y="10" width="38" height="28" rx="3"/><polygon points="6,42 58,42 63,52 1,52"/>',
  ticket: '<path d="M6 18 H58 V27 a5 5 0 0 0 0 10 V46 H6 V37 a5 5 0 0 0 0 -10 Z"/><path d="M42 20 V44" stroke-dasharray="3 3"/><path d="M14 26 H32 M14 33 H28"/>',
  cup: '<path d="M12 22 H44 V44 q0 10 -10 10 H22 q-10 0 -10 -10 Z M44 28 h6 q6 0 6 6 q0 6 -6 6 h-6"/>',
  key: '<circle cx="18" cy="32" r="11"/><circle cx="18" cy="32" r="3.5"/><path d="M29 32 H58 M48 32 V41 M55 32 V39"/>',
  box: '<rect x="8" y="24" width="48" height="30" rx="3"/><path d="M8 34 H56 M26 24 V18 H38 V24 M30 34 V40 H34 V34"/>',
  guitar: '<circle cx="22" cy="44" r="13"/><circle cx="33" cy="32" r="8"/><circle cx="24" cy="42" r="4"/><path d="M36 29 L54 11 M50 7 L58 15"/>',
  plant: '<polygon points="20,40 44,40 40,58 24,58"/><path d="M32 40 V18 M32 30 Q18 30 14 16 Q28 14 32 30 M32 24 Q44 24 50 10 Q36 8 32 24"/>',
  letter: '<rect x="7" y="16" width="50" height="34" rx="3"/><path d="M7 18 L32 37 L57 18"/>',
};

export function propSvg(id: PropId): string {
  return `<svg class="prop" viewBox="0 0 64 64" aria-hidden="true"><g>${PROPS[id]}</g></svg>`;
}
