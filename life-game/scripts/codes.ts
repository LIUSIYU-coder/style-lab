// 兑换码管理工具。在服务器上运行:
//   node scripts/codes.ts make 50 [批次名]   生成 50 个兑换码,保存为 codes-批次名.csv(可直接导入小红书卡密)
//   node scripts/codes.ts check XXXX-XXXX-XXXX   查看使用情况
//   node scripts/codes.ts reset XXXX-XXXX-XXXX   清空已绑定设备(买家换手机)
//   node scripts/codes.ts disable XXXX-XXXX-XXXX 作废(退款后)
//   node scripts/codes.ts stats                  统计
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodeStore, MAX_DEVICES } from '../server/codes.ts';

const root = join(import.meta.dirname, '..');
const store = new CodeStore(process.env.DATA_FILE ?? join(root, 'data', 'codes.json'));
const [cmd, arg, arg2] = process.argv.slice(2);

function usage(): never {
  console.log('用法:node scripts/codes.ts make <数量> [批次名] | check <兑换码> | reset <兑换码> | disable <兑换码> | stats');
  process.exit(1);
}

switch (cmd) {
  case 'make': {
    const n = Number(arg);
    if (!Number.isInteger(n) || n < 1 || n > 5000) usage();
    const batch = arg2 ?? new Date().toISOString().slice(0, 10);
    if (!/^[\w-]{1,32}$/.test(batch)) usage();
    const codes = store.create(n, batch);
    const file = join(root, `codes-${batch}.csv`);
    writeFileSync(file, codes.join('\n') + '\n', { flag: 'a' });
    console.log(`已生成 ${codes.length} 个兑换码,追加保存到 ${file}`);
    console.log('提示:这个 CSV 是明文兑换码,导入店铺后请从服务器上删掉或妥善保管。');
    break;
  }
  case 'check': {
    if (!arg) usage();
    const r = store.info(arg);
    if (!r) console.log('没有这个兑换码');
    else {
      console.log(`批次:${r.batch}  生成于:${r.created}`);
      console.log(`状态:${r.disabled ? '已作废' : r.firstUsed ? '已使用' : '未使用'}`);
      console.log(`设备:${r.devices.length}/${MAX_DEVICES}  解锁次数:${r.uses}`);
      if (r.firstUsed) console.log(`首次使用:${r.firstUsed}  最近使用:${r.lastUsed}`);
    }
    break;
  }
  case 'reset':
    if (!arg) usage();
    console.log(store.reset(arg) ? '已清空绑定的设备,买家可以在新手机上重新输入。' : '没有这个兑换码');
    break;
  case 'disable':
    if (!arg) usage();
    console.log(store.disable(arg) ? '已作废。' : '没有这个兑换码');
    break;
  case 'stats': {
    const s = store.stats();
    console.log(`共 ${s.total} 个,已使用 ${s.used} 个`);
    for (const [b, v] of Object.entries(s.batches)) console.log(`  ${b}: ${v.used}/${v.total}`);
    break;
  }
  default:
    usage();
}
