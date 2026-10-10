# 上线指南：从零到可以卖

全程用 iPhone 就能完成：服务器用阿里云网页上的「远程连接」操作，不需要电脑。

> 想先免费试水？看 [deploy-free.md](deploy-free.md)（Render + Upstash，不用买服务器）。

整体流程：**买服务器和域名 → 一条命令部署 → 生成兑换码 → 在小红书上架卡密商品 → 发视频引流**。

---

## 1. 准备服务器和域名

**服务器**：阿里云「轻量应用服务器」，地域选**中国香港**，系统选 **Ubuntu 22.04 或 24.04**，最低配置就够用（网页很小，兑换接口也很轻）。价格以阿里云官网当天为准。

- 选香港是因为**香港服务器不需要 ICP 备案**，买完当天就能上线；内地服务器必须先备案，个人备案通常要等一到几周。
- 不建议用免费托管平台：兑换码数据存在服务器的文件里，免费平台重启或重新部署时可能把数据清掉，买家的兑换码就失效了。

**域名**：在阿里云买一个便宜的 `.com` 或 `.top`，按提示完成域名实名认证。然后在「云解析 DNS」里添加一条记录：

| 记录类型 | 主机记录 | 记录值 |
|---|---|---|
| A | `@`（或 `life` 之类的子域名） | 你服务器的公网 IP |

**防火墙**：在轻量服务器控制台的「防火墙」里，确认放行了 **80** 和 **443** 端口（HTTPS 证书申请要用到 80）。

## 2. 用手机连上服务器

轻量服务器控制台 → 你的服务器 → **远程连接**（Workbench），在手机浏览器里就能打开一个命令行窗口。也可以装 Termius 之类的 SSH App。

## 3. 部署（一条命令）

先在 GitHub 上改好店铺信息：打开 `life-game/src/config.ts`，修改

- `where`：玩家去哪里买兑换码，比如「小红书搜索『xxx』，在店铺里购买兑换码」
- `price`：价格
- `site`：你的域名（不带 `https://`），会印在分享图底部

然后在服务器命令行里依次粘贴（`你的域名` 换成真实域名）：

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/liusiyu-coder/style-lab.git
cd style-lab && git checkout claude/admiring-knuth-vw1v8f && cd life-game
sudo bash deploy/install.sh 你的域名
```

> 仓库是私有的话，`git clone` 会要求登录：用户名填 GitHub 用户名，密码填一个 GitHub Personal Access Token（GitHub → Settings → Developer settings → Fine-grained tokens，只给这个仓库的 Contents 只读权限）。

脚本会自动安装 Node.js 和 Caddy、构建网页、注册开机自启的服务，并自动申请 HTTPS 证书。看到「部署完成」后，用手机打开 `https://你的域名` 试玩一遍。

## 4. 生成兑换码

**最简单的办法：用管理页。** 部署完成时脚本会打印管理页网址和管理密码，手机打开 `https://你的域名/admin`，填入密码就能生成、查询、重置、作废兑换码。忘了密码可以运行 `sudo cat /opt/life-code/data/admin-token` 查看。

也可以用命令行：

```bash
cd /opt/life-code
sudo -u lifecode SITE=你的域名 node scripts/codes.ts make 50 first
sudo cat /opt/life-code/data/codes-first.csv
```

- `50` 是数量，`first` 是批次名（以后可以叫 `second`、`1101`……）。
- 加了 `SITE=你的域名`，每行会写成「网址 https://你的域名  兑换码 XXXX-XXXX-XXXX」。**买家收到卡密就同时拿到了网址**，不需要你私信发链接（小红书不允许在笔记、评论、私信里放站外链接）。
- 用 `cat` 显示出来后，长按复制，粘贴到店铺后台导入卡密。复制完可以删掉这个 CSV：`sudo rm /opt/life-code/data/codes-first.csv`。服务器只保存兑换码的加密摘要，不保存明文。

每个兑换码：

- 最多绑定 **3 台设备**；同一台设备可以反复看、反复重玩，每一局都会生成新的解析。
- 输错次数太多的 IP 会被暂停 15 分钟，防止有人乱试。

## 5. 售后常用命令

```bash
cd /opt/life-code
sudo -u lifecode node scripts/codes.ts check XXXX-XXXX-XXXX    # 查看使用情况
sudo -u lifecode node scripts/codes.ts reset XXXX-XXXX-XXXX    # 买家换手机：清空已绑定设备
sudo -u lifecode node scripts/codes.ts disable XXXX-XXXX-XXXX  # 退款后作废
sudo -u lifecode node scripts/codes.ts stats                   # 卖出 / 用掉多少
```

## 6. 更新网站

代码有更新时：

```bash
cd ~/style-lab && git pull
cd life-game && sudo bash deploy/install.sh 你的域名
```

兑换码数据在 `/opt/life-code/data/`，更新不会动它。

**备份**：隔一段时间把兑换码数据备份一份，`sudo cp /opt/life-code/data/codes.json ~/codes-backup-$(date +%F).json`。

## 7. 小红书上架注意

- 商品类型选虚拟商品、卡密自动发货（以店铺后台实际提供的选项为准）。
- **标题和详情不要写「算命」「八字测算」「改运」「预测」这类词**。平台对占卜算命类商品管得严，容易被下架。建议定位成「人生模拟小游戏 + 性格深度解析」，比如「一局 24 小时的人生模拟｜你的专属人生小说与性格解析」。
- 详情页写清楚：买到的是兑换码；先免费玩完，最后输入兑换码解锁；一个码可在 3 台设备使用；内容为虚构娱乐。
- 发货话术示例：「打开卡密里的网址，过完这一天后，在『完整深度解析』里输入兑换码即可。换手机请联系我重置。」

## 8. 录视频引流的小建议

- 直接用 iPhone 屏幕录制：开场的时辰钟 → 填出生信息 → 两三个有画面的选择 → 结局的人生纪念卡 → 解锁区里那段**模糊的小说预览**，最后停在「输入兑换码」。
- 第一秒就抛问题：「如果把一生放进一天，你会怎么过？」
- 评论区常见问题提前想好怎么回，但不要回网址，引导去店铺。
- 不要在视频里露出完整兑换码。

## 出问题时

| 现象 | 处理 |
|---|---|
| 打不开网页 | 检查域名解析是否指向服务器 IP、防火墙是否放行 80/443；`sudo systemctl status caddy` 看 Caddy 日志 |
| 网页能开，兑换失败 | `journalctl -u life-code -n 50` 看服务日志；`curl localhost:8080/api/health` 应返回 `{"ok":true}` |
| 买家说兑换码不对 | `check` 看看这个码存不存在、是不是已经绑满 3 台设备 |
