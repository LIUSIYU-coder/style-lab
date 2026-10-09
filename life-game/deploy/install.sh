#!/usr/bin/env bash
# 一键部署 / 更新「人生底层代码」到一台 Ubuntu 或 Debian 服务器。
# 用法(在 life-game 目录里运行):sudo bash deploy/install.sh 你的域名
# 会做这些事:安装 Node.js 22 和 Caddy → 把代码复制到 /opt/life-code → 构建网页
#            → 注册 systemd 服务 → 让 Caddy 自动申请 HTTPS 证书并转发到服务。
# 再次运行即为更新,兑换码数据(/opt/life-code/data)会保留。
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "用法:sudo bash deploy/install.sh 你的域名(例如 life.example.com)"
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "请用 sudo 运行"
  exit 1
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/life-code
PORT=8080

echo "==> 1/6 安装基础工具"
apt-get update -y
apt-get install -y curl ca-certificates gnupg rsync debian-keyring debian-archive-keyring apt-transport-https

echo "==> 2/6 安装 Node.js 22"
need_node=1
if command -v node >/dev/null 2>&1; then
  # 需要 22.18 以上:可以直接运行 .ts 文件
  if node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; then need_node=0; fi
fi
if [[ $need_node -eq 1 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 3/6 安装 Caddy(自动 HTTPS)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> 4/6 复制代码并构建"
id -u lifecode >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin lifecode
mkdir -p "$APP/data"
rsync -a --delete --exclude node_modules --exclude dist --exclude data --exclude 'codes-*.csv' "$SRC/" "$APP/"
cd "$APP"
npm ci --no-audit --no-fund
npm run build
chown -R lifecode:lifecode "$APP/data"
chmod 700 "$APP/data"

# 管理页密码:第一次部署时随机生成,保存在数据目录里,更新时沿用
if [[ ! -s "$APP/data/admin-token" ]]; then
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$APP/data/admin-token"
fi
chown lifecode:lifecode "$APP/data/admin-token"
chmod 600 "$APP/data/admin-token"
ADMIN_TOKEN="$(cat "$APP/data/admin-token")"

echo "==> 5/6 注册服务"
cat > /etc/systemd/system/life-code.service <<UNIT
[Unit]
Description=人生底层代码
After=network.target

[Service]
User=lifecode
WorkingDirectory=$APP
Environment=PORT=$PORT HOST=127.0.0.1 TRUST_PROXY=1 NODE_NO_WARNINGS=1 SITE=$DOMAIN ADMIN_TOKEN=$ADMIN_TOKEN
ExecStart=$(command -v node) server/main.ts
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable life-code >/dev/null
systemctl restart life-code

echo "==> 6/6 配置 Caddy"
if [[ -f /etc/caddy/Caddyfile ]] && ! grep -q "life-code" /etc/caddy/Caddyfile; then
  cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)"
fi
cat > /etc/caddy/Caddyfile <<CADDY
# life-code
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
systemctl reload caddy || systemctl restart caddy

sleep 2
if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null; then
  echo
  echo "部署完成:https://$DOMAIN"
  echo "第一次申请证书可能要等一两分钟。"
  echo "管理页(生成兑换码、查询、重置):https://$DOMAIN/admin"
  echo "管理密码:$ADMIN_TOKEN (只有你知道,不要外传;以后可以用 sudo cat $APP/data/admin-token 再查看)"
else
  echo "服务没有正常启动,查看日志:journalctl -u life-code -n 50"
  exit 1
fi
