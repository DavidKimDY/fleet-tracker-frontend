#!/usr/bin/env bash
# EC2 단독 배포: nginx 정적 서빙 + Let's Encrypt HTTPS + 백엔드 프록시
# AWS 유료 서비스(ALB, ACM, CloudFront 등) 없이 EC2에서만 동작합니다.
#
# 사전 조건:
#   - 도메인 DNS A 레코드 → 이 EC2 퍼블릭 IP
#   - Security Group: 80, 443 인바운드 허용
#   - Node.js 18+ (빌드용)
#
# 사용 예:
#   export DOMAIN=penutjam.com
#   export CERTBOT_EMAIL=you@example.com
#   ./deploy/setup-https.sh

set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN 환경 변수를 설정하세요 (예: penutjam.com)}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL 환경 변수를 설정하세요}"
BACKEND_HOST="${BACKEND_HOST:-3.34.97.233}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/fleet-tracker"
NGINX_SITE="/etc/nginx/conf.d/fleet-tracker.conf"

if [[ $EUID -ne 0 ]]; then
  echo "sudo로 실행하세요: sudo -E ./deploy/setup-https.sh"
  exit 1
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y nginx certbot python3-certbot-nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx certbot python3-certbot-nginx
  else
    echo "지원 OS: Ubuntu/Debian(apt) 또는 Amazon Linux(dnf)"
    exit 1
  fi
}

install_packages

echo "==> 프론트엔드 빌드 (프로덕션: nginx 경유 same-origin)"
cd "$REPO_ROOT"
if command -v npm >/dev/null 2>&1; then
  npm ci 2>/dev/null || npm install
  npm run build
else
  echo "npm이 없습니다. dist/를 미리 빌드해 두었는지 확인하세요."
  [[ -d dist ]] || exit 1
fi

mkdir -p "$WEB_ROOT" /var/www/html
rm -rf "${WEB_ROOT:?}"/*
cp -a "$REPO_ROOT/dist/." "$WEB_ROOT/"

echo "==> nginx 설정"
sed -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__BACKEND_HOST__/${BACKEND_HOST}/g" \
    -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \
    "$REPO_ROOT/deploy/nginx/fleet-tracker.conf.template" >"$NGINX_SITE"

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Let's Encrypt 인증서 발급"
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$CERTBOT_EMAIL" \
  --redirect

echo ""
echo "완료. 접속: https://${DOMAIN}"
echo "인증서 자동 갱신: systemctl status certbot-renew.timer (또는 cron)"
