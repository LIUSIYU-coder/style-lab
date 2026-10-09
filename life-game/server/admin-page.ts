// 管理页:用手机就能生成兑换码、查询、重置设备、作废、看统计。需要 ADMIN_TOKEN。
export const ADMIN_PAGE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><title>人生之书 · 管理</title>
<style>
:root{--bg:#18202a;--paper:#f2ecdd;--ink:#25211c;--soft:#6d6457;--red:#b33f2e;--line:#d8cdb5;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "PingFang SC",system-ui,sans-serif}
main{max-width:30rem;margin:0 auto;padding:max(16px,env(safe-area-inset-top)) 16px 40px;display:flex;flex-direction:column;gap:14px}
h1{color:var(--paper);font-size:1.4rem;margin:8px 0}
section{background:var(--paper);border-radius:6px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
h2{font-size:1.05rem;margin:0}
label{font-size:.85rem;color:var(--soft)}
input,textarea{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:#fffdf6;color:var(--ink)}
textarea{min-height:10rem;font-family:ui-monospace,Menlo,monospace;font-size:.85rem}
.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1;min-width:6rem}
button{font:inherit;min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid var(--red);background:var(--red);color:#fbf3e4;cursor:pointer}
button.ghost{background:transparent;color:var(--red)}
.out{font-size:.9rem;white-space:pre-wrap;color:var(--ink)}
.err{color:var(--red)}
</style></head><body><main>
<h1>人生之书 · 管理</h1>
<section><h2>管理密码</h2><label for="token">部署时设置的 ADMIN_TOKEN，只保存在这个浏览器标签页里</label><input id="token" type="password" autocomplete="off"></section>
<section><h2>生成兑换码</h2>
<div class="row"><div><label for="count">数量</label><input id="count" type="number" min="1" max="500" value="20"></div><div><label for="batch">批次名</label><input id="batch" value=""></div></div>
<button id="make">生成</button>
<label for="codes">每行一张卡密，长按全选复制，粘贴到店铺后台</label><textarea id="codes" readonly></textarea>
<button class="ghost" id="copy">复制全部</button><p class="out" id="make-out"></p></section>
<section><h2>查询 / 重置 / 作废</h2>
<label for="code">兑换码</label><input id="code" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters">
<div class="row"><button id="check">查询</button><button class="ghost" id="reset">清空设备</button><button class="ghost" id="disable">作废</button></div>
<p class="out" id="code-out"></p></section>
<section><h2>统计</h2><button id="stats">刷新</button><p class="out" id="stats-out"></p></section>
</main><script>
const $=s=>document.querySelector(s);
try{$('#token').value=sessionStorage.getItem('lc-admin')||''}catch{}
$('#batch').value=new Date().toISOString().slice(0,10);
async function call(body,out){
  const token=$('#token').value.trim();
  try{sessionStorage.setItem('lc-admin',token)}catch{}
  out.className='out';out.textContent='处理中…';
  try{const r=await fetch('api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,token})});
    const d=await r.json();if(!d.ok){out.className='out err';out.textContent=d.error||'失败';return null}out.textContent='';return d}
  catch(e){out.className='out err';out.textContent='连不上服务器';return null}
}
$('#make').onclick=async()=>{const d=await call({action:'create',count:+$('#count').value,batch:$('#batch').value.trim()},$('#make-out'));if(d){$('#codes').value=d.lines.join('\\n');$('#make-out').textContent='已生成 '+d.lines.length+' 个。明文只显示这一次，请马上复制保存。'}};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#codes').value);$('#make-out').textContent='已复制'}catch{$('#codes').select();$('#make-out').textContent='请长按文本框手动复制'}};
const show=d=>{if(!d)return;const r=d.record;$('#code-out').textContent=r?('批次：'+r.batch+'\\n状态：'+(r.disabled?'已作废':r.firstUsed?'已使用':'未使用')+'\\n设备：'+r.devices.length+'/3　解锁次数：'+r.uses+(r.firstUsed?'\\n首次使用：'+r.firstUsed:'')):(d.message||'没有这个兑换码')};
$('#check').onclick=async()=>show(await call({action:'check',code:$('#code').value},$('#code-out')));
$('#reset').onclick=async()=>show(await call({action:'reset',code:$('#code').value},$('#code-out')));
$('#disable').onclick=async()=>show(await call({action:'disable',code:$('#code').value},$('#code-out')));
$('#stats').onclick=async()=>{const d=await call({action:'stats'},$('#stats-out'));if(d){const s=d.stats;$('#stats-out').textContent='共 '+s.total+' 个，已使用 '+s.used+' 个\\n'+Object.entries(s.batches).map(([b,v])=>b+'：'+v.used+'/'+v.total).join('\\n')}};
</script></body></html>`;
