// 由 Wikidata 查询结果生成 src/engine/regions.ts(省级行政区 → 下一级行政区及经度)。
// 用法:先用 scripts/regions.rq 在 https://query.wikidata.org 查询,导出 JSON,再运行
//   node scripts/build-regions.mjs <查询结果.json>
// 数据来源 Wikidata,CC0 许可。港澳台时区和夏令时历史不同,不收录。
import { readFileSync, writeFileSync } from 'node:fs';

const ORDER = ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省', '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区'];
const CAPITALS = ['石家庄市', '太原市', '呼和浩特市', '沈阳市', '长春市', '哈尔滨市', '南京市', '杭州市', '合肥市', '福州市', '南昌市', '济南市', '郑州市', '武汉市', '长沙市', '广州市', '南宁市', '海口市', '成都市', '贵阳市', '昆明市', '拉萨市', '西安市', '兰州市', '西宁市', '银川市', '乌鲁木齐市'];
const SKIP = new Set(['中沙群岛']);

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8')).results.bindings;
const byProvince = new Map(ORDER.map(p => [p, new Map()]));
for (const r of rows) {
  const province = r.provName?.value;
  const name = r.name?.value;
  if (!byProvince.has(province) || !name || SKIP.has(name)) continue;
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord.value);
  if (!m) continue;
  byProvince.get(province).set(name, Math.round(Number(m[1]) * 100) / 100);
}

const collator = new Intl.Collator('zh-CN');
const out = ORDER.map(province => {
  const cities = [...byProvince.get(province)].sort(([a], [b]) => {
    const ca = CAPITALS.includes(a) ? 0 : 1;
    const cb = CAPITALS.includes(b) ? 0 : 1;
    return ca - cb || collator.compare(a, b);
  });
  if (!cities.length) throw new Error(`缺少数据:${province}`);
  return `  { name: '${province}', cities: [${cities.map(([n, lng]) => `['${n}', ${lng}]`).join(', ')}] },`;
});

writeFileSync(
  new URL('../src/engine/regions.ts', import.meta.url),
  `// 由 scripts/build-regions.mjs 生成,请勿手改。数据来源:Wikidata(CC0)。
// 每项为 [名称, 东经度数],用于真太阳时校正。港澳台不收录。
export interface Province {
  name: string;
  cities: ReadonlyArray<readonly [string, number]>;
}

export const PROVINCES: readonly Province[] = [
${out.join('\n')}
];
`,
);
console.log('provinces', out.length, 'places', [...byProvince.values()].reduce((s, m) => s + m.size, 0));
