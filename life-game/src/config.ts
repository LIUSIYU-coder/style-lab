// 上线前改这里。这些文字会显示在解锁区和分享图上。
export const SHOP = {
  /** 告诉玩家去哪里买兑换码。小红书不允许站外链接，写清楚搜索方式即可 */
  where: '小红书搜索「人生底层代码」，在店铺里购买兑换码',
  price: '9.9 元',
  /** 正式网址（不带 https://），印在分享图底部；留空则不印 */
  site: '',
};

/** 兑换接口，相对网页所在目录 */
export const UNLOCK_API = 'api/unlock';

/** 把 24 张场景插画放进 public/scenes/（文件名见 docs/image-brief.md；原图放 art/scenes-src/，运行 python3 scripts/optimize-scenes.py 生成网页用的 WebP）后改成 true；没放图时保持 false，用内置的矢量画面 */
export const SCENE_IMAGES = true;
