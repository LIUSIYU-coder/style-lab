#!/usr/bin/env python3
"""把 art/scenes-src/ 里的原图(1600×1200 JPG)压成网页用的 WebP,并生成极小的模糊占位图。

用法(在 life-game 目录里):  python3 scripts/optimize-scenes.py
需要 Pillow:                 pip install pillow

输出:
  public/scenes/<名字>.webp    网页实际加载的图(960×720,平均约 100KB,原图约 290KB)
  src/scenes-lqip.json         每张图的 40×30 模糊占位图(base64,每张约 600~900 字节),
                               网页在大图下载完之前先显示它,所以翻到新一页时画面是立刻出现的
"""
import base64, io, json, pathlib, sys
from PIL import Image, ImageFilter

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'art' / 'scenes-src'
out = root / 'public' / 'scenes'
out.mkdir(parents=True, exist_ok=True)

files = sorted(src.glob('*.jpg'))
if not files:
    sys.exit(f'{src} 里没有 .jpg 原图')

lqip = {}
total_in = total_out = 0
for f in files:
    im = Image.open(f).convert('RGB')
    if im.size != (1600, 1200):
        print(f'提示:{f.name} 尺寸是 {im.size},不是 1600×1200')
    big = im.resize((960, 720), Image.LANCZOS)
    dst = out / (f.stem + '.webp')
    big.save(dst, 'WEBP', quality=70, method=6)
    tiny = im.resize((40, 30), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.5))
    buf = io.BytesIO()
    tiny.save(buf, 'WEBP', quality=60, method=6)
    lqip[f.stem] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    total_in += f.stat().st_size
    total_out += dst.stat().st_size

(root / 'src' / 'scenes-lqip.json').write_text(json.dumps(lqip, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(files)} 张:{total_in // 1024} KB → {total_out // 1024} KB(平均每张 {total_out // len(files) // 1024} KB)')
print('占位图合计', sum(len(v) for v in lqip.values()) // 1024, 'KB')

# 封面插画(可选):art/cover-src/cover.jpg → public/cover.webp
cover = root / 'art' / 'cover-src' / 'cover.jpg'
if cover.exists():
    im = Image.open(cover).convert('RGB')
    w = 810
    h = round(im.height * w / im.width)
    dst = root / 'public' / 'cover.webp'
    im.resize((w, h), Image.LANCZOS).save(dst, 'WEBP', quality=72, method=6)
    print(f'封面:{im.size} → {w}×{h},{dst.stat().st_size // 1024} KB')
